---
seoTitle: 'Kubernetes Readiness Probe, Remove Pod from Service Endpoints'
seoDescription: 'Learn how Kubernetes readiness probes control whether a Pod receives traffic, how they interact with Service Endpoints, and when to use them instead of liveness probes.'
---

# Readiness Probes

An application starts and loads 30 seconds of data into memory before it can serve requests. During those 30 seconds, a Service pointing to it would route traffic there and every request would fail. A readiness probe prevents this: the Pod is excluded from Service endpoints until the probe succeeds.

Unlike liveness probes, a failing readiness probe does not restart the container. It only affects traffic routing. When the probe fails, the kubelet marks the container as not ready and removes the Pod from the Service's endpoint list. When the probe passes again, the Pod is added back.

## Setting up a readiness probe

```bash
nano readiness-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: readiness-pod
  labels:
    app: readiness-demo
spec:
  containers:
    - name: app
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          echo "starting up..."
          sleep 10
          echo "ready" > /tmp/ready
          echo "app is ready"
          sleep 3600
      readinessProbe:
        exec:
          command:
            - cat
            - /tmp/ready
        initialDelaySeconds: 5
        periodSeconds: 5
        failureThreshold: 3
```

```bash
kubectl apply -f readiness-pod.yaml
kubectl get pod readiness-pod --watch
```

Watch the `READY` column. For the first 10+ seconds, it shows `0/1`: the application is sleeping and the `/tmp/ready` file does not exist yet. After the sleep completes and the file is created, the next probe check succeeds and the column changes to `1/1`.

## Readiness and Service Endpoints

Create a Service that selects the readiness-pod:

```bash
kubectl expose pod readiness-pod --port=80 --target-port=80 --name=readiness-svc
kubectl get endpoints readiness-svc
```

While the Pod is not ready (`0/1`), the Endpoints list is empty. No IP address appears. The Service exists but has no targets. Traffic to the Service would get no response.

After the Pod becomes ready (`1/1`):

```bash
kubectl get endpoints readiness-svc
```

The Pod's IP address now appears in the Endpoints list. Traffic can reach it.

@@@
graph LR
POD["Pod: readiness-pod\nREADY: 0/1\nprobe failing"] --> SVC["Service: readiness-svc\nEndpoints: empty"]
SVC --> TRAF["Traffic: no backend available"]
POD2["Pod: readiness-pod\nREADY: 1/1\nprobe passing"] --> SVC2["Service: readiness-svc\nEndpoints: 10.0.0.5:80"]
SVC2 --> TRAF2["Traffic: routed to Pod"]
@@@

:::quiz
A Deployment has 3 replicas. One Pod fails its readiness probe. What happens to traffic distribution?

**Answer:** The failing Pod is removed from the Service Endpoints. The two remaining ready Pods receive all traffic. The failing Pod is not restarted (readiness failure does not trigger restarts). If the Pod's readiness probe eventually passes, it is added back to the Endpoints and traffic resumes being distributed across all three.
:::

## Readiness vs liveness: the key distinction

The distinction matters for how you design each probe:

- **Readiness**: can be tied to external dependencies. "Is my database connection pool ready? Is my cache warmed?" If these fail, stop routing traffic but do not restart.
- **Liveness**: should only check internal application health. "Is my process in a valid state?" If this fails, restarting the container might help.

A container can fail its readiness probe while passing its liveness probe. In this state: the container is running and not being restarted, but it is not receiving traffic. This is the correct behavior when a temporary external dependency is unavailable.

:::warning
A readiness probe that is too slow to pass after startup causes rollout delays. During a rolling update, a new Pod must become ready before the old Pod is terminated. If the readiness probe takes 60 seconds to pass, each replica update adds 60 seconds to the rollout duration. Balance the `initialDelaySeconds` against actual startup time: too low causes false failures, too high slows your deployments.
:::

## Simulating readiness failure during a rollout

Create a Deployment with a readiness probe:

```bash
kubectl delete pod readiness-pod
kubectl delete svc readiness-svc
```

```bash
nano readiness-deploy.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: readiness-deploy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rdy
  template:
    metadata:
      labels:
        app: rdy
    spec:
      containers:
        - name: app
          image: busybox:1.36
          command: ['sh', '-c', 'echo ready > /tmp/ready && sleep 3600']
          readinessProbe:
            exec:
              command: ['cat', '/tmp/ready']
            periodSeconds: 5
```

```bash
kubectl apply -f readiness-deploy.yaml
kubectl get pods -l app=rdy
```

Both Pods show `1/1 READY`. The rolling update Deployment only terminates old Pods when new ones pass readiness. Without a readiness probe, old Pods are terminated as soon as new Pods are `Running`, potentially causing downtime.

:::quiz
During a rolling update, a new Pod is in `Running` state but the readiness probe is still failing. What does the Deployment controller do?

**Answer:** The Deployment controller waits. It does not terminate the old Pod until the new Pod passes its readiness probe. The rolling update is paused at this step. If the readiness probe never passes (within `progressDeadlineSeconds`), the Deployment eventually reports a `ProgressDeadlineExceeded` condition. This is a safety mechanism: your old Pods keep running if the new ones cannot become ready.
:::

```bash
kubectl delete deployment readiness-deploy
```

Readiness probes are the mechanism that makes zero-downtime deployments possible. They ensure traffic only flows to containers that are actually ready to serve it. The next lesson covers startup probes, which handle the window between container start and when liveness and readiness checks should begin.
