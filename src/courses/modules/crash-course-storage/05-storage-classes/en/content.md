---
seoTitle: 'Kubernetes StorageClasses, Dynamic Provisioning, Reclaim Policy'
seoDescription: 'Learn how StorageClasses enable dynamic PersistentVolume provisioning, eliminating manual PV creation and adapting storage to different performance and cost requirements.'
---

# Storage Classes

In the previous lesson, you created a PersistentVolume by hand before creating the PVC. In a real cluster, this workflow does not scale. An operator who must pre-provision a PV for every workload becomes a bottleneck. Developers wait. PVs pile up.

StorageClasses solve this with **dynamic provisioning**. When a PVC is created, the cluster automatically provisions a PV that matches the claim. No human creates the PV. It appears, gets bound, and is ready within seconds.

## What a StorageClass Is

A StorageClass is a cluster-level object that describes a category of storage: the underlying provisioner (which cloud plugin handles the actual disk creation), and parameters like disk type, replication, and encryption.

@@@
graph LR
PVC["PersistentVolumeClaim<br/>storageClassName: fast"]
SC["StorageClass: fast<br/>provisioner: ebs.csi.aws.com<br/>type: gp3"]
PV["PersistentVolume<br/>auto-provisioned<br/>Status: Bound"]
POD["Pod"]

    PVC -->|"triggers provisioning via"| SC
    SC -->|"creates"| PV
    PVC -->|"binds to"| PV
    POD -->|"mounts"| PVC

@@@

List the StorageClasses available in your cluster:

```bash
kubectl get storageclass
```

You will see at least one entry. The `PROVISIONER` column shows what plugin handles provisioning. The `(default)` annotation marks which StorageClass is used when a PVC does not specify one explicitly.

## Dynamic Provisioning in Practice

Create a PVC that references a StorageClass by name:

```bash
nano dynamic-pvc.yaml
```

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-pvc
spec:
  storageClassName: standard
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f dynamic-pvc.yaml
kubectl get pvc dynamic-pvc
kubectl get pv
```

Within seconds, a PV appears in the list that you never created. The StorageClass provisioner created it in response to the PVC. The PVC status moves to `Bound` automatically.

:::quiz
You create a PVC without specifying `storageClassName`. What happens?

**Answer:** Kubernetes uses the default StorageClass, marked with the annotation `storageclass.kubernetes.io/is-default-class: "true"`. If no default StorageClass exists, the PVC stays in `Pending` indefinitely until one is configured or a matching PV is created manually.
:::

## Reclaim Policy

The StorageClass also controls what happens to the PV when the PVC is deleted. This is the **Reclaim Policy**.

`Delete` means the PV and the underlying disk are deleted when the PVC is deleted. This is the default for most cloud provisioners. It keeps your infrastructure clean but permanently removes the data.

`Retain` means the PV is kept after the PVC is deleted. It moves to a `Released` state and cannot be automatically rebound. An administrator must manually intervene: inspect the data, clean the PV, and re-make it `Available`. Use `Retain` for data you cannot afford to lose accidentally.

:::warning
The `Delete` reclaim policy is unforgiving. Deleting a PVC in a cluster with dynamic provisioning and `Delete` policy removes the data permanently, including the underlying cloud disk. There is no recycle bin, no soft delete, no recovery. Always verify the reclaim policy of a StorageClass before deploying a production database to it.
:::

## Multiple StorageClasses for Different Needs

A cluster can have many StorageClasses, each representing a different storage tier. A team might have a `fast` class backed by SSDs for a latency-sensitive database, and a `bulk` class backed by cheaper spinning disks for log archival.

```yaml
# illustrative only
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: '3000'
reclaimPolicy: Retain
allowVolumeExpansion: true
```

The `allowVolumeExpansion: true` field means you can resize a PVC that uses this class without deleting it, by editing the PVC's `resources.requests.storage` field upward. Kubernetes will expand the underlying disk automatically.

:::quiz
Your team deploys a PostgreSQL database using a StorageClass with `reclaimPolicy: Delete`. A developer accidentally runs `kubectl delete pvc postgres-pvc`. What happens to the data?

- It is retained in a Released PV and can be recovered
- It is permanently deleted along with the underlying cloud disk
- It stays safe until an admin manually deletes the PV

**Answer:** It is permanently deleted. The `Delete` reclaim policy destroys the PV and the underlying infrastructure disk the moment the PVC is removed. There is no recovery path. This is why critical databases should use `Retain` and why PVC deletion should require explicit confirmation in team workflows.
:::

Clean up:

```bash
kubectl delete pvc dynamic-pvc
```

StorageClasses close the loop on storage in Kubernetes. Manual PV creation was the friction point between developers and durable storage. StorageClasses remove that friction: a PVC is the complete storage contract, and the cluster fulfills it automatically.

---

You have reached the end of the Crash Course. You started with a 3am crash and no orchestrator. You now have a mental model of the entire system: a cluster with a control plane making decisions and nodes running workloads, kubectl to inspect and act on any resource, namespaces and labels to organize at scale, Pods as the unit of compute, Deployments to keep them healthy and rolling, Services to route traffic reliably, DNS to resolve names without hardcoding IPs, and Volumes with PVCs to persist data beyond the lifetime of any single Pod.

This is the foundation. Everything in Kubernetes, from multi-cluster federation to custom operators, builds on exactly what you practiced here. The path ahead is about depth, not new primitives: tighter configurations, smarter scheduling, more resilient networking, and the troubleshooting muscle that only comes from running real workloads. You are ready for it.
