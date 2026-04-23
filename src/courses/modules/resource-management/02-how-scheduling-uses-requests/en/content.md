---
seoTitle: 'How Kubernetes Scheduler Uses Resource Requests for Pod Placement'
seoDescription: 'Learn how the Kubernetes scheduler uses CPU and memory requests to filter nodes, why a Pod stays Pending, and what allocatable capacity means on a node.'
---

# How Scheduling Uses Requests

You set `requests.cpu: 2000m` on a Pod. The cluster has three nodes, each with 2 cores. The Pod goes Pending. Why? Understanding how the scheduler reads resource requests explains why this happens and how to fix it.

```bash
kubectl describe node sim-worker
```

Find the `Allocatable` section near the top. It shows the actual resource capacity available to workloads after the node reserves resources for the kubelet, system daemons, and eviction thresholds:

```
Allocatable:
  cpu:    2
  memory: 3825Mi
```

Also find `Allocated resources` near the bottom. It shows how much of that allocatable capacity is already claimed by running Pods:

```
Allocated resources:
  (Total limits may be over 100 percent, i.e., overcommitted.)
  Resource           Requests      Limits
  --------           --------      ------
  cpu                200m (10%)    500m (25%)
  memory             128Mi (3%)    256Mi (6%)
```

The scheduler uses the `Requests` column here: the sum of all container requests on the node. It does not look at actual CPU or memory consumption. It looks at what has been promised.

## The scheduling decision

@@@
graph TB
N1["node-1\nAllocatable: 2 CPU\nRequested: 1.8 CPU\nFree: 0.2 CPU"]
N2["node-2\nAllocatable: 2 CPU\nRequested: 0.5 CPU\nFree: 1.5 CPU"]
N3["node-3\nAllocatable: 2 CPU\nRequested: 1.9 CPU\nFree: 0.1 CPU"]
P["New Pod\nrequest: 1 CPU"]
P -->|"filtered out"| N1
P -->|"scheduled here"| N2
P -->|"filtered out"| N3
@@@

The scheduler filters out nodes where the sum of existing requests plus the new Pod's request would exceed allocatable capacity. In the diagram, only node-2 has enough free capacity for a Pod requesting 1 CPU.

Create a Pod with a large CPU request to see the Pending behavior:

```bash
nano big-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: big-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
      resources:
        requests:
          cpu: '4'
          memory: '100Mi'
```

```bash
kubectl apply -f big-pod.yaml
kubectl get pod big-pod
```

The Pod shows `Pending`. The scheduler found no node with 4 CPU cores free.

```bash
kubectl describe pod big-pod
```

Look at the `Events` section. You will see:

```
Warning  FailedScheduling  0/N nodes are available: N Insufficient cpu.
```

This is the scheduler's filter output. Every node was eliminated because none had 4 CPU allocatable.

:::quiz
A node has `Allocatable CPU: 4 cores`. Running Pods have requests totaling 3.5 cores. A new Pod requests 0.6 cores. What happens?

**Answer:** The Pod stays Pending. The scheduler checks: 3.5 (already allocated) + 0.6 (new request) = 4.1 cores, which exceeds the allocatable 4 cores. The node is filtered out. Even if the actual CPU usage is only 1 core (pods burst less than their requests), the scheduler works with declared requests, not live usage.
:::

## What Pending pods look like in practice

```bash
kubectl describe pod big-pod | grep -A 5 Events
```

The `FailedScheduling` warning repeats periodically as the scheduler retries. The Pod will remain Pending until either:
- A node with enough free capacity appears (new node joins, other Pods leave)
- The Pod's request is reduced
- The Pod is deleted

This is a useful diagnostic signal. When a Pod is stuck Pending and the Events say `Insufficient cpu` or `Insufficient memory`, the problem is always either the request is too high for any existing node, or all nodes are saturated.

:::warning
A common trap: you run `kubectl top nodes` and see CPU usage at 20%, but a new Pod stays Pending with `Insufficient cpu`. The explanation is that `kubectl top` shows actual consumption, while the scheduler works with declared requests. If a large number of running Pods have high requests but low actual usage, the node is "over-requested" even though it is "under-utilized." Scheduling fails despite abundant real capacity.
:::

```bash
kubectl delete pod big-pod
```

:::quiz
You see a Pod in Pending state. `kubectl describe pod` shows `0/3 nodes are available: 3 Insufficient memory`. How do you diagnose this?

**Answer:** Run `kubectl describe nodes` on each node and look at the Allocated resources section. The sum of memory requests from all Pods on each node plus the new Pod's memory request exceeds the allocatable memory on every node. Either reduce the new Pod's memory request, increase node capacity, or free up requests by removing other Pods.
:::

The scheduler is a bin packer that works with declared requests, not actual usage. Pending Pods with resource errors are always a mismatch between what is requested and what is available. The next lesson covers what happens at runtime when a container exceeds its limit.
