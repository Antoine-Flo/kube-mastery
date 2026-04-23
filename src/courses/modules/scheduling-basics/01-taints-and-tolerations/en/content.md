---
seoTitle: 'Kubernetes Taints and Tolerations, Node Exclusion Scheduling'
seoDescription: 'Learn how Kubernetes taints mark nodes as restricted and tolerations allow specific Pods to bypass those restrictions, with practical taint effects and examples.'
---

# Taints and Tolerations

You have a node with GPUs. Most Pods should not run there: they do not need GPUs and would waste the capacity. Only specific machine learning workloads should be scheduled on this node. Taints let you mark the node as restricted and tolerations let specific Pods declare they are allowed through.

A taint is placed on a node. It repels Pods. A toleration is placed on a Pod. It allows the Pod to be scheduled on nodes with a matching taint. The toleration does not attract Pods to tainted nodes: it only removes the repulsion. The scheduler still decides where to place the Pod based on resources and other constraints.

## Adding a taint to a node

```bash
kubectl taint node sim-worker gpu=true:NoSchedule
```

The taint format is `key=value:effect`. This adds a taint with key `gpu`, value `true`, and effect `NoSchedule`.

```bash
kubectl describe node sim-worker | grep Taint
```

You see `Taints: gpu=true:NoSchedule`. Any Pod without a matching toleration will not be scheduled on this node.

Create a Pod without a toleration:

```bash
kubectl run no-toleration --image=busybox:1.36 --restart=Never \
  --command -- sleep 3600
kubectl describe pod no-toleration | grep -A3 Events
```

The Events section shows `Warning FailedScheduling ... 1 node(s) had untolerated taint {gpu: true}`. The Pod stays Pending.

## The three taint effects

@@@
graph LR
NS["NoSchedule\nNew Pods without toleration\ncannot be scheduled here"]
PNS["PreferNoSchedule\nScheduler avoids this node\nbut will use it if no other choice"]
NE["NoExecute\nNew Pods blocked AND\nexisting Pods without toleration\nare evicted"]
@@@

**`NoSchedule`**: new Pods without a matching toleration are not scheduled on this node. Existing Pods on the node are not affected.

**`PreferNoSchedule`**: the scheduler tries to avoid this node but will use it if no other node is available. A soft restriction.

**`NoExecute`**: the strongest effect. New Pods are blocked, and any existing Pod without a toleration for this taint is evicted. This is what Kubernetes uses automatically for node conditions like `node.kubernetes.io/not-ready`.

## Adding a toleration to a Pod

```bash
nano toleration-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: toleration-pod
spec:
  tolerations:
    - key: gpu
      value: 'true'
      operator: Equal
      effect: NoSchedule
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
```

```bash
kubectl apply -f toleration-pod.yaml
kubectl get pods -o wide
```

The `toleration-pod` is scheduled on `sim-worker` (the tainted node) because its toleration matches the taint. The `no-toleration` Pod is still Pending.

:::quiz
A node has taint `env=prod:NoSchedule`. A Pod has toleration `key: env, operator: Exists, effect: NoSchedule`. Does the Pod tolerate the taint?

**Answer:** Yes. The `Exists` operator checks only for the presence of the key, ignoring the value. The taint key is `env` and the toleration key is `env` with `Exists`, so the match succeeds. The Pod can be scheduled on this node.
:::

## The Exists operator

The `Exists` operator in a toleration matches any taint with the specified key, regardless of value:

```yaml
tolerations:
  - key: gpu
    operator: Exists
    effect: NoSchedule
```

This Pod tolerates any `gpu=*:NoSchedule` taint. Useful when the value varies across nodes but you want to target all GPU nodes regardless of the GPU type.

An empty key with `Exists` is a wildcard that tolerates all taints on a node:

```yaml
tolerations:
  - operator: Exists
```

This Pod can be scheduled anywhere. Use this carefully: it bypasses all taints on all nodes.

:::warning
Removing a taint from a node does not evict existing Pods that were placed there because of a toleration. Pods stay on the node until they are terminated normally or the node is drained. Conversely, adding a `NoExecute` taint to a running node immediately evicts all Pods that do not tolerate it, which can cause unexpected downtime. Use `NoExecute` only when you intend to drain the node.
:::

```bash
kubectl delete pod no-toleration toleration-pod
kubectl taint node sim-worker gpu=true:NoSchedule-
```

The trailing `-` after the taint specification removes it.

:::quiz
You add a `NoExecute` taint to a node that has 10 running Pods. How many Pods are evicted?

**Answer:** All Pods that do not have a toleration for that specific taint. DaemonSet Pods have automatic tolerations for node condition taints but not for user-defined taints like this one, so they would also be evicted unless they have an explicit toleration. The exact number depends on how many Pods have matching tolerations.
:::

Taints mark nodes as restricted; tolerations are the key that unlocks that restriction. The next lesson covers `nodeSelector`, the simpler affinity mechanism for directing workloads to specific nodes.
