# Creating a PersistentVolume

Now that you understand what PVs and PVCs are, let's create one. A PersistentVolume is a cluster-level resource — it doesn't belong to any namespace. An administrator (or an automated provisioner) creates it to make storage available for users to claim.

## What Goes into a PV Spec

A PV definition tells Kubernetes about a piece of storage: how big it is, how it can be accessed, and what backend it uses. The key fields are:

- **capacity:** How much storage (e.g., `10Gi`)
- **accessModes:** How it can be mounted (`ReadWriteOnce`, `ReadOnlyMany`, `ReadWriteMany`)
- **persistentVolumeReclaimPolicy:** What happens when the PVC is deleted (`Retain` or `Delete`)
- **storageClassName:** Groups PVs into classes; PVCs reference this to find matching PVs
- **Volume backend:** The actual storage: `hostPath`, `nfs`, `awsElasticBlockStore`, `csi`, etc.

## Example: hostPath PV (Development)

The simplest PV uses `hostPath` — a directory on the node's filesystem. This is perfect for learning and single-node clusters, but should never be used in production multi-node environments (because the data only exists on one node):

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-hostpath-demo
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/pv-data
    type: DirectoryOrCreate
```

The `DirectoryOrCreate` type tells Kubernetes to create the directory if it doesn't exist. The `storageClassName: manual` is an arbitrary name — PVCs will need to specify the same class to bind to this PV.

:::warning
`hostPath` PVs are tied to a single node. If a Pod using this PV gets scheduled to a different node, it won't find the data. Use `hostPath` only for local development or single-node clusters. In production, use NFS, cloud block storage, or CSI drivers.
:::

## Example: NFS PV (Production-Ready)

NFS (Network File System) is a common choice for shared storage. Multiple Pods on different nodes can mount the same NFS export, which makes it one of the few backends that supports `ReadWriteMany`:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-nfs-demo
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: nfs-server.example.com
    path: /exports/data
```

No `storageClassName` is set here, so this PV can only be bound by PVCs that also omit the class (or explicitly set it to `""`).

A freshly created PV has status `Available` — it's waiting for a matching PVC. Once bound, the status changes to `Bound` and shows which PVC it's connected to.

:::info
PVs are **cluster-scoped** resources — they don't belong to any namespace. PVCs, on the other hand, are namespaced. This means a PV can be bound by a PVC from any namespace (unless restricted by labels or selectors).
:::

## Choosing a Reclaim Policy

The reclaim policy determines what happens to the PV after the PVC that was using it is deleted:

- **Retain:** The PV keeps its data and moves to a `Released` state. An admin must manually clean up the data and make the PV available again. This is the safe choice for important data.
- **Delete:** The PV and its underlying storage are automatically deleted. This is common with dynamic provisioning, where storage is treated as disposable.
- **Recycle:** Deprecated. Was equivalent to `rm -rf` on the volume. Don't use it.

For manually created PVs containing important data, always use `Retain`. For dynamically provisioned volumes in development environments, `Delete` keeps things clean.

## Troubleshooting

**PV stuck in Available:** No PVC has matched it yet. Check that a PVC exists with matching capacity, access modes, and StorageClass.

**hostPath not found:** The directory doesn't exist on the node. Use `type: DirectoryOrCreate` to let Kubernetes create it, or ensure the path exists before creating the PV.

**Binding fails:** The PVC's requirements don't match any PV. Common mismatches: access modes (PVC asks for RWX but PV only supports RWO), capacity (PVC asks for more than the PV offers), or StorageClass mismatch.

---

## Hands-On Practice

### Step 1: Create a PersistentVolume manifest

```bash
nano my-pv.yaml
```

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /tmp/my-pv-data
    type: DirectoryOrCreate
```

```bash
kubectl apply -f my-pv.yaml
```

### Step 2: Verify the PV was created

```bash
kubectl get pv
```

You should see `my-pv` with status `Available`.

### Step 3: Inspect the PV

```bash
kubectl describe pv my-pv
```

Check the capacity, access modes, and reclaim policy.

### Step 4: Clean up

```bash
kubectl delete pv my-pv
```

## Wrapping Up

Creating a PV makes storage available for users to claim. In development, `hostPath` is quick and easy. In production, use network storage like NFS or cloud block storage via CSI drivers. Always consider the reclaim policy — `Retain` for data you care about, `Delete` for disposable storage. In the next lesson, we'll create a PVC to claim this storage and mount it in a Pod.
