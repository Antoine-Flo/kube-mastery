---
seoTitle: Kubernetes Persistent Storage, PVs, PVCs, and Binding
seoDescription: Understand how Kubernetes PersistentVolumes and PersistentVolumeClaims decouple storage from Pods, how binding works, and when to use dynamic provisioning.
---

# PersistentVolumes and PersistentVolumeClaims

Imagine you are running a PostgreSQL database in a Kubernetes Pod. The database writes all its data to `/var/lib/postgresql/data` inside the container. One day, the Pod crashes and Kubernetes restarts it. When the new container comes up, that directory is empty: every row, every table, every migration is gone. This happens because containers use ephemeral storage by default, and a standard `emptyDir` volume lives and dies with the Pod.

Kubernetes solves this with PersistentVolumes and PersistentVolumeClaims. Together, they give your Pods access to storage that outlives any individual container restart or Pod deletion.

## The Two Sides of Persistent Storage

Before looking at any commands, picture how the two sides relate to each other:

@@@
graph LR
    Admin["Cluster Admin"] --> PV["PersistentVolume\ndisk or NFS share"]
    PV --> Binding["Kubernetes Binding"]
    PVC["PersistentVolumeClaim\ndev request"] --> Binding
    Binding --> Pod["Pod"]
@@@

A **PersistentVolume** (PV) is a piece of storage that exists in the cluster independently of any Pod. It could be a directory on a node, a cloud disk, or an NFS share. The cluster administrator creates it and declares how much space it offers and how it can be accessed.

A **PersistentVolumeClaim** (PVC) is a request for storage made by a developer or a workload. The PVC says "I need 500 Mi of storage, accessible from one node at a time." Kubernetes matches that request against available PVs and binds them together.

A helpful analogy: the PV is an apartment available for rent, with a known size and a list of features. The PVC is a rental search listing with specific requirements. The binding is the moment the tenant and landlord sign the lease. Neither side needs to know the other's internal details.

This separation is intentional. Cluster admins control the physical or cloud resources. Developers simply declare what they need. Changing the underlying storage backend does not require touching the application manifests.

:::quiz
What is the role of a PersistentVolumeClaim in Kubernetes?

- It creates a disk on the underlying cloud provider
- It is a request for storage that Kubernetes matches to an available PV
- It mounts a volume directly into the node filesystem

**Answer:** It is a request for storage that Kubernetes matches to an available PV - a PVC describes requirements, and the control plane finds a compatible PV and binds them together.
:::

## Checking PV and PVC State

To see the PersistentVolumes in the simulated cluster, run:

```bash
kubectl get pv
```

To see PersistentVolumeClaims in the current namespace:

```bash
kubectl get pvc
```

Both commands show a `STATUS` column that tells you where things stand. To inspect the full details of a PV including its current claim reference and events:

```bash
kubectl describe pv
```

The four possible statuses for a PV are:

@@@
graph LR
    Available["Available\nno claim"] --> Bound["Bound\nPVC attached"]
    Bound --> Released["Released\nPVC deleted"]
    Released --> Failed["Failed\nerror state"]
@@@

A PV starts as `Available`, meaning no PVC has claimed it yet. Once a matching PVC appears and binding completes, both the PV and PVC show `Bound`. If the PVC is later deleted, the PV transitions to `Released`. If Kubernetes encounters an error during the binding or reclaim process, the PV shows `Failed`.

Why does a `Released` PV not immediately return to `Available`? Because Kubernetes preserves the reference to the previous claim. This protects against accidental data exposure: another PVC should not automatically get access to data left behind by a previous workload. An administrator must review the situation and manually clear that reference before the PV can be used again.

:::quiz
A PV shows STATUS `Released`. Can a new PVC immediately bind to it?

**Answer:** No. A `Released` PV retains a reference to its previous claim. The control plane will not bind a new PVC to it until an admin removes that reference manually.
:::

:::info
In production clusters, **dynamic provisioning** removes the need to pre-create PVs manually. When a PVC is created, a StorageClass with a provisioner automatically creates a matching PV on demand. This module focuses on static provisioning first so the binding mechanics are fully visible before adding that layer.
:::

:::warning
A PVC in `Bound` state is exclusive to its PV. When the access mode is `ReadWriteOnce`, only one node at a time can mount the volume. Two Pods scheduled on different nodes cannot share the same `ReadWriteOnce` PVC simultaneously.
:::

## Why This Decoupling Matters

Without PVs and PVCs, every team would need to know exactly where their data lives: which disk, which path, which cloud volume ID. With this model, developers write a PVC that describes their needs, and infrastructure details stay in the PV definition managed by admins.

Run `kubectl get pv` in the simulator now. If the lesson has pre-provisioned PVs, you see them listed with their capacity, access modes, and current status. This is what an admin sees before any workload has claimed the storage.

PersistentVolumes and PersistentVolumeClaims are the foundation of stateful workloads in Kubernetes. The next lessons walk through creating each one step by step, then mounting the result inside a real Pod.
