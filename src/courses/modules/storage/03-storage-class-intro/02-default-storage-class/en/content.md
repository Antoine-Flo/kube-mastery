# Default StorageClass

In many clusters, especially cloud-managed ones, you can create a PVC without specifying a `storageClassName` — and it just works. Storage is provisioned, the PVC is bound, and your Pod gets its volume. How? Thanks to the **default StorageClass**.

## How the Default Works

When a PVC doesn't include a `storageClassName`, the Kubernetes **DefaultStorageClass admission controller** steps in. It looks for a StorageClass marked as the default and automatically injects its name into the PVC. From that point on, the PVC behaves as if you'd specified the class explicitly.

Think of it like a default shipping method on an online store. If you don't choose express or standard shipping, the store picks one for you. The default StorageClass does the same thing — it provides a sensible default so users don't have to think about storage classes for simple use cases.

```mermaid
flowchart LR
  PVC["PVC (no storageClassName)"] --> Admission["DefaultStorageClass Admission Controller"]
  Admission -->|injects| SC["Default StorageClass"]
  SC -->|triggers| Provisioner["Provisioner"]
  Provisioner -->|creates| PV["PV"]
```

The default StorageClass is marked `(default)` when you list StorageClasses. Under the hood, it's identified by the annotation `storageclass.kubernetes.io/is-default-class: "true"`.

:::info
Cloud-managed clusters (EKS, GKE, AKS) typically configure a default StorageClass during setup. On EKS, it's usually `gp2` or `gp3`; on GKE, it's `standard` or `premium-rwo`. Check what's available in your cluster before creating PVCs.
:::

## Creating a PVC Without StorageClass

When a default exists, this is all you need:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: simple-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

No `storageClassName` specified. The admission controller fills it in with the default class, the provisioner creates a PV, and the PVC is bound.

## Setting or Changing the Default

To mark a StorageClass as default, add the annotation:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
```

If you need to change the default, remove the annotation from the current one and add it to the new one:

```bash
# Remove default from the old class
kubectl patch storageclass old-default -p '{"metadata": {"annotations": {"storageclass.kubernetes.io/is-default-class": "false"}}}'

# Set the new default
kubectl patch storageclass fast-ssd -p '{"metadata": {"annotations": {"storageclass.kubernetes.io/is-default-class": "true"}}}'
```

:::warning
Only **one** StorageClass should be marked as default per cluster. Having multiple defaults leads to unpredictable behavior — Kubernetes may pick any one of them. If you see unexpected PVC behavior, check `kubectl get storageclass` for multiple defaults.
:::

## When There's No Default

If no StorageClass is marked as default and a PVC omits `storageClassName`, the PVC stays in `Pending` indefinitely. The admission controller has nothing to inject, and no provisioner is triggered. You'll need to either:

- Set a StorageClass as default
- Or explicitly specify `storageClassName` in every PVC

---

## Hands-On Practice

### Step 1: List StorageClasses and identify the default

```bash
kubectl get storageclass
```

Look for `(default)` in the output — that class is used when a PVC omits `storageClassName`. Most cloud clusters have one pre-configured.

### Step 2: Verify the default annotation (optional)

```bash
kubectl get storageclass -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.annotations.storageclass\.kubernetes\.io/is-default-class}{"\n"}{end}'
```

The default class shows `true`; others show nothing or `false`. This confirms how Kubernetes identifies the default.

## Wrapping Up

The default StorageClass provides a seamless experience for users who just need storage without worrying about which class to pick. It's set via an annotation and injected automatically by the admission controller. Most cloud clusters come with one pre-configured. Just make sure you have exactly one default — and that it matches the storage characteristics your team needs most. In the next lesson, we'll see the full dynamic provisioning flow in action.
