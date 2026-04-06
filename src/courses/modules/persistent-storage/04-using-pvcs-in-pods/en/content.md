---
seoTitle: Mount PersistentVolumeClaims in Kubernetes Pods, Storage
seoDescription: Learn how to reference a PVC in a Kubernetes Pod spec, confirm data survives Pod deletion, and understand access mode constraints for multi-replica workloads.
---

# Using PersistentVolumeClaims in Pods

Creating a PersistentVolume and binding a PVC to it is only half the story. The real goal is to make that storage available inside a running container. This lesson covers exactly how to wire a PVC into a Pod, and more importantly, what that gives you in terms of data durability and workload design.

## Referencing a PVC in a Pod

Mounting a PVC in a Pod requires two declarations in the Pod spec, working together:

1. A **volume** entry that references the PVC by name.
2. A **volumeMount** entry inside the container that specifies where in the container's filesystem the volume should appear.

Here is a complete example that runs a PostgreSQL database using a PVC for its data directory:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: db-pod
spec:
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: my-pvc
  containers:
    - name: database
      image: postgres:15
      volumeMounts:
        - name: storage
          mountPath: /var/lib/postgresql/data
      env:
        - name: POSTGRES_PASSWORD
          value: 'password'
```

The `volumes` section defines a volume named `storage` and points it at the PVC named `my-pvc`. The `volumeMounts` section tells Kubernetes to mount that volume at `/var/lib/postgresql/data`, the path PostgreSQL uses to store its database files. The two are linked by the `name` field: `storage` in the volume list matches `storage` in the volumeMount list.

This pattern of declaring volumes at the Pod level and mounts at the container level allows a single Pod to have multiple volumes and lets multiple containers in the same Pod potentially share the same volume.

:::info
The PVC must exist in the **same namespace** as the Pod. If the Pod is in the `production` namespace, the PVC must also be in the `production` namespace. There is no way to reference a PVC across namespaces.
:::

## Data Survives Pod Deletion

The most important property of PVC-backed storage is this: when the Pod is deleted and a new Pod is created referencing the same PVC, it gets exactly the same data back. The storage lifecycle is completely independent from the Pod lifecycle.

Without persistent storage, every time a database Pod crashes or gets rescheduled, you start with an empty database. With a PVC, the data is stored outside the container on the persistent volume, a new instance of the same container, pointing at the same volume, picks up exactly where the previous one left off.

@@@
sequenceDiagram
    participant K as Kubernetes
    participant PVC as PVC / PV
    participant P1 as Pod (v1)
    participant P2 as Pod (v2)

    K->>P1: Schedule Pod
    P1->>PVC: Mount volume at /var/lib/postgresql/data
    P1->>PVC: Write database files
    K->>P1: Delete Pod (crash / update)
    Note over PVC: Data remains intact
    K->>P2: Schedule new Pod
    P2->>PVC: Mount same PVC
    PVC->>P2: All previous data available
    Note over P2: Database resumes normally
@@@

This is the fundamental promise of persistent storage in Kubernetes. The Pod is ephemeral; the data is not.

## The Namespace Constraint in Practice

Because PVCs are namespaced, the cluster administrator typically provisions PVs (cluster-scoped) while the developer or platform team creates PVCs within the appropriate namespace. If you're deploying a database in the `payments` namespace, your PVC must be there too, even if the underlying PV was created without any namespace association. In practice this just means including the `namespace` field in your PVC manifest and ensuring `kubectl` is pointed at the right namespace.

## Access Modes and Multi-Pod Usage

A common question is: can multiple Pods use the same PVC at the same time? The answer depends entirely on the **access mode** of the underlying PV.

With **ReadWriteOnce (RWO)**, the most common access mode for cloud block storage, only one node can mount the volume in read-write mode at a time. In practice, this usually means only one Pod can actively use the volume. If you create a second Pod that references the same RWO PVC but it gets scheduled to a different node, that second Pod will fail to start because the volume is already exclusively mounted.

With **ReadWriteMany (RWX)**, available with NFS, CephFS, and other networked storage backends, multiple Pods across multiple nodes can all mount the same PVC simultaneously in read-write mode. This is the right choice for workloads that need to share a filesystem, like a CMS where multiple web servers all need to read and write the same uploaded files directory.

:::warning
Using RWO storage with a Deployment that has more than one replica is a common mistake. If the Deployment scales to two replicas and they land on different nodes, the second replica's Pod will get stuck in `ContainerCreating` because the volume cannot be attached to two nodes at once. Use RWX storage or a StatefulSet with per-Pod PVCs for multi-replica stateful workloads.
:::

## Deployments vs StatefulSets

When you think about stateful workloads, it's important to choose the right higher-level workload object.

**Deployments** work fine with PVCs if you're running a single replica (or using RWX storage). You create the PVC separately and reference it by name in the Deployment's Pod template. All replicas of that Deployment will try to mount the same PVC. For stateless applications that happen to need some shared storage, this can work well.

**StatefulSets** are the designed-for-stateful workload type in Kubernetes. Instead of referencing a single shared PVC, StatefulSets have a `volumeClaimTemplates` field that automatically creates a _separate_ PVC for each replica. So a StatefulSet with three replicas creates three PVCs, `data-mydb-0`, `data-mydb-1`, `data-mydb-2`, each bound to its own PV. This is ideal for clustered databases (Cassandra, MySQL replicas, Elasticsearch) where each instance needs independent storage.

For this lesson, we focus on the straightforward case: a single Pod referencing a single PVC. StatefulSets and their volume claim templates are covered in a dedicated lesson.

## Hands-On Practice

In this exercise you will create a PV, a PVC, and a Pod that uses the PVC. You'll then delete the Pod, create a new one, and confirm that the data persisted.

**Step 1: Set up the PV and PVC**

```yaml
# demo-pv-persistentvolume.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: demo-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /tmp/demo-storage
```

```bash
kubectl apply -f demo-pv-persistentvolume.yaml
```

```yaml
# demo-pvc-persistentvolumeclaim.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: demo-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: manual
```

```bash
kubectl apply -f demo-pvc-persistentvolumeclaim.yaml
```

**Step 2: Create a Pod that writes to the volume**

```yaml
# writer-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: writer-pod
spec:
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: demo-pvc
  containers:
    - name: writer
      image: busybox
      command:
        [
          '/bin/sh',
          '-c',
          "echo 'Hello from the first pod' > /data/message.txt && sleep 3600"
        ]
      volumeMounts:
        - name: storage
          mountPath: /data
```

```bash
kubectl apply -f writer-pod.yaml
```

Wait for the Pod to start:

```bash
kubectl wait --for=condition=Ready pod/writer-pod --timeout=60s
```

**Step 3: Verify the file was written**

```bash
kubectl exec writer-pod -- cat /data/message.txt
```

Expected output:

```
Hello from the first pod
```

**Step 4: Delete the Pod**

```bash
kubectl delete pod writer-pod
```

The Pod is gone. The PVC and PV still exist, you can verify with `kubectl get pvc demo-pvc`.

**Step 5: Create a new Pod and read the same data**

```yaml
# reader-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: reader-pod
spec:
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: demo-pvc
  containers:
    - name: reader
      image: busybox
      command: ['/bin/sh', '-c', 'sleep 3600']
      volumeMounts:
        - name: storage
          mountPath: /data
```

```bash
kubectl apply -f reader-pod.yaml

kubectl wait --for=condition=Ready pod/reader-pod --timeout=60s
kubectl exec reader-pod -- cat /data/message.txt
```

Expected output:

```
Hello from the first pod
```

The data written by `writer-pod` is still there, accessible to `reader-pod`. This is persistence in action. The cluster visualizer (telescope icon) will now show the relationship between `reader-pod`, `demo-pvc`, and `demo-pv` as a connected graph.

**Step 6: Clean up**

```bash
kubectl delete pod reader-pod
kubectl delete pvc demo-pvc
kubectl delete pv demo-pv
```
