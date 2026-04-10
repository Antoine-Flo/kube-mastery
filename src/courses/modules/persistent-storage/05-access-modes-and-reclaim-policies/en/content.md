---
seoTitle: Kubernetes Access Modes and PV Reclaim Policies Explained
seoDescription: Explore the four Kubernetes PV access modes (RWO, ROX, RWX, RWOP) and three reclaim policies (Retain, Delete, Recycle) with full lifecycle details.
---

# Access Modes and Reclaim Policies

Before provisioning storage for a real workload, you face two decisions that shape how the storage behaves under load and what happens at cleanup time. The first decision is the access mode: who can mount this volume and how many nodes can do so simultaneously. The second is the reclaim policy: what happens to the data when the PVC that owns the volume is deleted.

Getting these choices wrong is one of the most common causes of `Pending` Pods and accidental data loss in production clusters.

## The Four Access Modes

@@@
graph TD
    RWO["ReadWriteOnce\nRWO\none node, read-write"]
    ROX["ReadOnlyMany\nROX\nmany nodes, read-only"]
    RWX["ReadWriteMany\nRWX\nmany nodes, read-write"]
    RWOP["ReadWriteOncePod\nRWOP\none Pod only, read-write"]
@@@

`ReadWriteOnce` is the most common mode. A single node can mount the volume for both reading and writing. Multiple Pods running on the same node can share it, but Pods on different nodes cannot. This is the right choice for databases, queues, and any workload that runs as a single writer on one node.

`ReadOnlyMany` allows many nodes to mount the volume simultaneously, but only for reading. This is useful when you want to distribute static assets, configuration files, or datasets across a fleet of Pods without risking conflicting writes.

`ReadWriteMany` allows many nodes to mount the volume for both reading and writing at the same time. This requires a backend specifically designed for concurrent access, such as NFS or CephFS. Standard cloud block devices like AWS EBS and GCP Persistent Disk do not support this mode.

`ReadWriteOncePod` is the strictest option. Introduced in Kubernetes 1.22, it restricts access to a single Pod, not just a single node. Even if two Pods share the same node, only one can hold this mount. Use it when your application requires absolute write exclusivity and you want the cluster to enforce it, not just rely on application-level locking.

:::warning
Access modes are enforced by Kubernetes but ultimately constrained by the storage backend. A `hostPath` volume in the simulator supports `ReadWriteOnce`. Real cloud disks have hard limits at the hardware and driver level: AWS EBS only supports `ReadWriteOnce`, while NFS natively supports `ReadWriteMany`. Declaring `ReadWriteMany` on a backend that does not support it results in a binding error or a Pod stuck in `Pending` with a mount failure.
:::

To check access modes on existing PVs in the simulated cluster:

```
kubectl get pv
```

The `ACCESS MODES` column uses abbreviations: `RWO` for ReadWriteOnce, `ROX` for ReadOnlyMany, `RWX` for ReadWriteMany, and `RWOP` for ReadWriteOncePod.

:::quiz
You have a Deployment with 3 replicas spread across 3 different nodes. Each replica needs to write to the same shared directory. Which access mode must the PV support?

- ReadWriteOnce, because only one node writes at a time
- ReadWriteMany, because multiple nodes need simultaneous write access
- ReadOnlyMany, because reads are more frequent than writes

**Answer:** ReadWriteMany, because all three replicas on different nodes need simultaneous write access. ReadWriteOnce would let the first Pod mount successfully and leave the other two in Pending.
:::

## The Three Reclaim Policies

When a PVC is deleted, Kubernetes looks at the bound PV's `persistentVolumeReclaimPolicy` to decide what to do with the volume.

@@@
graph LR
    Bound["PV Bound"] --> PVCDeleted["PVC deleted"]
    PVCDeleted --> Retain["Retain\nPV stays Released\ndata preserved\nadmin must act"]
    PVCDeleted --> Delete["Delete\nPV object removed\nunderlying storage destroyed"]
    PVCDeleted --> Recycle["Recycle\ndeprecated\ndo not use"]
@@@

`Retain` is the safest option. When the PVC is deleted, the PV moves to `Released` and stays there. The data on disk is completely untouched. An administrator must review the data, clean it up if needed, and manually remove the `claimRef` from the PV before it can accept a new claim. Use `Retain` for production databases and any data you cannot afford to lose.

`Delete` is the most convenient option for ephemeral or easily reproduced workloads. When the PVC is deleted, Kubernetes also deletes the PV object and sends a delete request to the underlying storage backend. The volume, the data, everything is gone. This is the default policy for most dynamically provisioned PVs.

`Recycle` was designed to wipe the volume content and return the PV to `Available`. It has been deprecated since Kubernetes 1.11 and should not be used in new configurations. Prefer `Retain` when you need reuse with safety, or `Delete` when you need automatic cleanup.

Why did Kubernetes deprecate `Recycle` rather than keeping it? Because the wipe operation was a simple `rm -rf`, which is not safe or sufficient for all storage backends. Dynamic provisioning with `Delete` is a cleaner and more general solution that delegates the cleanup to the storage backend itself.

:::quiz
A production database PVC is deleted by mistake. The PV reclaim policy is `Retain`. What is the state of the data?

**Answer:** The data is safe. The PV is in `Released` state and the underlying storage is untouched. An admin must remove the `claimRef` to make the PV available again, and the data can be recovered by rebinding a new PVC to the same PV.
:::

## Choosing the Right Combination

For a production database, `ReadWriteOnce` plus `Retain` is the standard choice. The single-writer access mode matches the database's own requirements, and the retain policy ensures that an accidental PVC deletion does not destroy months of data.

For a cache or a feature flag store that can be rebuilt from scratch, `ReadWriteOnce` plus `Delete` is simpler to operate. When the workload is gone, the storage is cleaned up automatically with no admin intervention.

To change the reclaim policy on an existing PV:

```
kubectl patch pv postgres-pv -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'
```

Verify the change took effect:

```
kubectl get pv postgres-pv
```

:::info
The access mode declared in the PVC must be a subset of the modes listed by the PV. If the PV lists `ReadWriteOnce` and the PVC requests `ReadWriteMany`, the control plane rejects the binding and the PVC stays `Pending`. This check happens at bind time, not at Pod creation time.
:::

Access modes and reclaim policies are the two settings that determine how safe and how convenient your storage is to operate. Choosing them thoughtfully before provisioning avoids the most common categories of storage-related incidents in Kubernetes clusters.
