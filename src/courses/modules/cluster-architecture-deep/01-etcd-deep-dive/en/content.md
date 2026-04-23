---
seoTitle: 'etcd Deep Dive, Raft Consensus, Kubernetes Keyspace, Watch API'
seoDescription: 'Understand how etcd stores Kubernetes objects, how Raft consensus guarantees consistency, how the watch mechanism drives controllers, and what compaction does.'
---

# etcd Deep Dive

You already know that etcd is the cluster's storage layer and that only the API server writes to it. That is the what. This lesson is about the how: why etcd can lose a node and keep working, how Kubernetes objects are actually laid out on disk, and how a write to etcd causes a chain reaction that eventually starts a container.

Start by finding the etcd Pod:

```bash
kubectl get pods -n kube-system
```

Look for a Pod named `etcd-sim-control-plane`. It runs on the control plane node alongside the API server, scheduler, and controller manager, all as static Pods.

## Why three nodes, why not two

Kubernetes documentation tells you to run etcd with an odd number of members, typically three or five. The reason is not redundancy, it is quorum.

etcd uses Raft, a consensus algorithm that requires a majority agreement before any write is accepted. With three members, a majority is two. The cluster tolerates the loss of one node and keeps accepting writes. With two members, a majority is also two, meaning both must be available. Losing one of two is identical to losing all quorum. Two-member clusters are strictly worse than one-member clusters for fault tolerance.

@@@
graph LR
subgraph three [3-member cluster]
  A1["etcd-0\nleader"] --> A2["etcd-1"]
  A1 --> A3["etcd-2"]
  note1["Quorum = 2\nTolerates 1 failure"]
end
subgraph five [5-member cluster]
  B1["etcd-0\nleader"] --> B2["etcd-1"]
  B1 --> B3["etcd-2"]
  B1 --> B4["etcd-3"]
  B1 --> B5["etcd-4"]
  note2["Quorum = 3\nTolerates 2 failures"]
end
@@@

Every write must be acknowledged by a quorum of members before the leader considers it committed. The leader then appends the entry to its log and notifies followers to do the same. Followers confirm. If the leader crashes before a quorum confirms, the write is rolled back and no data is lost. Consistency is never sacrificed for availability.

:::quiz
An etcd cluster has 5 members. How many can fail before the cluster stops accepting writes?

**Answer:** Two. Quorum for 5 members is 3. Losing 2 still leaves 3 available, which is enough for a majority. Losing 3 reduces the available count to 2, which is below quorum, and etcd halts writes rather than risk split-brain.
:::

## How Kubernetes objects are stored

etcd is a flat key-value store. There are no tables, no schemas, no foreign keys. Every Kubernetes object is serialized to a binary format called protocol buffers and stored under a path in the keyspace.

The structure follows a predictable convention:

```
/registry/<group>/<kind>/<namespace>/<name>
```

A Pod named `web` in the `default` namespace becomes `/registry/pods/default/web`. A ClusterRole named `cluster-admin` (which is not namespaced) becomes `/registry/clusterroles/cluster-admin`. Every object, every type, follows this layout.

Why does this matter for CKA? Because when you take an etcd snapshot with `etcdctl snapshot save`, you are saving the entire contents of this keyspace, every object in the cluster, as a single file. Restoring from that snapshot brings the entire cluster state back to the moment of the backup. Understanding the keyspace structure helps you understand why a full snapshot is a full backup.

:::quiz
You restore an etcd snapshot taken 10 minutes ago. What happens to a Deployment created 5 minutes ago?

**Answer:** It disappears. The restore replaces the entire keyspace with the snapshot contents. Any object created after the snapshot was taken is gone. This is why backup frequency matters and why critical operations should be preceded by a fresh snapshot.
:::

## The watch mechanism

When you run `kubectl get pods -w`, your terminal waits indefinitely for new output. Behind the scenes, kubectl is holding an open HTTP connection to the API server with a query parameter `watch=true`. The API server in turn holds a watch on the etcd key range for pods. When any pod changes, etcd sends an event to the API server, which forwards it to every active watcher.

This same mechanism drives all controllers. The scheduler does not poll the API server every second looking for unscheduled Pods. It holds a watch on the Pods keyspace and receives an event the moment a Pod with an empty `nodeName` appears. The controller manager watches Deployments, ReplicaSets, Nodes, and dozens of other resources. Every reconciliation is triggered by a watch event, not a timer.

@@@
graph LR
E["etcd\nwatch stream"]
A["API server\nwatch aggregator"]
S["kube-scheduler\nwatching Pods"]
CM["kube-controller-manager\nwatching Deployments, RS"]
KW["kubectl get pods -w\nwatching Pods"]
E --> A
A --> S
A --> CM
A --> KW
@@@

```bash
kubectl get pods -w
```

Open this in the terminal and leave it running while you work in the next lessons. Every Pod state change in the simulated cluster will appear here in real time.

## Compaction and defragmentation

etcd keeps every version of every key, not just the current one. This supports the watch mechanism: a client that disconnects and reconnects can request all events since a specific revision number, not just the most recent state. But it also means the keyspace grows indefinitely.

Compaction removes historical revisions up to a given point, keeping only the current version of each key. Defragmentation reclaims the disk space freed by compaction. On a busy cluster, these are periodic maintenance tasks. Kubernetes runs auto-compaction by default, but manual defragmentation is sometimes needed after large-scale deletes, like removing hundreds of completed Jobs.

:::warning
Defragmentation locks etcd briefly while it rewrites the database. On a single-node etcd, this blocks the API server and causes a short write pause. On a three-node cluster, you defragment one member at a time to keep the others available. Triggering defragmentation during a high-traffic window is a common cause of unexpected API server unresponsiveness.
:::

etcd is the substrate everything else depends on. The watch stream it provides is what turns a passive storage system into an active event bus that drives the entire cluster toward its desired state.
