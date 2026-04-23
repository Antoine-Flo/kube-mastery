---
seoTitle: 'StatefulSet PVC, volumeClaimTemplates, Persistent Storage Per Pod'
seoDescription: 'Learn how Kubernetes StatefulSets use volumeClaimTemplates to give each Pod a dedicated persistent volume, and how storage persists across Pod restarts and rescheduling.'
---

# Storage in StatefulSets

A Deployment that mounts a PVC gives the same volume to all its replicas. For a database, this is catastrophic: two replicas writing to the same disk causes data corruption. StatefulSets use `volumeClaimTemplates` instead: a template that creates a unique, dedicated PVC for each Pod.

`web-0` gets PVC `data-web-0`. `web-1` gets PVC `data-web-1`. `web-2` gets PVC `data-web-2`. When a Pod is deleted and recreated, it is reattached to its original PVC. The data persists across restarts.

## Adding volumeClaimTemplates

```bash
nano statefulset-storage.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: db-headless
spec:
  clusterIP: None
  selector:
    app: db
  ports:
    - port: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db-headless
  replicas: 2
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: database
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              echo "init data for $HOSTNAME" > /data/init.txt
              sleep 3600
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 1Gi
```

```bash
kubectl apply -f statefulset-storage.yaml
```

## What volumeClaimTemplates creates

```bash
kubectl get pvc
```

You will see two PVCs:
- `data-db-0`: created for `db-0`, bound to a PV
- `data-db-1`: created for `db-1`, bound to a PV

The naming convention is `<template-name>-<pod-name>`.

```bash
kubectl get pv
```

Each PVC is backed by a Persistent Volume. The StatefulSet controller did not create the PVs directly: it created the PVCs, and the PVC binding mechanism (StorageClass or pre-provisioned PVs) created or assigned the PVs.

```bash
kubectl exec db-0 -- cat /data/init.txt
kubectl exec db-1 -- cat /data/init.txt
```

Each Pod wrote its own hostname to its own `/data/init.txt` file. `db-0` writes to `data-db-0`, `db-1` writes to `data-db-1`. They never share a volume.

@@@
graph TB
SS["StatefulSet: db"] --> P0["Pod db-0"] --> PVC0["PVC data-db-0"] --> PV0["PV (1Gi)"]
SS --> P1["Pod db-1"] --> PVC1["PVC data-db-1"] --> PV1["PV (1Gi)"]
@@@

:::quiz
You delete `db-0`. The StatefulSet controller recreates it. Does the new `db-0` get a new empty volume or the original `data-db-0` PVC?

**Answer:** The original `data-db-0` PVC. When a StatefulSet Pod is deleted and recreated, the controller looks for an existing PVC with the expected name (`data-db-0`) before creating a new one. If it exists, the new Pod is bound to it. The data is preserved across Pod restarts.
:::

## Storage and rescheduling

When a Pod is rescheduled to a different node, its PVC must be accessible from that node. This depends on the `accessMode`:

- `ReadWriteOnce` (RWO): the volume can only be mounted on one node at a time. If the Pod moves to a different node and the volume is backed by local storage (like `hostPath`), the Pod may get stuck. Cloud block storage (AWS EBS, GCP PD) supports `ReadWriteOnce` and can be remounted on a different node.
- `ReadWriteMany` (RWX): the volume can be mounted by multiple nodes simultaneously. Network filesystems (NFS, CephFS) typically support this.

For most StatefulSet use cases, use a StorageClass that provisions cloud block storage, which supports `ReadWriteOnce` across nodes.

:::warning
StatefulSet scale-down does not delete PVCs. If you scale from 3 to 1, PVCs `data-db-1` and `data-db-2` remain bound and consuming storage. They are retained in case you scale back up. To free the storage, you must manually delete the PVCs after confirming the data is no longer needed: `kubectl delete pvc data-db-1 data-db-2`.
:::

## Inspecting PVC state

```bash
kubectl describe pvc data-db-0
```

The output shows:
- `Status: Bound`: the PVC has a backing PV
- `Volume`: the name of the bound PV
- `Access Modes`: how the volume can be mounted
- `StorageClass`: which storage class was used to provision it

If a PVC stays in `Pending`, it cannot find a PV that satisfies its requirements. Check `kubectl describe pvc` Events for the reason.

:::quiz
A StatefulSet uses `volumeClaimTemplates` with `storageClassName: local-storage`. The local-storage class provisions volumes on the node where the Pod first runs. The Pod is rescheduled to a different node. What happens?

**Answer:** The PVC is still bound to the PV on the original node. The Pod cannot start on the new node because the `ReadWriteOnce` volume cannot be mounted from a different node. The Pod stays Pending with an event about volume attachment failing. This is why local storage is generally not suitable for StatefulSets that may be rescheduled. Use network-attached storage for portable StatefulSet Pods.
:::

```bash
kubectl delete statefulset db
kubectl delete service db-headless
```

The PVCs are retained. You would need to delete them manually.

Storage in StatefulSets is per-instance, stable, and not cleaned up automatically. This is the right behavior for databases. The next lesson covers how StatefulSets handle updates and the different update strategies available.
