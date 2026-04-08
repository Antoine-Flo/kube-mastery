---
seoTitle: 'Kubernetes PersistentVolumes and PVCs, Durable Storage, Binding'
seoDescription: 'Learn how PersistentVolumes and PersistentVolumeClaims decouple storage provisioning from Pod lifecycle, enabling data to survive Pod deletion and rescheduling.'
---

# PersistentVolumes and PVCs

A database Pod is deleted during a rolling update. Its emptyDir volume is destroyed with it. When the replacement Pod starts on a different node, it finds an empty database. Three days of orders are gone.

This is why emptyDir is not enough for stateful workloads. For data that must survive Pod deletion, node failure, or rescheduling, Kubernetes introduces two separate resources: the **PersistentVolume** (PV) and the **PersistentVolumeClaim** (PVC).

## The Separation of Concerns

The PV and PVC model splits storage into two roles.

A **PersistentVolume** represents a piece of actual storage infrastructure: a network disk in a cloud provider, an NFS share, a local SSD on a node. It is a cluster-scoped resource, created by an administrator or provisioned automatically. It exists independently of any Pod.

A **PersistentVolumeClaim** is a request for storage by a workload. It says "I need 5Gi with ReadWriteOnce access." Kubernetes finds a PV that satisfies the claim and binds them together. The Pod then references the PVC, not the PV directly.

@@@
graph LR
    ADMIN["Admin / StorageClass"]
    PV["PersistentVolume<br/>10Gi, ReadWriteOnce<br/>Status: Bound"]
    PVC["PersistentVolumeClaim<br/>Request: 5Gi, RWO<br/>Status: Bound"]
    POD["Pod"]

    ADMIN -->|provisions| PV
    PVC -->|binds to| PV
    POD -->|mounts| PVC
@@@

Why the indirection? Because it decouples what storage is from what storage is needed. The developer writing the PVC does not need to know whether the cluster uses AWS EBS, GCP Persistent Disk, or an NFS server. They just request capacity and an access mode. The cluster handles the rest.

:::quiz
Why does a Pod reference a PVC instead of a PV directly?

**Answer:** Because the PVC is a portable request that abstracts the underlying storage. A Pod manifest that references a PVC can be applied to any cluster as long as a matching PV exists or dynamic provisioning is enabled. A Pod that referenced a PV directly would be coupled to a specific piece of infrastructure.
:::

## Access Modes

Every PV and PVC declares an access mode that describes how the volume can be mounted.

`ReadWriteOnce` (RWO) means the volume can be mounted by a single node at a time in read-write mode. This is the most common mode. Most block storage types (cloud disks) only support this.

`ReadOnlyMany` (ROX) means many nodes can mount the volume simultaneously, but only for reading.

`ReadWriteMany` (RWX) means many nodes can mount and write simultaneously. Only certain storage backends support this (NFS, for example).

## Creating a PV and PVC

In this cluster, create a PersistentVolume backed by local node storage:

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
  hostPath:
    path: /tmp/my-pv-data
```

```bash
kubectl apply -f my-pv.yaml
kubectl get pv
```

The STATUS column shows `Available`. Now create a PVC that requests storage:

```bash
nano my-pvc.yaml
```

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
      storage: 500Mi
```

```bash
kubectl apply -f my-pvc.yaml
kubectl get pvc
kubectl get pv
```

The PVC status becomes `Bound` and the PV status also becomes `Bound`. Kubernetes matched the PVC's request (500Mi, RWO) to the PV's capacity (1Gi, RWO). A PVC can bind to a PV with more capacity than requested, but not less.

:::warning
Once a PV is bound to a PVC, it cannot be bound to any other PVC. The binding is exclusive. When the PVC is deleted, the PV's `Reclaim Policy` determines what happens: `Retain` keeps the data but marks the PV as `Released` (not automatically re-bindable). `Delete` destroys the underlying storage. The default for dynamically provisioned PVs is usually `Delete`.
:::

## Using the PVC in a Pod

Reference the PVC by name in the Pod's volume declaration:

```bash
nano pvc-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pvc-pod
spec:
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: my-pvc
  containers:
    - name: app
      image: busybox:1.36
      command: ["/bin/sh", "-c", "echo 'data persisted' > /data/hello.txt && sleep 3600"]
      volumeMounts:
        - name: storage
          mountPath: /data
```

```bash
kubectl apply -f pvc-pod.yaml
```

Once running, verify the file was written:

```bash
kubectl exec pvc-pod -- cat /data/hello.txt
```

Now delete the Pod:

```bash
kubectl delete pod pvc-pod
```

Check the PV and PVC:

```bash
kubectl get pv
kubectl get pvc
```

Both are still `Bound`. The storage survived the Pod deletion. Create a new Pod that mounts the same PVC, and the data is still there.

:::quiz
You delete a Pod that was using a PVC. A colleague asks if the data stored in that PVC is lost. What do you tell them?

**Try it:** Delete and recreate the pod above, then `kubectl exec` into the new pod and check `/data/hello.txt`

**Answer:** The data is not lost. The PVC outlives the Pod. The PV remains Bound to the PVC. A new Pod that mounts the same PVC will find the same data intact, as long as the new Pod runs on the same node (for hostPath) or the storage backend supports multi-node access.
:::

Clean up:

```bash
kubectl delete pod pvc-pod
kubectl delete pvc my-pvc
kubectl delete pv my-pv
```

PersistentVolumes and PVCs are the foundation of stateful workloads in Kubernetes. The PV is the actual disk, the PVC is the reservation, and the Pod plugs into the PVC. The next and final lesson of this module covers StorageClasses, which eliminate the need to pre-provision PVs manually.
