---
seoTitle: 'kube-controller-manager Internals, Control Loop, Informers, Work Queue'
seoDescription: 'Understand how the kube-controller-manager runs dozens of independent control loops, how informers cache cluster state, and how work queues prevent thundering herds.'
---

# kube-controller-manager Internals

You already know that controllers run control loops: compare desired state to actual state, then reconcile. This lesson goes inside that loop to show how it actually executes, why it does not pound etcd on every cycle, and what happens when a node disappears from the cluster.

```bash
kubectl get pods -n kube-system
```

Find `kube-controller-manager-sim-control-plane`. It is a single process running dozens of controllers simultaneously, each watching its own slice of the API and each operating independently.

## The informer pattern

A naive control loop would call the API server on every iteration: "give me all Deployments, compare, act, repeat." On a cluster with thousands of objects, that would produce constant load. Instead, every controller uses an informer.

@@@
graph TB
API["API server\nwatch stream"]
IC["Informer cache\n(in-memory store)"]
EH["Event handlers\nAdded / Updated / Deleted"]
WQ["Work queue\n(deduplicating)"]
REC["reconcile(key)\ncompare + act"]
API -->|"list then watch"| IC
IC --> EH
EH --> WQ
WQ --> REC
REC -->|"re-enqueue if needed"| WQ
@@@

An informer starts with a full list of the resource it watches, then switches to a watch stream to receive incremental events. The full object state lives in the informer's local cache. A controller never reads from the API server during reconciliation. It reads from the cache. Only writes go to the API server.

When an event arrives (a Deployment was updated, a Pod was deleted), the informer calls the registered event handlers, which add a key to a work queue. The key is typically `namespace/name`. The reconcile function picks up the key, reads the current state from the cache, reads the desired state from the same cache, computes the diff, and acts.

## The work queue and why it deduplicates

The work queue has one critical property: if the same key is added multiple times before the reconciler processes it, it appears only once in the queue. This prevents thundering herd scenarios where a burst of rapid updates causes the reconciler to run hundreds of times for the same object.

Consider a Deployment being updated five times in quick succession. Without deduplication, the reconciler might try to process five intermediate states. With deduplication, it processes only the final state, which is the only one that matters.

:::quiz
A Deployment is scaled from 2 to 3 replicas. Before the Deployment controller processes the change, the Deployment is scaled again to 5 replicas. How many times does the reconciler run for this Deployment?

**Answer:** Once. The work queue deduplicates events by key. Both changes add the same `default/my-deployment` key. The reconciler processes the final desired state (5 replicas) and creates 3 Pods from scratch, skipping the intermediate 3-replica state entirely.
:::

## Inside the Deployment controller

The Deployment controller watches Deployments and ReplicaSets. When a Deployment's Pod template changes (a new image, a new env var), the reconciler does the following:

1. Read the Deployment spec from the informer cache.
2. List owned ReplicaSets (those with the Deployment's UID in `ownerReferences`).
3. Create a new ReplicaSet matching the new template hash.
4. Begin scaling up the new ReplicaSet and scaling down the old one, respecting `maxUnavailable` and `maxSurge`.
5. Update the Deployment's status to reflect progress.

The controller does not start containers. It creates and scales ReplicaSets. The ReplicaSet controller then creates Pods. Each controller owns exactly one type of resource and delegates everything else downstream.

```bash
kubectl logs kube-controller-manager-sim-control-plane -n kube-system
```

During a rolling update you will see log lines from the `deployment-controller` and `replicaset-controller` alternating as they coordinate the transition.

:::quiz
You change the image on a Deployment. What does the Deployment controller do first?

- Delete all existing Pods immediately
- Scale the old ReplicaSet to zero, then create a new one
- Create a new ReplicaSet with the new template hash, then begin the rolling transition

**Answer:** Create a new ReplicaSet first. The old ReplicaSet is scaled down gradually. Rolling updates maintain Pod availability during the transition. Deleting all Pods first would cause downtime, which is exactly what Deployments are designed to prevent.
:::

## The Node lifecycle controller

One of the most consequential controllers in the cluster is the Node lifecycle controller. It watches the `Ready` condition reported by each kubelet. When a node stops sending heartbeats, the controller progresses through a deliberate sequence.

After roughly 40 seconds without a heartbeat, the node's `Ready` condition transitions to `Unknown`. The Node lifecycle controller then adds a `node.kubernetes.io/not-ready:NoSchedule` taint to the node, preventing new Pods from being placed there.

If the node stays unavailable beyond the eviction timeout (five minutes by default), the controller adds a `NoExecute` taint with a grace period. Pods without a matching toleration are evicted and rescheduled on healthy nodes.

:::warning
These timers exist to prevent premature eviction during transient network blips. A node that recovers within two minutes will have its taint removed and its Pods restored. Shortening the eviction timeout speeds up recovery but increases the risk of unnecessary rescheduling during brief connectivity losses.
:::

```bash
kubectl describe node sim-worker
```

Look at the `Taints` field. On a healthy node it will be empty or show only user-defined taints. If the node was temporarily unavailable, you may see the system-managed `node.kubernetes.io/not-ready` taint still present.

The kube-controller-manager is not a passive bookkeeper. It is an active reconciler that continuously drives the cluster toward its declared state, one work queue entry at a time.
