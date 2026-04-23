---
seoTitle: 'kube-scheduler Internals, Scheduling Cycle, Filter, Score, Bind'
seoDescription: 'Understand how kube-scheduler finds unscheduled Pods, filters candidate nodes, scores them, and commits the placement decision through the bind phase.'
---

# kube-scheduler Internals

You already know the scheduler's outcome: it writes a node name into an unscheduled Pod's `nodeName` field. This lesson is about the machinery behind that decision, the sequence of phases every Pod passes through before the scheduler commits its choice, and the failure patterns that leave Pods stuck in `Pending` indefinitely.

```bash
kubectl get pods -n kube-system
```

Find the Pod named `kube-scheduler-sim-control-plane`. Like the API server and etcd, it runs as a static Pod on the control plane node.

## How the scheduler finds work

The scheduler holds a watch on all Pods. When a Pod arrives with an empty `nodeName`, the scheduler adds it to its internal scheduling queue. This queue is not a simple FIFO list. It applies a priority order based on PriorityClass if one is set, placing higher-priority Pods at the front.

@@@
graph TB
W["Watch: Pod with no nodeName"]
Q["Scheduling queue\n(priority-ordered)"]
CY["Scheduling cycle\nper Pod"]
FILT["Filter phase\nEliminate unfit nodes"]
SCORE["Score phase\nRank remaining nodes"]
BIND["Bind phase\nWrite nodeName to API server"]
W --> Q --> CY --> FILT --> SCORE --> BIND
@@@

The scheduler processes one Pod at a time through a scheduling cycle. Each cycle is independent: the result for Pod A does not affect the filtering for Pod B, except that node resources reserved by already-scheduled Pods are taken into account.

## Filter: eliminating unfit nodes

The filter phase runs a set of plugins against every node in the cluster. A node that fails any plugin is eliminated from consideration. The Pod will not land there.

The most common filter plugins and the problems they catch:

`NodeResourcesFit` checks whether the node has enough allocatable CPU and memory for the Pod's requests. If you set `resources.requests.cpu: 4000m` on a 2-core node, that node is filtered out immediately.

`NodeAffinity` checks `nodeSelector` and `nodeAffinity` rules. If the Pod requires a node labeled `disk=ssd` and no such node exists, every node is filtered out and the Pod stays `Pending`.

`TaintToleration` checks whether the Pod tolerates the taints on each node. A node tainted `NoSchedule` removes itself from the candidate list for any Pod that does not declare the matching toleration.

:::warning
If the filter phase eliminates every node, the Pod stays `Pending` and no error appears in the Pod's status. The Events section of `kubectl describe pod` shows `0/N nodes are available`, followed by the reason: insufficient memory, node affinity mismatch, or taint. Read the Events carefully. `Pending` alone tells you nothing about which filter rejected every candidate.
:::

```bash
kubectl get pods
```

If you see a Pod in `Pending`, describe it to read the scheduler's reasoning:

```bash
kubectl describe pod <pending-pod-name>
```

The Events section at the bottom of the output contains the scheduler's message. It names the specific filter that eliminated the available nodes.

:::quiz
A Pod has been `Pending` for several minutes. `kubectl describe pod` shows the event `0/3 nodes are available: 3 Insufficient cpu`. What does this mean?

**Answer:** All three nodes have less allocatable CPU remaining than the Pod's `resources.requests.cpu` specifies. The NodeResourcesFit filter eliminated every node. The Pod will stay `Pending` until a node has enough free CPU, which means either a currently running Pod is deleted or a new node is added.
:::

## Score: ranking what remains

After filtering, the scheduler scores the surviving nodes using a second set of plugins. Each plugin assigns a number between 0 and 100. Scores from all plugins are combined using configurable weights, and the node with the highest total wins.

The default scoring behavior leans toward spreading load. `LeastAllocated` gives higher scores to nodes with more free resources, pushing Pods to less-loaded nodes rather than piling them on the same machine. `NodeAffinity` adds bonus points to nodes matching preferred affinity rules, without eliminating nodes that do not match.

Why separate filtering from scoring instead of doing a combined pass? Because filtering is a binary decision and can short-circuit: once a node fails a required check, no further computation is needed for it. Scoring is only worthwhile on nodes that already passed all requirements. Separating the phases keeps the algorithm efficient on large clusters.

:::quiz
Two nodes both pass the filter phase. Node A has 30% free CPU. Node B has 70% free CPU. Using default scoring, which node is more likely to receive the new Pod?

**Answer:** Node B. The LeastAllocated scoring plugin gives higher scores to nodes with more remaining capacity. The scheduler tends to spread load rather than stack it.
:::

## Bind: committing the decision

Once a winning node is selected, the scheduler performs the bind phase: it sends a `Bind` request to the API server, writing the chosen node's name into the Pod's `nodeName` field. At that point, the scheduler's job is done. It releases the Pod from its queue and moves to the next one.

The kubelet on the selected node picks up the assignment from its own watch stream and begins pulling images and starting containers. The scheduler is already running the next scheduling cycle.

```bash
kubectl logs kube-scheduler-sim-control-plane -n kube-system
```

In the logs you will see lines like `Successfully assigned default/web to sim-worker`. Each line represents a completed bind. If the scheduler is struggling, you will see repeated `Preempting` messages, indicating high-priority Pods are displacing lower-priority ones to free up capacity.

The scheduling cycle is fast, typically a few milliseconds per Pod under normal conditions. At scale, the filter and score phases run against hundreds of nodes simultaneously. The architecture is designed so that adding nodes increases the cluster's capacity without slowing down scheduling linearly.
