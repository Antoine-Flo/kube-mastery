---
seoTitle: 'Kubernetes Probes and Resource Limits, Liveness, Readiness'
seoDescription: 'Explore Kubernetes liveness, readiness, and startup probes alongside resource requests and limits to keep containers healthy and prevent noisy neighbors.'
---

# Probes and Resource Limits

Your web server starts successfully. The process is running, the container is in `Running` state, and Kubernetes routes traffic to it. But internally, it hit a deadlock five minutes ago and is not responding to any requests. Users are getting timeouts. Kubernetes has no idea anything is wrong, because a running process is not the same as a healthy process.

Probes are how you give Kubernetes the ability to actively check the health of your containers, rather than just watching whether the process is alive. Resource requests and limits are how you tell the cluster what a container needs and cap what it is allowed to take, preventing one misbehaving container from starving everything else on the same node.

## Liveness Probes

A liveness probe answers one question: "Is this container still functional?" If the probe fails too many times in a row, Kubernetes kills the container and restarts it. This is the right tool for deadlocks, infinite loops, or any state where the process is running but no longer doing useful work.

Build the liveness probe configuration incrementally. The check itself is an HTTP GET:

```yaml
# illustrative only
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
```

Add the timing parameters:

```yaml
# illustrative only
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 3
```

`initialDelaySeconds` is how long Kubernetes waits before running the first probe. This prevents the probe from killing the container before the application has had time to start. `periodSeconds` is how often the probe runs. `failureThreshold` is how many consecutive failures trigger a restart.

:::warning
If `initialDelaySeconds` is set too low, the liveness probe will fire before the application is ready to respond. The probe fails, the container gets killed, the container restarts, the probe fires again before the application is ready, and so on. You get a crash loop that looks like an application bug but is actually a misconfigured probe. When you see `CrashLoopBackOff` on a container that should be healthy, check the probe timing first.
:::

Two other probe mechanisms exist alongside `httpGet`: `tcpSocket` checks whether a port accepts connections, and `exec` runs a command inside the container and checks the exit code. Use whichever matches how your application exposes health.

## Readiness Probes

A readiness probe answers a different question: "Is this container ready to receive traffic?" When the readiness probe fails, the Pod is removed from the Service's backend pool and stops receiving requests. The container is **not** restarted. When the probe passes again, the Pod is added back.

@@@
graph TD
    RUN["Container Running"]
    LP["Liveness probe<br/>fails failureThreshold times"]
    RP["Readiness probe<br/>fails"]
    KILL["Container killed<br/>and restarted"]
    REMOVE["Removed from<br/>Service traffic<br/>(not restarted)"]
    PASS["Readiness probe<br/>passes again"]
    BACK["Re-added to<br/>Service traffic"]

    RUN --> LP
    RUN --> RP
    LP --> KILL
    RP --> REMOVE
    REMOVE --> PASS
    PASS --> BACK
@@@

The diagram shows the two independent branches: liveness failure leads to a container restart, readiness failure leads to traffic removal. A container can fail its readiness probe while passing its liveness probe: it is alive but temporarily unable to serve requests, perhaps because it is waiting on a dependency or warming up a cache.

Readiness probes matter most during rolling updates. When a new Pod starts, Kubernetes waits for its readiness probe to pass before routing any traffic to it and before terminating old Pods. Without a readiness probe, traffic reaches the Pod the moment the container process starts, which might be seconds before the application is actually ready.

```yaml
# illustrative only
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 2
```

:::quiz
A container's liveness probe is passing but its readiness probe is failing. What does Kubernetes do?

- It kills the container and restarts it
- It removes the Pod from Service traffic but does not restart the container
- It does nothing: both probes must fail for any action to occur

**Answer:** It removes the Pod from Service traffic but does not restart the container. Liveness and readiness are completely independent. The container is considered alive (liveness passes) but temporarily unavailable (readiness fails). Traffic stops, the container keeps running.
:::

Now apply a Deployment with both probes configured:

```bash
nano probed-deployment.yaml
```

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

:::visualizer
Watch the cluster visualizer: the two Pods appear with their readiness status. A Pod shows as not ready until its readiness probe passes.
:::

Inspect the probe configuration on a running Pod:

```bash
kubectl describe pod -l app=probed
```

Scroll to the `Containers` section. You will find `Liveness` and `Readiness` fields showing the probe configuration along with current success and failure counts.

:::quiz
In the `kubectl describe pod` output, what does the `READY` column in `kubectl get pods` represent?

**Try it:** `kubectl get pods -l app=probed`

**Answer:** The `1/1` in the READY column means one container is ready out of one total. A Pod with a failing readiness probe would show `0/1`. The Pod is still running, but it is just not receiving Service traffic. This is how you distinguish a temporarily unavailable Pod from a crashed one.
:::

## Resource Requests and Limits

Your containerized application shares a physical node with dozens of other workloads. Without any constraints, one container with a memory leak can consume all available memory on the node and cause every other container on that node to be killed.

The `resources` field on a container has two sub-fields:

```yaml
# illustrative only
resources:
  requests:
    cpu: '250m'
    memory: '128Mi'
```

`requests` is the amount of CPU and memory the container is guaranteed. The scheduler uses **only** requests, not actual usage, to decide which node can accept a new Pod. This is intentional. If the scheduler used actual usage, it would overcommit nodes during low-traffic periods and then have no headroom when load spikes. By using declared requests, the scheduler makes decisions based on what the application claims it needs, not what it happens to be using right now.

Add `limits` to cap what the container is allowed to consume:

```yaml
# illustrative only
resources:
  requests:
    cpu: '250m'
    memory: '128Mi'
  limits:
    cpu: '500m'
    memory: '256Mi'
```

What happens when a container exceeds a limit? The behavior is different for CPU and memory. Exceeding the CPU limit causes throttling: the container is slowed down but keeps running. Exceeding the memory limit causes an immediate `OOMKill`: the operating system terminates the process and Kubernetes restarts the container. CPU is compressible: you can take it away gradually. Memory is not: once a process has allocated memory, you cannot reclaim it without killing the process.

CPU is measured in millicores: `250m` is a quarter of a CPU core. Memory uses binary units: `128Mi` is 128 mebibytes.

:::quiz
A container's memory usage spikes beyond its memory limit. What happens?

- The container is throttled (slowed down) like CPU
- The container is killed immediately with OOMKill and then restarted
- The Pod is evicted to a node with more available memory

**Answer:** The container is killed immediately with OOMKill and then restarted. Memory is not compressible. The OS terminates the process the moment it exceeds the limit. CPU throttling and memory OOMKill are two fundamentally different mechanisms.
:::

See how resource requests affect the node's allocation view:

```bash
kubectl describe node
```

Look for the `Allocated resources` section. It shows how much CPU and memory is reserved by current Pod requests on this node. This is the number the scheduler reads when deciding whether a new Pod fits.

Clean up when done:

```bash
kubectl delete deployment probed-app
```

Probes and resource limits are not optional configuration for production workloads: they are how you give Kubernetes the information it needs to manage your containers intelligently. Probes close the gap between "process is running" and "application is healthy." Resource declarations close the gap between "node has capacity" and "node has capacity for this specific workload."
