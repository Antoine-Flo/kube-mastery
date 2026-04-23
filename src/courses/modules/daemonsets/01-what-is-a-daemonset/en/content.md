---
seoTitle: 'Kubernetes DaemonSet, One Pod Per Node, Node Coverage'
seoDescription: 'Learn what a DaemonSet is, how it differs from Deployments and ReplicaSets, and why it is the right controller for workloads that must run on every node.'
---

# What Is a DaemonSet

You need to collect logs from every node in your cluster. You create a Deployment with three replicas. But three replicas on a five-node cluster means two nodes will not be covered. You scale to five. A sixth node joins. Now you are under-covered again. You spend your time chasing a moving target.

A DaemonSet eliminates this problem. It ensures exactly one copy of a Pod runs on every node in the cluster, automatically. When a new node joins, the DaemonSet places a Pod on it. When a node is removed, the Pod is garbage-collected. You declare the intent once. Coverage becomes a fact rather than a task.

```bash
kubectl get nodes
```

Look at the node count. A DaemonSet will place exactly one Pod on each of those nodes. Run that command again after creating a DaemonSet and you will see one Pod per node, correlated by the `NODE` column.

## How it differs from a Deployment

@@@
graph TB
subgraph deployment ["Deployment (3 replicas on 5 nodes)"]
  D1["Pod"] --> N1A["node-1"]
  D2["Pod"] --> N1B["node-1"]
  D3["Pod"] --> N2["node-2"]
  note["Nodes 3, 4, 5 have no Pod"]
end
subgraph daemonset ["DaemonSet (1 Pod per node)"]
  DS1["Pod"] --> N3["node-1"]
  DS2["Pod"] --> N4["node-2"]
  DS3["Pod"] --> N5["node-3"]
  DS4["Pod"] --> N6["node-4"]
  DS5["Pod"] --> N7["node-5"]
end
@@@

A Deployment maintains a fixed replica count and lets the scheduler decide which nodes receive Pods. The scheduler optimizes for resource fit and spreading, but the number of Pods is fixed. A DaemonSet delegates to a different controller: instead of counting replicas, it counts nodes. The spec says nothing about how many Pods to run. It says one Pod per node.

:::quiz
A cluster has 4 nodes. You create a DaemonSet. How many Pods are running?

- 1 (DaemonSets run a single instance)
- 4 (one per node)
- Depends on the `replicas` field

**Answer:** 4, one per node. DaemonSets have no `replicas` field. The replica count is determined entirely by the number of nodes.
:::

## The DaemonSet manifest

The structure closely resembles a Deployment. The key difference is the absence of `replicas` and the absence of a strategy section. Those fields belong to a controller that manages a fixed count. A DaemonSet has neither.

```bash
nano log-agent.yaml
```

Start with the outer shell:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent
```

The `spec` section requires two fields: `selector` and `template`. Their structure is identical to a Deployment.

```yaml
spec:
  selector:
    matchLabels:
      app: log-agent
  template:
    metadata:
      labels:
        app: log-agent
    spec:
      containers:
        - name: agent
          image: busybox:1.36
```

The full manifest:

```bash
nano log-agent.yaml
```

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent
spec:
  selector:
    matchLabels:
      app: log-agent
  template:
    metadata:
      labels:
        app: log-agent
    spec:
      containers:
        - name: agent
          image: busybox:1.36
```

```bash
kubectl apply -f log-agent.yaml
```

## Observing the placement

```bash
kubectl get pods -o wide
```

The `-o wide` flag adds a `NODE` column. Verify that one `log-agent` Pod appears on each node and that no node has two. This is the guarantee a DaemonSet provides.

```bash
kubectl get daemonset log-agent
```

The output shows `DESIRED`, `CURRENT`, `READY`, `UP-TO-DATE`, and `AVAILABLE`. `DESIRED` equals the number of nodes. There is no concept of "scale to 10" because the desired count is always derived from the node count.

:::warning
If a Pod fails to schedule on a specific node due to resource pressure or taints, the DaemonSet's `DESIRED` count will be higher than `CURRENT`. This looks like a stuck rollout. The Events section of `kubectl describe daemonset log-agent` will name the specific node and the reason the Pod could not be placed there.
:::

:::quiz
You describe a DaemonSet and see `DESIRED: 3` but `CURRENT: 2`. What does that indicate?

**Answer:** One Pod failed to schedule on one of the three nodes. The DaemonSet wants one Pod per node, so DESIRED equals the node count. A mismatch between DESIRED and CURRENT means at least one node is missing its Pod, usually because of a taint, resource constraint, or node not-ready condition. Check Events for the specific reason.
:::

Clean up before the next lesson:

```bash
kubectl delete daemonset log-agent
```

A DaemonSet is the right controller whenever the workload is node-scoped rather than replica-scoped: every node must run the thing, and no node should run more than one. The next lesson covers the most common real-world use cases and why they share this node-scoped requirement.
