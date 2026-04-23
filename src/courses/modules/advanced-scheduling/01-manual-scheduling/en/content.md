---
seoTitle: 'Kubernetes Manual Scheduling, nodeName Field, Bypass Scheduler'
seoDescription: 'Learn how to manually schedule a Kubernetes Pod by setting the nodeName field, when this is useful, and what happens when the scheduler is unavailable.'
---

# Manual Scheduling

Every Pod in a Kubernetes cluster is normally placed by the kube-scheduler. The scheduler filters nodes, scores them, and writes the selected node name into the Pod's `spec.nodeName` field. That write is the "scheduling decision." But you can set `spec.nodeName` yourself, bypassing the scheduler entirely.

Manual scheduling is not a production best practice for most workloads. It matters because it reveals how scheduling works internally, it is useful for debugging, and it appears directly on the CKA exam.

## How the scheduler works at the API level

When you create a Pod without a `nodeName`, the scheduler watches for Pods in this state. When it finds one, it runs the filter and scoring phases, picks a node, and then creates a **Binding** object that sets `nodeName` on the Pod. From that point, the kubelet on the named node picks up the Pod and starts it.

If the scheduler is down, Pods remain in `Pending` state indefinitely, because no component sets `nodeName`.

## Setting nodeName manually

```bash
kubectl get nodes
```

Note the name of one of the worker nodes. Then:

```bash
nano manual-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: manual-pod
spec:
  nodeName: sim-worker
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
```

```bash
kubectl apply -f manual-pod.yaml
kubectl get pod manual-pod -o wide
```

The Pod is immediately placed on `sim-worker`. The `NOMINATED NODE` column is empty and there is no scheduling event: the kubelet directly picks up the Pod without the scheduler's involvement.

```bash
kubectl describe pod manual-pod
```

The Events section shows a `Scheduled` event with `reason: TriggeredScaleUp` or similar, but no `Successfully assigned` event from the scheduler. The kubelet starts the Pod directly.

:::quiz
A cluster's kube-scheduler is stopped. You create a Pod without `nodeName`. What happens?

**Answer:** The Pod stays Pending. Without the scheduler, no component sets the `nodeName` field. The Pod sits in the unscheduled queue indefinitely. However, if you manually set `nodeName` in the Pod spec, the kubelet on that node will pick it up and start it regardless of the scheduler's state.
:::

## Limitations of manual scheduling

Setting `nodeName` bypasses all scheduling logic:
- No resource check: you can set a node with no available CPU, and the kubelet will try to run the Pod anyway
- No taint check: taints are ignored, the Pod will be placed even on tainted nodes
- No affinity rules: node affinity and other expressions are bypassed
- No preemption: priority-based eviction does not apply

If the specified node does not exist, the Pod stays Pending indefinitely (the kubelet on a non-existent node will never pick it up).

:::warning
Setting `nodeName` on a Pod in a production workload is almost never correct. It creates a hard dependency on a specific node name. If that node is removed, replaced, or renamed, the Pod is stuck. Use taints, tolerations, and node affinity for all production placement decisions. Reserve `nodeName` for testing, debugging, or exam scenarios.
:::

## Using Binding objects to schedule a Pending Pod

On the CKA exam, you may be asked to schedule a Pod that is already Pending (as if you are recovering from a scheduler outage). You cannot edit the `spec.nodeName` field of an existing Pod directly. Instead, create a Binding:

```bash
nano binding.yaml
```

```yaml
apiVersion: v1
kind: Binding
metadata:
  name: manual-pod
target:
  apiVersion: v1
  kind: Node
  name: sim-worker
```

```bash
kubectl apply -f binding.yaml
```

This is equivalent to what the scheduler does: it writes a Binding that assigns the Pod to a node. The alternative on the exam is to delete the Pending Pod and recreate it with `nodeName` set.

```bash
kubectl delete pod manual-pod
```

:::quiz
A Pod is stuck in `Pending` because the scheduler is not running. What are the two ways to get it scheduled?

**Answer:** 1. Create a `Binding` object targeting the desired node. This is what the scheduler does internally. 2. Delete the Pod and recreate it with `spec.nodeName` set directly. Both approaches bypass the scheduler. The first preserves the Pod object; the second recreates it.
:::

Manual scheduling reveals the internal mechanics of how `nodeName` drives Pod placement. The next lesson covers static Pods, which take this one step further: Pods that are managed directly by the kubelet without any API server involvement.
