# Dynamic Provisioning with StorageClass

This is where everything comes together. In previous lessons, you learned about PVs (storage resources), PVCs (storage requests), and StorageClasses (storage menus). Dynamic provisioning is the magic that connects them: you create a PVC, and Kubernetes automatically creates the PV for you. No admin needed, no manual setup.

## The Full Flow

Here's what happens when dynamic provisioning is in place:

1. You create a PVC with a `storageClassName` (or rely on the default)
2. No existing PV matches the request
3. The StorageClass's **provisioner** kicks in
4. The provisioner creates actual storage in the backend (a cloud disk, a network volume, etc.)
5. It creates a PV representing that storage
6. Kubernetes binds the PV to the PVC
7. Your Pod can now mount the PVC

The entire process is automatic. You write a PVC, apply it, and within seconds you have a bound volume ready to use.

```mermaid
flowchart TD
  PVC["PVC: 10Gi, storageClass=standard"] --> NoMatch["No existing PV matches"]
  NoMatch --> Provisioner["Provisioner watches for unbound PVCs"]
  Provisioner --> Create["Creates storage (e.g., AWS EBS volume)"]
  Create --> PV["Creates PV object"]
  PV --> Bind["Binds PV to PVC"]
  Bind --> Ready["Pod mounts the PVC"]
```

:::info
Dynamic provisioning eliminates the manual PV creation step entirely. In cloud environments, this means you can go from "I need storage" to "I have storage" with a single `kubectl apply` — no tickets, no waiting for an admin.
:::

Create a PVC that references a StorageClass with a provisioner — the YAML includes `storageClassName` and `resources.requests.storage`. Apply it and the provisioner creates a PV automatically. If the StorageClass uses `WaitForFirstConsumer` binding mode, the PVC stays in `Pending` until a Pod references it; once you create a Pod that mounts the PVC, provisioning triggers and the provisioner creates storage in the correct zone.

## What Happens with WaitForFirstConsumer

In multi-zone clusters, `WaitForFirstConsumer` is crucial. Without it, the provisioner might create a disk in zone A, but the scheduler puts your Pod in zone B — and the Pod can't reach the disk. With `WaitForFirstConsumer`, provisioning is deferred until the Pod is scheduled. The provisioner sees which node was chosen and creates the disk in the same zone.

## When Provisioning Fails

If the PVC stays in `Pending` longer than expected, something went wrong. Here's how to diagnose:

```bash
# Check PVC events
kubectl describe pvc dynamic-pvc

# Check provisioner logs (usually in kube-system)
kubectl logs -n kube-system -l app=ebs-csi-controller
```

Common causes:

- **No provisioner installed:** The StorageClass references a provisioner (like a CSI driver) that isn't deployed in the cluster
- **Cloud credentials missing:** The provisioner can't authenticate with the cloud provider
- **Quota exceeded:** Your cloud account has hit its storage quota
- **Incompatible parameters:** The StorageClass parameters don't work with the backend (wrong disk type, unsupported region, etc.)

:::warning
If a StorageClass uses `kubernetes.io/no-provisioner`, there's no dynamic provisioning — an admin must create PVs manually. This provisioner name explicitly means "I'll handle PV creation myself." Make sure your StorageClass uses a real provisioner if you want automatic provisioning.
:::

## Cleanup and Reclaim

When you delete a PVC, the reclaim policy determines what happens to the dynamically provisioned PV:

- **Delete** (default for most dynamic provisioners) — The PV and its underlying cloud disk are deleted automatically. Clean and simple.
- **Retain:** The PV and disk are kept, but the PV moves to `Released` state. An admin must manually clean up.

For development environments, `Delete` keeps things tidy. For production data you can't afford to lose, consider `Retain`.

---

## Hands-On Practice

### Step 1: Check available StorageClasses

```bash
kubectl get storageclass
```

### Step 2: Create a PVC that requests dynamic provisioning

```bash
nano dynamic-pvc.yaml
```

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
```

```bash
kubectl apply -f dynamic-pvc.yaml
```

### Step 3: Check if a PV was provisioned

```bash
kubectl get pv
kubectl get pvc
```

If dynamic provisioning is configured, you should see a PV automatically created and bound to your PVC.

### Step 4: Create a Pod that uses the PVC

```bash
nano pvc-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pvc-pod
spec:
  containers:
    - name: app
      image: busybox
      command: ['sh', '-c', "echo 'data saved' > /data/test.txt && sleep 3600"]
      volumeMounts:
        - name: storage
          mountPath: /data
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: dynamic-pvc
```

```bash
kubectl apply -f pvc-pod.yaml
```

### Step 5: Verify the mount

```bash
kubectl exec pvc-pod -- cat /data/test.txt
```

### Step 6: Clean up

```bash
kubectl delete pod pvc-pod
kubectl delete pvc dynamic-pvc
```

## Wrapping Up

Dynamic provisioning is one of the most powerful features of the Kubernetes storage model. It turns storage into a self-service resource: users create PVCs, provisioners create PVs, and everything is bound automatically. Combined with StorageClasses that offer different tiers and topologies, it enables a storage experience that's both flexible and hands-off. With this chapter complete, you have a solid understanding of Kubernetes storage — from ephemeral `emptyDir` volumes all the way to dynamically provisioned persistent storage.
