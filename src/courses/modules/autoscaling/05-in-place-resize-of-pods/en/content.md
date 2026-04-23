---
seoTitle: 'Kubernetes In-Place Pod Resize, Change CPU Memory Without Restart'
seoDescription: 'Learn how Kubernetes in-place pod vertical scaling (1.27+) lets you change container CPU and memory resources without restarting the pod, and how resizePolicy controls behavior.'
---

# In-Place Pod Resource Resize

VPA in Auto mode changes a Pod's resources by evicting the Pod and recreating it. For a database or any stateful workload, this means a restart, a reconnection delay, and a window of unavailability. In-place Pod vertical scaling (stable in Kubernetes 1.33, beta in 1.29) allows you to change container resources while the container keeps running, without a restart.

This is a significant shift: `resources.requests` and `resources.limits` on a running container are no longer immutable.

## How it works

The kubelet monitors the actual resource allocation of a container via cgroups. When you update `resources` on a running Pod, the kubelet changes the cgroup settings for the container. For CPU, this takes effect immediately (CPU is compressible). For memory, the kernel may need to reconfigure the memory limit, which is usually immediate for increases but may require a container restart for decreases if the current usage exceeds the new limit.

## The resizePolicy field

Each container can specify how it responds to resource changes:

```yaml
resizePolicy:
  - resourceName: cpu
    restartPolicy: NotRequired
  - resourceName: memory
    restartPolicy: RestartContainer
```

**`NotRequired`**: the resource can be changed while the container runs. No restart. This is the right value for CPU in most cases.

**`RestartContainer`**: the container will be restarted when this resource is changed. Some applications cache their memory allocation at startup and cannot adapt to a new limit without restarting. Use this when the application cannot handle a live memory change.

## Performing an in-place resize

Create a Pod with explicit `resizePolicy`:

```bash
nano resizable-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resizable-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
      resizePolicy:
        - resourceName: cpu
          restartPolicy: NotRequired
        - resourceName: memory
          restartPolicy: NotRequired
      resources:
        requests:
          cpu: '100m'
          memory: '128Mi'
        limits:
          cpu: '200m'
          memory: '256Mi'
```

```bash
kubectl apply -f resizable-pod.yaml
kubectl get pod resizable-pod
```

Now resize the CPU request without deleting the Pod:

```bash
kubectl patch pod resizable-pod --patch '{"spec":{"containers":[{"name":"app","resources":{"requests":{"cpu":"200m"},"limits":{"cpu":"500m"}}}]}}'
```

Check the Pod status:

```bash
kubectl describe pod resizable-pod
```

Look for the `Resize` field or the updated `Resources` section in the container status. The Pod is still running. The CPU cgroup limit was updated by the kubelet without any restart.

@@@
graph LR
OLD["Container running\ncpu request: 100m\nmemory: 128Mi"] -->|"kubectl patch"| NEW["Container running\ncpu request: 200m\nmemory: 128Mi"]
NEW --> NOTE["Container not restarted\nresizePolicy: NotRequired\ncgroup updated live"]
@@@

:::quiz
A container has `resizePolicy.cpu: NotRequired` and `resizePolicy.memory: RestartContainer`. You decrease the memory request. What happens?

**Answer:** The container is restarted. `RestartContainer` means any change to that resource triggers a container restart. The restart is the kubelet terminating and restarting the container within the same Pod (not a Pod restart). The Pod IP and volumes are preserved.
:::

## Current status and constraints

In-place resize is gated by the `InPlacePodVerticalScaling` feature gate. As of Kubernetes 1.29 (beta), it is enabled by default on most clusters. It is fully stable in 1.33.

Key constraints:
- You can only resize running Pods (not Job Pods in Completed state)
- The resize is limited by node capacity: if no node has free CPU to allocate to the container, the resize is deferred
- QoS class can change when you resize (e.g., from Burstable to Guaranteed if you set request=limit)
- The container's `status.resources` shows the current allocated values, which may differ from `spec.resources` briefly while the kubelet applies the change

:::warning
In-place resize does not bypass node capacity. If you increase a Pod's CPU request beyond what the node has available, the kubelet defers the resize. The Pod status shows `Resize: Infeasible`. The container keeps running with its old resources. This is different from scheduling: a pod already running on a node does not get evicted for a pending resize; it just waits.
:::

```bash
kubectl delete pod resizable-pod
```

:::quiz
When is in-place resize better than VPA Auto mode?

**Answer:** When restarts are unacceptable. VPA Auto mode evicts the Pod (causing a full restart) to apply new resources. In-place resize updates the cgroup settings on the running container without eviction. For databases, caches, or any workload where restart has a meaningful cost (connection draining, warmup time, data reload), in-place resize is strongly preferable.
:::

In-place Pod resize removes the restart penalty from vertical scaling. Combined with VPA in recommendation-only mode, it enables a workflow where VPA tells you the right values and you apply them (or automate the application) without disrupting the running container. The next module covers StatefulSets, which manage stateful workloads requiring stable identities and persistent storage.
