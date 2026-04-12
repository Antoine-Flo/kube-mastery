---
seoTitle: Create a Kubernetes PersistentVolumeClaim, Binding Process
seoDescription: Learn how to write a Kubernetes PersistentVolumeClaim, understand the binding algorithm, diagnose pending PVCs, and see how dynamic provisioning works.
---

# Creating a PersistentVolumeClaim

The cluster administrator has pre-provisioned a PersistentVolume with 1 Gi of storage. Now the development team needs to use it. Nobody on the team knows which node the disk is on, what path it uses, or how it was configured. All they know is what their application needs: a certain amount of writable storage. They express that need as a PersistentVolumeClaim.

## Building the PVC Manifest Step by Step

Unlike a PV, a PVC is namespace-scoped. It belongs to a specific namespace and can only be used by Pods in the same namespace. Start with the resource structure:

```yaml
# illustrative only
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
```

Add `spec.resources.requests.storage` to declare how much storage the application needs. The PV only needs to offer at least this amount, not the exact same value:

```yaml
# illustrative only
spec:
  resources:
    requests:
      storage: 500Mi
```

Add `accessModes` to declare how the application will access the volume. This must be compatible with the modes the target PV advertises:

```yaml
# illustrative only
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
```

That is everything needed for a basic claim against a statically provisioned PV. Assemble the full manifest and apply it:

```bash
nano pvc.yaml
```

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
```

```bash
kubectl apply -f pvc.yaml
```

```bash
kubectl get pvc
```

If a compatible PV exists, the STATUS column shows `Bound` almost immediately. Both the PVC and the PV now display `Bound`, and the PV's `CLAIM` column shows the namespace-qualified PVC name.

:::quiz
You apply a PVC requesting 500Mi with `ReadWriteOnce`. A PV with 1Gi and `ReadWriteOnce` is available. What STATUS does the PVC show after a few seconds?

- Pending, because the PVC requests less than the PV offers
- Bound, because the PV satisfies all requirements
- Available, because the PVC has not been mounted yet

**Answer:** Bound, because the PV satisfies all requirements - PV capacity only needs to be greater than or equal to the request, and the access modes are compatible.
:::

## How the Binding Algorithm Works

When a PVC is applied, the control plane runs a matching algorithm to find the best available PV. Picture it as a checklist:

@@@
graph TD
PVC["PVC created"] --> C1["PV capacity >= request?"]
C1 --> C2["accessModes compatible?"]
C2 --> C3["storageClassName matches?"]
C3 --> C4["PV status is Available?"]
C4 --> Bound["PVC binds to PV"]
C1 --> Pending["PVC stays Pending"]
C2 --> Pending
C3 --> Pending
C4 --> Pending
@@@

Every condition must pass. If multiple PVs satisfy all conditions, Kubernetes prefers the one closest in size to the request to avoid wasting large volumes on small claims.

Why does Kubernetes refuse to match a PVC to a PV with a different access mode, even if the size is right? Because mounting a `ReadWriteOnce` volume from multiple nodes would violate the storage backend's guarantees and risk data corruption. The access mode check is a safety contract, not just a label.

## Diagnosing a Pending PVC

When no PV matches, the PVC stays in `Pending`. The fix starts with a description:

```bash
kubectl describe pvc postgres-pvc
```

Look at the `Events` section at the bottom. A typical message is `no persistent volumes available for this claim and no storage class is set`. This tells you either no PV exists with matching criteria, or the storageClassName in the PVC does not match any available PV.

:::warning
A `Pending` PVC waits indefinitely. Kubernetes will not bind a PVC to a PV that is too small, has an incompatible access mode, or carries a different `storageClassName`, even if the mismatch is minor. A PV in `Released` state also does not qualify. Check every field: capacity, access modes, storageClassName, and PV status before assuming the cluster is broken.
:::

Common mismatches to check:

- The PVC requests `ReadWriteMany` but the only available PV is `ReadWriteOnce`
- The PVC requests 2Gi but the only available PV has 1Gi
- The PVC has `storageClassName: fast` but no PV carries that class
- The only candidate PV is in `Released` state, not `Available`

:::info
When a cluster uses dynamic provisioning, a StorageClass with a provisioner creates the matching PV automatically the moment the PVC is applied. The PVC does not wait for a human admin, and `kubectl get pv` shows a new PV appearing within seconds. This module covers static provisioning first so the matching algorithm is fully visible before dynamic provisioning adds automation on top.
:::

:::quiz
Your PVC stays `Pending` after 30 seconds. What is the first command to run to diagnose the problem?

**Try it:** `kubectl describe pvc postgres-pvc`

**Answer:** Look at the Events section. The message there explains why no PV was found: mismatched capacity, incompatible access mode, storageClassName difference, or no Available PV at all.
:::

Once the PVC is `Bound`, the development team has secured storage without ever touching a PV definition. The next step is connecting that PVC to a running Pod so the application can actually read and write data.
