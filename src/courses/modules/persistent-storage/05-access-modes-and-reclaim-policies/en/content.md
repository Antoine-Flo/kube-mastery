---
seoTitle: Kubernetes Access Modes and PV Reclaim Policies Explained
seoDescription: Explore the four Kubernetes PV access modes (RWO, ROX, RWX, RWOP) and three reclaim policies (Retain, Delete, Recycle) with full lifecycle details.
---

# Access Modes and Reclaim Policies

Two of the most consequential settings on any PersistentVolume are its **access mode** and its **reclaim policy**. Getting these right means understanding both how your workload uses storage (does it need to be shared? does it need to be writable from multiple places?) and what should happen to your data when you're done with it.

:::warning
Making the wrong choice here can lead to application failures that are surprisingly hard to diagnose, or, far worse, accidental data loss.
:::

## Access Modes

An access mode describes how many nodes can attach the volume, and whether they can write to it. There are currently four defined access modes in Kubernetes.

### ReadWriteOnce (RWO)

`ReadWriteOnce` is by far the most common access mode. It means the volume can be mounted in **read-write mode by a single node at a time**. It does not mean only one Pod can use it, if multiple Pods are scheduled on the same node and they all reference the same PVC, they can all write to it simultaneously (though you would almost never do this intentionally). The restriction is at the _node_ level, not the Pod level.

RWO is supported by virtually every storage backend: AWS Elastic Block Store, GCP Persistent Disk, Azure Disk, and most CSI drivers for local SSDs. It is the right choice for single-replica databases, stateful applications managed by StatefulSets (where each Pod gets its own PVC), and any workload where only one instance runs at a time.

The limitation appears at scale: if a Deployment with RWO storage scales to two replicas and those replicas land on different nodes, the second replica stays stuck in `ContainerCreating` indefinitely. The volume cannot be attached to two nodes at once, check `kubectl describe pod` for a `FailedAttachVolume` event.

### ReadOnlyMany (ROX)

`ReadOnlyMany` allows the volume to be mounted **read-only by multiple nodes simultaneously**. This is useful for distributing configuration files, static assets, or reference data that many Pods need to read but none need to modify, for example, a shared directory of SSL certificates or ML model files. Some storage backends that don't support simultaneous writes can still handle simultaneous reads, making ROX a reasonable option for those cases.

### ReadWriteMany (RWX)

`ReadWriteMany` is the mode that allows **multiple nodes to mount the volume in read-write mode at the same time**. This is what you need when multiple Pods across multiple nodes all need to read and write to the same shared filesystem, for example, a CMS where multiple web server pods write uploaded files to a shared directory, or a batch processing system where workers consume from a shared input queue stored on disk.

The critical thing to understand about RWX is that **most cloud block storage providers do not support it**. AWS EBS, GCP Persistent Disk, and Azure Disk are all block storage, they can only be attached to one node at a time at the hardware level. To get RWX, you need networked filesystem storage: NFS, CephFS, GlusterFS, Azure Files, AWS EFS, or similar solutions.

:::warning
Attempting to use an RWX access mode with a storage backend that only supports RWO will fail at the PVC binding stage. The PVC will remain in `Pending` because no eligible PV (or dynamically provisioned volume) can satisfy the `ReadWriteMany` requirement. Always confirm your StorageClass supports the access mode you need.
:::

### ReadWriteOncePod (RWOP)

Added in Kubernetes 1.22 and graduated to stable in 1.29, `ReadWriteOncePod` is a stricter version of RWO. Where RWO restricts the volume to a single _node_, RWOP restricts it to a single _Pod_ across the entire cluster. Only one Pod anywhere in the cluster can mount the volume read-write at a time.

This is particularly useful for workloads that must have exclusive, singleton access to storage, for example, a leader election pattern where you want to guarantee that even if two Pods somehow end up on the same node, only one can mount the volume. RWOP requires CSI driver support.

## Access Mode Summary

@@@
flowchart TD
    A[Volume Access Mode] --> B[ReadWriteOnce<br/>RWO]
    A --> C[ReadOnlyMany<br/>ROX]
    A --> D[ReadWriteMany<br/>RWX]
    A --> E[ReadWriteOncePod<br/>RWOP]

    B --> B1["✓ Single node, read-write<br/>✓ AWS EBS, GCP PD, Azure Disk<br/>✗ Cannot span multiple nodes"]
    C --> C1["✓ Multiple nodes, read-only<br/>✓ For shared config / static data<br/>✗ No writes from any node"]
    D --> D1["✓ Multiple nodes, read-write<br/>✓ Requires NFS, CephFS, EFS<br/>✗ Not supported by block storage"]
    E --> E1["✓ Single Pod, read-write<br/>✓ Strongest exclusivity guarantee<br/>✓ Requires CSI driver support"]
@@@

## Reclaim Policies

The reclaim policy answers a simple but critical question: **what happens to the PV and its data when the PVC is deleted?**

This is one of the most operationally important settings in Kubernetes storage. Getting it wrong in a production cluster can mean either losing data you needed to keep, or accumulating orphaned volumes that quietly inflate your cloud storage bill.

### Retain

With the `Retain` policy, when a PVC is deleted the PV moves to `Released` state, the PV object still exists, and the data on the underlying storage is completely untouched. Nothing is automatically deleted.

However, a `Released` PV **cannot be automatically claimed by a new PVC**. Even though the data is there and the PV object exists, the PV carries a `claimRef` field pointing to the old (now deleted) PVC. Kubernetes will not bind it to a new PVC until an administrator explicitly clears that reference.

To manually reclaim a `Retain` PV and make it available for a new PVC, you would:

1. Inspect the PV data to make sure you don't need it: `kubectl describe pv <name>`
2. Delete the underlying storage data if appropriate (this depends on your storage backend)
3. Edit the PV to remove the `claimRef`: `kubectl patch pv <name> -p '{"spec":{"claimRef": null}}'`
4. The PV's status will revert to `Available` and it can be bound again

`Retain` is the safest option for databases, user data, financial records, or anything where accidental deletion would be catastrophic.

### Delete

With the `Delete` policy, when a PVC is deleted, Kubernetes automatically deletes the PV _and_ calls the underlying storage provider's API to delete the actual storage resource, the cloud disk, the NFS export, the Ceph volume, whatever it is.

`Delete` is the default reclaim policy for dynamically provisioned PVs in most cloud environments. It makes sense there because the cloud disk was created specifically for this PVC, there is no pre-existing data to worry about, and cleaning up automatically prevents orphaned resources from accumulating. The danger is obvious: if a developer accidentally runs `kubectl delete pvc my-database-pvc`, the storage is gone permanently. There is no recycle bin.

:::warning
In production environments with critical data, consider changing the default StorageClass's reclaim policy from `Delete` to `Retain`. This gives you a safety net even with dynamic provisioning. You can override the policy by patching an existing PV after it's created: `kubectl patch pv <name> -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'`
:::

### Recycle (Deprecated)

The `Recycle` policy used to perform a basic scrub of the volume, running the equivalent of `rm -rf /volume/*`, and then reset the PV to `Available` so it could be bound to a new PVC. This approach was deprecated in Kubernetes 1.11 and is no longer recommended. It is too blunt an instrument (you can't customize the scrubbing behavior) and dynamic provisioning handles the use case much better.

## The Released-to-Available Journey

Understanding the full lifecycle of a PV is important for troubleshooting. When you delete a PVC that was bound to a PV with a `Retain` policy, the PV moves to `Released`. If you then try to create a new PVC that matches this PV's characteristics, the new PVC will stay in `Pending`, because the PV is `Released`, not `Available`. This is a surprisingly common source of confusion.

@@@
stateDiagram-v2
    [*] --> Available : PV created
    Available --> Bound : PVC bound
    Bound --> Released : PVC deleted
    Released --> Available : Admin clears claimRef<br/>(Retain policy)
    Released --> [*] : PV and storage deleted<br/>(Delete policy)
    Bound --> [*] : PV deleted<br/>while bound<br/>(rare / forced)
@@@

## Hands-On Practice

In this exercise you'll observe the reclaim policy in action by creating a PV with `Retain`, binding it, deleting the PVC, and then watching the PV move to `Released` state.

**Step 1: Create a PV with Retain policy**

```yaml
# retain-pv-persistentvolume.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: retain-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /tmp/retain-test
```

```bash
kubectl apply -f retain-pv-persistentvolume.yaml
```

**Step 2: Create and bind a PVC**

```yaml
# retain-pvc-persistentvolumeclaim.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: retain-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: manual
```

```bash
kubectl apply -f retain-pvc-persistentvolumeclaim.yaml

kubectl get pv retain-pv
```

Expected output:

```
NAME        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM              STORAGECLASS   AGE
retain-pv   1Gi        RWO            Retain           Bound    default/retain-pvc manual         10s
```

**Step 3: Delete the PVC and observe the PV**

```bash
kubectl delete pvc retain-pvc
kubectl get pv retain-pv
```

Expected output:

```
NAME        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS     CLAIM              STORAGECLASS   AGE
retain-pv   1Gi        RWO            Retain           Released   default/retain-pvc manual         30s
```

The PV is now `Released`. The CLAIM column still shows the old PVC's name (the `claimRef` is still set). The data on `/tmp/retain-test` on the node is intact.

**Step 4: Try to create a new PVC that would match**

```yaml
# new-pvc-persistentvolumeclaim.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: new-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: manual
```

```bash
kubectl apply -f new-pvc-persistentvolumeclaim.yaml

kubectl get pvc new-pvc
```

Expected output:

```
NAME      STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
new-pvc   Pending                                      manual         5s
```

The new PVC is stuck in `Pending` because `retain-pv` is `Released`, not `Available`.

**Step 5: Manually reclaim the PV**

```bash
kubectl patch pv retain-pv -p '{"spec":{"claimRef": null}}'
kubectl get pv retain-pv
```

Expected output:

```
NAME        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM   STORAGECLASS   AGE
retain-pv   1Gi        RWO            Retain           Available           manual         2m
```

The PV is `Available` again. Wait a few seconds and check the new PVC:

```bash
kubectl get pvc new-pvc
```

Expected output:

```
NAME      STATUS   VOLUME      CAPACITY   ACCESS MODES   STORAGECLASS   AGE
new-pvc   Bound    retain-pv   1Gi        RWO            manual         30s
```

The new PVC is now bound. Clean up:

```bash
kubectl delete pvc new-pvc
kubectl delete pv retain-pv
```
