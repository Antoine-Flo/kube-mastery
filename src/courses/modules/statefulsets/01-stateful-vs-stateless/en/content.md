---
seoTitle: 'Kubernetes Stateful vs Stateless, Why StatefulSets Exist'
seoDescription: 'Learn the difference between stateless and stateful Kubernetes workloads, why Deployments are insufficient for databases and distributed systems, and what StatefulSets provide.'
---

# Stateful vs Stateless

A web server stores nothing on disk. Each request comes in, is handled, and the response goes out. If you scale to 5 replicas, any request can go to any replica. If a replica crashes and is replaced, the new one starts fresh and serves requests immediately. This is a stateless workload.

A database stores everything on disk. Each instance in a cluster has its own data files. Replicas are not interchangeable: one is the primary, others are secondaries. When a secondary restarts, it must reconnect to the primary using a stable hostname, not a random one. This is a stateful workload.

Deployments handle stateless workloads well. They fail for stateful workloads because they provide no stable identity, no stable storage, and no ordered lifecycle.

## What Deployments cannot provide

@@@
graph TB
subgraph dep ["Deployment (stateless)"]
  P1["pod-abc123\nIP: 10.0.0.1"] --> R["Dies"]
  R --> P2["pod-xyz789\n(new random name)\nIP: 10.0.0.2"]
  note1["New name\nNew IP\nCan't be addressed\ndirectly"]
end
subgraph sts ["StatefulSet (stateful)"]
  S1["mysql-0\nStable IP via headless service"] --> RS["Dies"]
  RS --> S2["mysql-0\n(same name, same storage)"]
  note2["Same name\nSame PVC\nHeadless DNS:\nmysql-0.mysql-headless"]
end
@@@

**Stable network identity**: a Deployment Pod's name changes on restart (`pod-abc123` becomes `pod-xyz789`). A StatefulSet Pod retains its name (`mysql-0` always stays `mysql-0`). Other members of a distributed system can address it by a stable DNS name.

**Stable persistent storage**: a Deployment's PVC is shared or per-deployment. A StatefulSet creates a dedicated PVC per Pod. When `mysql-0` is deleted and recreated, it gets back the same PVC with its data intact.

**Ordered lifecycle**: a Deployment starts all replicas in any order, simultaneously. A StatefulSet starts Pods in sequence: `mysql-0` must be Running before `mysql-1` starts. Deletes happen in reverse order: `mysql-2` is deleted before `mysql-1`.

## When to use a StatefulSet

Use a StatefulSet when:
- The workload has per-instance data that must persist across restarts
- Instances must communicate with specific peers by stable hostname
- The startup order matters (primary must start before secondaries)
- The storage must not be shared between instances

Common examples:
- Relational databases (MySQL, PostgreSQL clusters)
- NoSQL databases (Cassandra, MongoDB replica sets)
- Message queues with per-instance data (Kafka brokers)
- Distributed coordination services (ZooKeeper, etcd instances in a new cluster)

:::quiz
A Redis Sentinel deployment requires that each Redis node can be reached by a stable hostname by the other Sentinel nodes. Why is a Deployment insufficient?

**Answer:** Deployment Pods get random names and random IPs that change on restart. A Redis Sentinel node that saves the address of a peer will lose contact if that peer restarts, because the new Pod has a different name and IP. StatefulSet Pods keep their names (`redis-0`, `redis-1`) and the headless service provides stable DNS entries (`redis-0.redis-headless.namespace.svc.cluster.local`). After a restart, `redis-0` is reachable at the same DNS name.
:::

## What StatefulSets guarantee

A StatefulSet provides three guarantees:
1. **Stable Pod names**: `<name>-0`, `<name>-1`, up to `<name>-(N-1)`
2. **Stable DNS**: paired with a headless Service, each Pod gets a DNS record that survives restarts
3. **Stable storage**: each Pod gets a dedicated PVC that is not deleted when the Pod is deleted

These three guarantees together solve the problems that make distributed databases impossible to run reliably with Deployments.

:::warning
StatefulSets are more complex to operate than Deployments. Scaling down does not automatically delete PVCs (to prevent data loss). Deleting a StatefulSet does not delete its PVCs. You must manually manage PVC cleanup. This is intentional: Kubernetes errs on the side of data safety for stateful workloads.
:::

:::quiz
You scale a StatefulSet down from 3 to 1 replica. The 2 deleted Pods had dedicated PVCs. Are the PVCs deleted?

**Answer:** No. StatefulSet scale-down does not delete PVCs. The PVCs are retained so that if you scale back up to 3, the Pods get back their original data. Manual PVC deletion is required if you actually want to reclaim the storage. Check with `kubectl get pvc` after scaling down to see the retained PVCs.
:::

Stateful workloads require stable identity, stable storage, and ordered lifecycle. Deployments provide none of these. StatefulSets provide all three. The next lesson covers the mechanics of creating and operating a StatefulSet.
