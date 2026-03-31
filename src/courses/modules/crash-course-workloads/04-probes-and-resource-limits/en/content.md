---
seoTitle: "Kubernetes Probes and Resource Limits: Liveness, Readiness"
seoDescription: "Explore Kubernetes liveness, readiness, and startup probes alongside resource requests and limits to keep containers healthy and prevent noisy neighbors."
---

# Probes and Resource Limits

A running container is not necessarily a healthy container. A web server might have started successfully but now be in a deadlock, unable to process any requests. A new container might be starting up and not yet ready to receive traffic. Without any way for Kubernetes to detect these states, it would blindly route traffic to broken containers and keep them running indefinitely. Probes are how you give Kubernetes the ability to actively check the health of your containers, and resource limits are how you prevent one misbehaving container from affecting everything else on the same node.

:::info
Probes tell Kubernetes whether a container is alive and whether it's ready for traffic. Resource requests and limits tell the scheduler how much capacity this container needs and cap what it's allowed to consume.
:::

## Liveness Probes

A liveness probe answers the question: "Is this container still functional?" If the probe fails enough times consecutively, Kubernetes kills the container and restarts it. This is useful for catching deadlocks, infinite loops, or any situation where a process is running but no longer doing useful work. Without a liveness probe, a stuck container would sit there forever, and Kubernetes would have no idea anything was wrong.

The most common probe type for HTTP services sends a GET request to a specified path and port. A response in the 200-399 range is a success. Any other response, or a connection timeout, is a failure.

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 3
```

`initialDelaySeconds` is the wait time before the first probe attempt - this prevents the probe from running before the application has had a chance to start. `periodSeconds` is how often the probe runs. `failureThreshold` is how many consecutive failures are needed before the container is restarted.

## Readiness Probes

A readiness probe answers a different question: "Is this container ready to receive traffic?" A container that fails its readiness probe is removed from the Service's backend pool - traffic stops going to it - but it is not restarted. This is the right behavior when a container needs time to warm up, is temporarily overloaded, or is waiting on a dependency to become available.

The distinction from liveness matters a lot during rolling updates. When a new Pod starts, Kubernetes waits for its readiness probe to pass before routing any traffic to it and before terminating old Pods. Without a readiness probe, Kubernetes sends traffic to a Pod the moment its container process starts, which might be long before the application is actually ready to respond.

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 2
```

Both probe types support three checking mechanisms: `httpGet` for HTTP endpoints, `tcpSocket` for checking whether a port accepts connections, and `exec` for running a command inside the container and checking its exit code. Use whichever best matches how your application exposes its health.

## Resource Requests and Limits

Every container in a Pod should declare its resource requirements. The `resources` field has two sub-fields that serve very different purposes.

`requests` is the amount of CPU and memory the container is guaranteed. The scheduler uses requests - and only requests - to decide which node can accept a new Pod. If a node has 1000m of allocatable CPU and two Pods already requesting 400m each, only 200m of CPU is considered available for scheduling, even if the actual usage is lower. A Pod requesting 300m would not be scheduled on that node.

`limits` is the maximum a container is allowed to use. Exceeding the memory limit causes the container to be killed immediately with an OOMKill - the operating system terminates the process, and Kubernetes restarts it according to the restart policy. Exceeding the CPU limit causes throttling: the container is slowed down, but not killed. CPU is measured in millicores (`250m` equals a quarter of a CPU core). Memory uses binary units (`128Mi` equals 128 mebibytes).

```yaml
resources:
  requests:
    cpu: '250m'
    memory: '128Mi'
  limits:
    cpu: '500m'
    memory: '256Mi'
```

Setting both requests and limits for every container in production is not optional. Without requests, the scheduler places Pods on nodes without knowing if they'll fit, which leads to nodes being overloaded. Without limits, a single runaway container - due to a memory leak, an infinite loop, or a traffic spike - can consume all resources on the node and starve every other workload sharing that machine.

## Hands-On Practice

**1. Create a Deployment with probes and resource limits:**

```yaml
# probed-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: probed-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: probed
  template:
    metadata:
      labels:
        app: probed
    spec:
      containers:
        - name: web
          image: nginx:1.28
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: '100m'
              memory: '64Mi'
            limits:
              cpu: '200m'
              memory: '128Mi'
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 5
            failureThreshold: 2
```

```bash
kubectl apply -f probed-deployment.yaml
kubectl rollout status deployment/probed-app
```

**2. Inspect the probe configuration on a running Pod:**

```bash
kubectl describe pod -l app=probed
```

Scroll to the `Containers` section. You'll find `Liveness` and `Readiness` fields showing the probe configuration, the current success and failure counts, and the timing parameters.

**3. Observe the READY column:**

```bash
kubectl get pods -l app=probed
```

The `1/1` in the READY column means the readiness probe is passing. If you ran this immediately after applying the manifest, you might briefly see `0/1` while the container is starting and before the readiness probe first succeeds.

**4. Check how resource requests affect the node:**

```bash
kubectl describe node
```

Scroll to the `Allocated resources` section. You should see the CPU and memory requests from your Pods accounting for some of the node's available capacity. This is what the scheduler reads when deciding whether a new Pod fits on this node.

**5. Clean up:**

```bash
kubectl delete deployment probed-app
```
