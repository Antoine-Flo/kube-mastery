---
seoTitle: 'DaemonSet Scheduling, nodeSelector, Node Subset, Tolerations'
seoDescription: 'Learn how DaemonSets place Pods on nodes, how to target a subset of nodes with nodeSelector, and why DaemonSets tolerate system taints that block regular Pods.'
---

# DaemonSet Scheduling

By default, a DaemonSet places one Pod on every node in the cluster. But what if you have a specialized monitoring agent that only makes sense on GPU nodes? Or a storage driver that should only run where a specific disk type is present? DaemonSets support node targeting so you can limit coverage to the nodes that need the workload.

```bash
kubectl get nodes --show-labels
```

Look at the labels on each node. Node labels are the selector mechanism DaemonSets use to restrict which nodes receive a Pod. The same labels used here drive both `nodeSelector` and the more flexible `nodeAffinity` rules you will explore in the scheduling module.

## Targeting a subset with nodeSelector

@@@
graph LR
subgraph all ["All nodes"]
  N1["node-1\nlabels: disk=ssd"]
  N2["node-2\nlabels: disk=hdd"]
  N3["node-3\nlabels: disk=ssd"]
end
subgraph matched ["DaemonSet targets disk=ssd"]
  P1["Pod"] --> N1
  P3["Pod"] --> N3
  skip["node-2 skipped"]
end
@@@

A `nodeSelector` in the Pod template restricts the DaemonSet to nodes that carry specific labels. Nodes that do not match the selector are skipped, even if a Pod could otherwise run there.

Add a label to one node in the simulated cluster:

```bash
kubectl label node sim-worker disk=ssd
```

Now create a DaemonSet that only targets nodes labeled `disk=ssd`:

```bash
nano ssd-agent.yaml
```

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ssd-agent
spec:
  selector:
    matchLabels:
      app: ssd-agent
  template:
    metadata:
      labels:
        app: ssd-agent
    spec:
      nodeSelector:
        disk: ssd
      containers:
        - name: agent
          image: busybox:1.36
```

```bash
kubectl apply -f ssd-agent.yaml
kubectl get pods -o wide
```

Only nodes carrying the label `disk=ssd` receive a Pod. Other nodes are unaffected. The `DESIRED` count in `kubectl get daemonset ssd-agent` reflects only the nodes that match.

:::quiz
A cluster has 5 nodes. Two are labeled `disk=ssd`. A DaemonSet specifies `nodeSelector: disk: ssd`. How many Pods does the DaemonSet create?

**Answer:** 2. The DaemonSet only places Pods on nodes that match the nodeSelector. The other three nodes are ignored entirely. DESIRED will show 2, not 5.
:::

## Why DaemonSets tolerate system taints

The scheduling module covers taints and tolerations in detail. For now, one behavior is worth knowing because it affects every DaemonSet you create.

When a node is not ready or is being evicted, Kubernetes automatically adds taints to it to prevent new Pods from being scheduled there. Regular Pods without matching tolerations are blocked. DaemonSet Pods are different: Kubernetes automatically adds tolerations for these system taints to every DaemonSet Pod.

```bash
kubectl get pod -l app=ssd-agent -o yaml
```

Look for the `tolerations` section in the output. You will see entries like `node.kubernetes.io/not-ready`, `node.kubernetes.io/unreachable`, and `node.kubernetes.io/disk-pressure` with the `Exists` operator. You did not write these. The DaemonSet controller adds them automatically.

Why? Because infrastructure workloads like log agents and CNI plugins need to run even on degraded nodes. A log agent that stops working the moment a node shows memory pressure would lose exactly the logs you need to diagnose the problem.

:::warning
These automatic tolerations mean DaemonSet Pods will attempt to run on nodes that are in a problematic state. For most infrastructure workloads this is the right behavior. For application workloads you write as DaemonSets, verify whether you want Pods to run on unhealthy nodes. You can override the automatic tolerations by explicitly setting narrower toleration rules in the Pod template.
:::

:::quiz
You create a DaemonSet and inspect one of its Pods with `kubectl get pod -o yaml`. You see tolerations for `node.kubernetes.io/not-ready` that you never wrote. Where do these come from?

**Answer:** The DaemonSet controller adds them automatically. Every DaemonSet Pod receives a set of system tolerations that allow it to run on nodes with common degraded conditions. This ensures infrastructure workloads keep running even when a node is under pressure, which is exactly when observability and networking agents are most needed.
:::

```bash
kubectl delete daemonset ssd-agent
kubectl label node sim-worker disk-
```

The second command removes the `disk` label from the node. The trailing `-` after the label name is the kubectl convention for deletion.

DaemonSet scheduling is straightforward when you understand the two levers: `nodeSelector` restricts which nodes receive a Pod, and system tolerations ensure infrastructure workloads survive degraded node conditions. The scheduling module covers the full taint and toleration system for application-level scheduling control.
