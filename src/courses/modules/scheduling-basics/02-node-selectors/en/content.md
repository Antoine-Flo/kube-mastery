---
seoTitle: 'Kubernetes nodeSelector, Schedule Pods on Specific Nodes by Label'
seoDescription: 'Learn how to use nodeSelector to schedule Kubernetes Pods on specific nodes, how to label nodes, and the limitations that make nodeAffinity the preferred choice.'
---

# Node Selectors

A `nodeSelector` is the simplest way to direct a Pod to a specific group of nodes. You add labels to nodes, then add a `nodeSelector` to the Pod spec that matches those labels. Only nodes with all the required labels can receive the Pod.

You already saw `nodeSelector` used in the DaemonSet scheduling lesson to restrict a DaemonSet to SSD nodes. The mechanism is identical for regular Pods.

## Labeling nodes

```bash
kubectl get nodes --show-labels
```

Nodes already have default labels: `kubernetes.io/hostname`, `kubernetes.io/os`, and `kubernetes.io/arch` among others. You can add custom labels for your own scheduling needs.

```bash
kubectl label node sim-worker disk=ssd
kubectl label node sim-worker2 disk=hdd
```

Verify:

```bash
kubectl get nodes -L disk
```

The `-L disk` flag adds the `disk` label as a column in the output. Both nodes appear with their respective values.

## Using nodeSelector in a Pod

```bash
nano ssd-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ssd-pod
spec:
  nodeSelector:
    disk: ssd
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
```

```bash
kubectl apply -f ssd-pod.yaml
kubectl get pod ssd-pod -o wide
```

The `NODE` column shows `sim-worker`. The Pod was scheduled on the SSD node.

```bash
kubectl describe pod ssd-pod
```

Under `Node-Selectors`, you see `disk=ssd`. If no node has this label, the Events section would show `FailedScheduling: 0 nodes matched node selector`.

## Selecting by built-in labels

Built-in labels are useful for OS or architecture requirements:

```yaml
nodeSelector:
  kubernetes.io/os: linux
  kubernetes.io/arch: amd64
```

This schedules the Pod only on Linux nodes with AMD64 architecture. Useful for clusters with mixed OS or architecture (Raspberry Pi nodes with arm64, for example).

:::quiz
A cluster has 3 nodes: two labeled `tier=frontend` and one labeled `tier=backend`. A Pod has `nodeSelector: tier: backend`. How many candidate nodes does the scheduler have?

**Answer:** 1. The `nodeSelector` is a hard requirement: only nodes with all specified labels can be selected. Only the one node labeled `tier=backend` matches. If that node is full or unavailable, the Pod stays Pending. There is no fallback to the frontend nodes.
:::

## The limitation of nodeSelector

`nodeSelector` only supports equality matching: `key=value`. You cannot express:
- "schedule on nodes with disk=ssd OR disk=nvme"
- "prefer nodes labeled `region=eu-west` but allow other regions if needed"
- "schedule only if the node has at least 8 CPUs AND is in zone A"

For any scheduling requirement more complex than exact label matching, use `nodeAffinity`, covered in the next lesson.

:::warning
Removing a label from a node does not evict Pods already running there. A Pod scheduled to `disk=ssd` and then running on a node from which the `disk=ssd` label was removed will keep running. Only new Pod creations are affected by current node labels. If you need to move workloads when labels change, drain the node explicitly.
:::

```bash
kubectl delete pod ssd-pod
kubectl label node sim-worker disk-
kubectl label node sim-worker2 disk-
```

:::quiz
You want to schedule a Pod only on nodes that have any value for the label key `gpu`. Can `nodeSelector` express this?

**Answer:** No. `nodeSelector` only matches `key=value` exactly. It cannot express "this key exists with any value." For this requirement, use `nodeAffinity` with the `In` operator and a list of all possible values, or the `Exists` operator (which is available in `nodeAffinity` but not in `nodeSelector`).
:::

`nodeSelector` is the simplest node targeting tool. Use it when you need exact label matching. For soft preferences, OR conditions, or range expressions, `nodeAffinity` provides the flexibility you need.
