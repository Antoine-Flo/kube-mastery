---
seoTitle: 'Kubernetes Resource Requests and Limits, CPU Memory Pod Spec'
seoDescription: 'Learn how to set CPU and memory requests and limits on Kubernetes containers, understand the difference between them, and why both matter for scheduling and stability.'
---

# Resource Requests and Limits

A cluster with no resource configuration is a cluster waiting to fail. One runaway container can consume all CPU on a node and starve every other container. One memory leak can fill a node's RAM, triggering the kernel's out-of-memory killer on random processes. Requests and limits prevent this by giving Kubernetes the information it needs to place and constrain workloads.

Two distinct values exist for each resource type:

- **Request**: the amount of CPU or memory the container is guaranteed to have. The scheduler uses this to decide which node to place the Pod on.
- **Limit**: the maximum the container is allowed to consume. The kubelet enforces this at runtime.

They are set in the container spec:

```bash
nano resource-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
      resources:
        requests:
          cpu: '100m'
          memory: '128Mi'
        limits:
          cpu: '500m'
          memory: '256Mi'
```

```bash
kubectl apply -f resource-pod.yaml
kubectl describe pod resource-pod
```

Look at the `Containers` section under `Requests` and `Limits`. The values you set appear exactly as specified.

## CPU and memory units

@@@
graph LR
subgraph cpu ["CPU"]
  C1["1 = 1 core = 1000m"]
  C2["100m = 0.1 core = 100 millicores"]
  C3["500m = 0.5 core"]
end
subgraph memory ["Memory"]
  M1["128Mi = 128 mebibytes\n(binary, 1024-based)"]
  M2["128M = 128 megabytes\n(decimal, 1000-based)"]
  M3["1Gi = 1024Mi"]
end
@@@

**CPU** is measured in cores. One core equals `1000m` (millicores). `100m` is one tenth of a core. CPU is compressible: when a container hits its CPU limit, it is throttled but not killed.

**Memory** uses binary suffixes: `Ki` (kibibytes, 1024 bytes), `Mi` (mebibytes), `Gi` (gibibytes). Memory is not compressible: a container that exceeds its memory limit is killed immediately with an OOM (out of memory) error.

Always use `Mi` and `Gi` for memory, not `M` and `G`. The difference matters at scale: `512M` is about 488 Mi, a 5% discrepancy that compounds when sizing nodes.

:::quiz
A container has `resources.limits.cpu: 200m`. The application tries to use 0.5 cores. What happens?

**Answer:** The container is CPU-throttled. The Linux CFS (Completely Fair Scheduler) limits the container to 200 millicores of CPU time. The process keeps running but runs slower. It is not killed. CPU is a compressible resource: exceeding the limit results in throttling, not termination.
:::

## The difference between request and limit

Request and limit serve different purposes:

```bash
kubectl get pod resource-pod -o jsonpath='{.spec.containers[0].resources}'
```

The request (`100m` CPU, `128Mi` memory) is what the scheduler uses to find a node with enough available capacity. The limit (`500m` CPU, `256Mi` memory) is the hard ceiling enforced at runtime.

A container can consume more than its request (up to the limit) when the node has spare capacity. This is "burst" behavior. When the node is under pressure and needs to reclaim resources, it targets containers that are consuming more than their request.

:::warning
Setting a very low request with a very high limit is tempting because it makes scheduling easier. But it creates unpredictability: the container may run fine on an idle node and crash on a loaded one because the node can no longer honor the burst. Match requests to the actual steady-state usage of the application, and set limits conservatively above that.
:::

## What happens without resource configuration

A container without any resource requests or limits is scheduled on whichever node the scheduler picks, without any resource constraint. It can consume as much CPU and memory as the node has. If it grows unbounded, it starves other containers on the same node.

```bash
kubectl delete pod resource-pod
```

:::quiz
A container has `requests.memory: 64Mi` and `limits.memory: 128Mi`. The container is currently using 80 Mi. Is this allowed?

**Answer:** Yes. The container is allowed to use up to its limit (128Mi). The request (64Mi) is the scheduler's placement baseline, not the runtime ceiling. Using 80Mi is within the limit, so no action is taken. If usage reaches 128Mi, the container will be OOM-killed.
:::

Requests enable intelligent scheduling; limits prevent resource monopolization. The next lesson shows exactly how the scheduler uses request values to decide where to place a Pod.
