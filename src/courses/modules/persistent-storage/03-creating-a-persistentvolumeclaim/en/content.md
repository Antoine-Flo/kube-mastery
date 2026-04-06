---
seoTitle: Create a Kubernetes PersistentVolumeClaim, Binding Process
seoDescription: Learn how to write a Kubernetes PersistentVolumeClaim, understand the binding algorithm, diagnose pending PVCs, and see how dynamic provisioning works.
---

# Creating a PersistentVolumeClaim

With a PersistentVolume in place, the next step is to claim it. This is where the application developer enters the picture. The PersistentVolumeClaim is the object that bridges the gap between the abstract storage resource an administrator has provisioned and the concrete storage need an application has. Writing a PVC does not require knowing which specific volume you'll get, you simply describe what you need, and Kubernetes finds a match.

## PVCs Are Namespaced

Unlike PersistentVolumes, which live at the cluster level, a PersistentVolumeClaim is a **namespaced** resource. It belongs to a specific namespace, and Pods can only reference PVCs in their own namespace. This aligns with the principle that different teams or environments (development, staging, production) operate in separate namespaces and should manage their own storage requests independently.

When you run `kubectl get pvc`, you see only the PVCs in your current namespace context. To see PVCs across all namespaces, use `kubectl get pvc -A` or `kubectl get pvc --all-namespaces`.

## Anatomy of a PersistentVolumeClaim Manifest

Here is a complete, minimal PVC manifest:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: manual
```

This manifest is intentionally simple. A PVC describes _requirements_, not _implementation details_. Let's examine what each field does.

### `accessModes`

Just like a PV, the PVC declares which access mode it requires. The binding algorithm will only consider PVs that support the requested mode. In this case, `ReadWriteOnce` means the volume should be mountable read-write from a single node. If no PV with a compatible access mode is available, the PVC remains in `Pending` state.

### `resources.requests.storage`

This is the minimum amount of storage the PVC needs. Kubernetes will bind this PVC to a PV that has at least this much capacity. In the example above, any PV with 5Gi or more (and matching access mode and storage class) would be eligible. If a 10Gi PV is the only available one, the PVC will bind to it and effectively "use" 10Gi of reservation, even though only 5Gi was requested.

This is an important nuance: **a PVC can bind to a PV that is larger than the requested size**. The PVC does not get a dedicated slice of the PV, it gets the entire PV. The `storage` field in the request is a _minimum threshold_, not an exact allocation.

### `storageClassName`

This field controls which StorageClass the PVC belongs to. When set to `manual`, only PVs also labeled `storageClassName: manual` are considered. If you omit this field entirely, the behavior depends on cluster configuration, the default StorageClass (if one is annotated as default) may be applied automatically. To explicitly request a PV with no storage class (for manual, pre-bound scenarios), set `storageClassName: ""` (empty string).

:::info
In most production clusters, you won't use `storageClassName: manual`. Instead, you'll reference a real StorageClass like `standard`, `gp2`, `premium-rwo`, or whatever your cloud provider offers. The StorageClass determines both which PVs are eligible for binding and, with dynamic provisioning, how the PV is automatically created.
:::

## The Binding Process in Detail

Once a PVC is submitted, the Kubernetes control plane's **PersistentVolume controller** (which runs inside the controller-manager) continuously scans for unbound PVCs and tries to find a matching PV for each one.

@@@
flowchart LR
    A[PVC Submitted<br/>Pending] --> B{Find matching PV}
    B --> C{Check accessMode<br/>compatibility}
    C -->|No match| D[PVC stays Pending<br/>check describe]
    C -->|Match| E{Check storage<br/>size ≥ request}
    E -->|Too small| D
    E -->|Large enough| F{Check storageClass<br/>match}
    F -->|Mismatch| D
    F -->|Match| G[Bind PVC to PV<br/>Both become Bound]
    G --> H[Pod can now<br/>mount the PVC]
@@@

All three criteria must match: access mode, capacity (PV storage ≥ PVC request), and storage class. The first PV that satisfies all requirements wins, Kubernetes does not try to find the _smallest_ PV that fits, just the first qualifying one.

## What Happens When No Match Is Found

If no compatible PV exists when the PVC is submitted, the PVC enters `Pending` state and waits. The controller periodically retries, the moment a compatible PV becomes available (whether created manually by an admin or via dynamic provisioning), the PVC is automatically bound without any further action on your part. You can submit a PVC and a PV in any order, and Kubernetes will figure it out.

When a PVC is stuck in `Pending`, the most useful diagnostic command is:

```bash
kubectl describe pvc my-pvc
```

The `Events` section at the bottom will typically tell you exactly why binding failed, "no persistent volumes available for this claim" means no PV exists or none satisfies the requirements.

## Dynamic Provisioning: PVs on Demand

With a StorageClass that has a provisioner configured, you don't need to create PVs at all. When the PVC is submitted, the StorageClass provisioner is invoked immediately. It calls the appropriate API (cloud provider, storage system, CSI driver) to create a new storage volume, then creates a PV representing that volume, and then binds the PVC to it. The whole process typically completes in seconds.

Dynamic provisioning is the default in most cloud-hosted Kubernetes clusters. The only difference in your PVC manifest is that `storageClassName` references a real provisioner-backed StorageClass instead of `manual`.

:::warning
When dynamic provisioning is used, the default reclaim policy on the auto-created PV is usually `Delete`. This means **deleting the PVC will also delete the underlying cloud disk and all its data**. Always check the reclaim policy of your StorageClass before working with production data.
:::

## Hands-On Practice

In this exercise you'll create a PV and a PVC, watch the binding happen, and investigate what a pending PVC looks like.

**Step 1: Create a PersistentVolume**

```yaml
# my-pv-persistentvolume.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/data
```

```bash
kubectl apply -f my-pv-persistentvolume.yaml
```

**Step 2: Create a PersistentVolumeClaim**

```yaml
# my-pvc-persistentvolumeclaim.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: manual
```

```bash
kubectl apply -f my-pvc-persistentvolumeclaim.yaml
```

**Step 3: Check binding status**

```bash
kubectl get pvc my-pvc
```

Expected output:

```
NAME     STATUS   VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
my-pvc   Bound    my-pv    5Gi        RWO            manual         6s
```

The STATUS column shows `Bound` and the VOLUME column shows which PV was selected. Now check the PV:

```bash
kubectl get pv my-pv
```

Expected output:

```
NAME    CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM            STORAGECLASS   AGE
my-pv   5Gi        RWO            Retain           Bound    default/my-pvc   manual         45s
```

The CLAIM column shows `default/my-pvc`, the namespace and name of the bound PVC.

**Step 4: Simulate a pending PVC**

Create a PVC that requests more storage than any available PV can provide:

```yaml
# my-pvc-pending-persistentvolumeclaim.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc-pending
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: manual
```

```bash
kubectl apply -f my-pvc-pending-persistentvolumeclaim.yaml
```

```bash
kubectl get pvc my-pvc-pending
```

Expected output:

```
NAME             STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS   AGE
my-pvc-pending   Pending                                      manual         5s
```

**Step 5: Describe the pending PVC**

```bash
kubectl describe pvc my-pvc-pending
```

Look at the Events section at the bottom:

```
Events:
  Type     Reason              Age   From                         Message
  ----     ------              ----  ----                         -------
  Warning  ProvisioningFailed  5s    persistentvolume-controller  no persistent volumes available for this claim and no storage class is set
```

This is the exact output you'll see in real debugging scenarios. Clean up the pending PVC when you're done:

```bash
kubectl delete pvc my-pvc-pending
```
