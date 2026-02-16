# Creating a PersistentVolumeClaim

You've created a PersistentVolume — storage is available in the cluster. Now let's claim it. A **PersistentVolumeClaim (PVC)** is how users request storage. You specify what you need (size, access mode, optionally a StorageClass), and Kubernetes finds a matching PV and binds them together.

## What a PVC Spec Includes

A PVC is straightforward:

- **accessModes** — How you want to access the storage (`ReadWriteOnce`, `ReadOnlyMany`, `ReadWriteMany`)
- **resources.requests.storage** — How much storage you need (e.g., `3Gi`)
- **storageClassName** — Which class of storage you want (must match a PV's class or trigger dynamic provisioning)

That's it. The PVC doesn't need to know about NFS servers, cloud disk IDs, or node paths. It just says "I need this much storage, accessible in this way."

## Example: PVC and Pod Together

Here's a complete example — a PVC that requests 3Gi of storage, and a Pod that mounts it:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 3Gi
  storageClassName: manual
---
apiVersion: v1
kind: Pod
metadata:
  name: app-with-pvc
spec:
  containers:
    - name: app
      image: nginx
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: my-pvc
```

The Pod references the PVC by name in `persistentVolumeClaim.claimName`. The PVC must exist and be in `Bound` status before the Pod can mount it. If the PVC is still `Pending`, the Pod will wait.

```mermaid
flowchart LR
  PVC["PVC: my-pvc (3Gi, RWO)"] -->|binds to| PV["PV: pv-hostpath-demo (5Gi, RWO)"]
  Pod["Pod: app-with-pvc"] -->|mounts| PVC
```

:::info
PVCs are **namespaced** — they must be in the same namespace as the Pod that uses them. PVs are cluster-scoped and can be bound by a PVC from any namespace.
:::

## The Binding Process

When you create a PVC, Kubernetes starts looking for a match:

1. It searches for a PV with enough capacity (PV must be >= PVC request)
2. It checks that access modes are compatible
3. It matches the StorageClass (if specified)
4. If a match is found, the PVC is bound to the PV — exclusively. No other PVC can use that PV.
5. If no match is found, the PVC stays in `Pending`

If the StorageClass has a dynamic provisioner, Kubernetes creates a new PV automatically instead of waiting for a manual one. We'll cover dynamic provisioning in the StorageClass chapter.

## Applying and Verifying

```bash
# Apply the PVC and Pod
kubectl apply -f pvc-pod.yaml

# Watch the PVC status — it should become Bound
kubectl get pvc my-pvc

# Verify the Pod mounted the volume
kubectl exec app-with-pvc -- df -h /data

# Write some data and verify persistence
kubectl exec app-with-pvc -- sh -c 'echo "hello" > /data/test.txt'
kubectl exec app-with-pvc -- cat /data/test.txt
```

## Testing Persistence

Here's the real test: delete the Pod and recreate it. The data should still be there:

```bash
# Delete the Pod (PVC stays)
kubectl delete pod app-with-pvc

# Recreate the Pod with the same PVC
kubectl apply -f pod.yaml

# Check the data
kubectl exec app-with-pvc -- cat /data/test.txt
```

You should see `hello` — the data persisted because the PVC (and its bound PV) were not deleted. This is the key difference from `emptyDir`: the data outlives the Pod.

## Common Issues

**PVC stuck in Pending** — No PV matches the request. Check:

```bash
kubectl describe pvc my-pvc
kubectl get pv
```

The events section of `describe` will tell you what's wrong — capacity mismatch, access mode mismatch, or no available PVs.

**Pod stuck in Pending** — The PVC exists but isn't bound yet. Check the PVC status first.

**StorageClass mismatch** — The PVC specifies a `storageClassName` that doesn't match any PV. Either create a PV with the matching class or adjust the PVC.

:::warning
Remember that PVC binding is **exclusive** — one PVC per PV. If a PV is already bound to another PVC, it's unavailable. Check `kubectl get pv` to see which PVs are free (status `Available`).
:::

## Wrapping Up

Creating a PVC is how users request storage in Kubernetes. Specify size, access mode, and optionally a StorageClass, and Kubernetes handles the matching. The PVC must be bound before a Pod can mount it. Data persists as long as the PVC and PV exist — even across Pod restarts. In the next chapter, we'll explore StorageClasses, which automate the entire PV creation process through dynamic provisioning.
