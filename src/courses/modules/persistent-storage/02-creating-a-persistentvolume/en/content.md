---
seoTitle: Create a Kubernetes PersistentVolume, Fields and Lifecycle
seoDescription: Learn how to write a Kubernetes PersistentVolume manifest, covering capacity, access modes, reclaim policy, and PV lifecycle phases from Available to Released.
---

# Creating a PersistentVolume

Your platform team has a node with extra disk space, and the development team needs persistent storage for a database workload. Before any Pod can claim that storage, someone needs to make it visible to the Kubernetes API. That is the administrator's job: write a PersistentVolume manifest and apply it to the cluster. Once applied, the PV sits in `Available` state, waiting for a PVC to match it.

## Building the Manifest Step by Step

A PersistentVolume is a cluster-scoped resource, so it has no `namespace` in its metadata. The meaningful configuration lives in `spec`. Rather than writing the full manifest at once, build it field by field so the purpose of each setting is clear.

Start with `capacity.storage`. This tells Kubernetes how much space this PV offers:

```yaml
# illustrative only
spec:
  capacity:
    storage: 1Gi
```

Next, add `accessModes`. This is a list because some storage backends advertise multiple modes. The three most common are `ReadWriteOnce` (one node, read-write), `ReadOnlyMany` (many nodes, read-only), and `ReadWriteMany` (many nodes, read-write simultaneously). For a database running on a single node, `ReadWriteOnce` is the right choice:

```yaml
# illustrative only
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
```

Then add `persistentVolumeReclaimPolicy`. This controls what Kubernetes does with the PV when its PVC is deleted. `Retain` keeps the data and leaves the PV in `Released` state for admin review. `Delete` removes the PV and the underlying storage automatically:

```yaml
# illustrative only
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
```

Finally, add the volume source. In the simulator, `hostPath` represents a directory on the node's filesystem. In a real cluster this could be a cloud disk or NFS share, but `hostPath` is sufficient to learn the PV lifecycle:

```yaml
# illustrative only
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /data/postgres
```

Assemble the complete manifest and apply it:

```bash
nano pv.yaml
```

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /data/postgres
```

```bash
kubectl apply -f pv.yaml
```

```bash
kubectl get pv
```

You see `postgres-pv` with STATUS `Available`. This means no PVC has claimed it yet. It is ready and waiting.

:::quiz
You apply a PV manifest with `capacity.storage: 1Gi`. A PVC later requests 500Mi. Will the binding succeed?

- No, the PVC must request exactly the same size as the PV
- Yes, the PV capacity only needs to be greater than or equal to the PVC request
- No, the PV must be smaller than or equal to the PVC request to avoid wasting space

**Answer:** Yes, the PV capacity only needs to be greater than or equal to the PVC request - Kubernetes does not require an exact match on size, only that the PV can satisfy the claim.
:::

## The PV Lifecycle

Once a PVC binds to this PV, both objects move to `Bound`. When the PVC is later deleted, the PV transitions to `Released`. What happens after `Released` depends on the reclaim policy:

@@@
graph LR
    Available["Available\nno claim"] --> Bound["Bound\nPVC attached"]
    Bound --> Released["Released\nPVC deleted"]
    Released --> AdminAct["Admin clears claimRef\nRetain policy"]
    Released --> Deleted["PV removed\nDelete policy"]
    AdminAct --> Available
@@@

With `Retain`, the PV stays in `Released` indefinitely. The data on disk is untouched. An administrator must decide what to do with it before the PV can serve a new claim.

With `Delete`, Kubernetes deletes the PV object and sends a delete request to the underlying storage backend as soon as the PVC is removed.

:::warning
A `Released` PV with the `Retain` policy is not automatically reusable. It still holds a `claimRef` field pointing to the old PVC. A new PVC will not bind to it until an admin edits the PV and removes that `claimRef`. If you create a matching PVC and it stays `Pending`, check whether the target PV is stuck in `Released` state.
:::

To inspect all fields of the PV, including `claimRef` when it is populated after a binding:

```bash
kubectl describe pv postgres-pv
```

The output shows capacity, access modes, reclaim policy, the bound PVC name, and any events. Events are especially useful when a PV transitions unexpectedly to `Failed` or stays in `Released` longer than expected.

:::quiz
After deleting a PVC, the bound PV shows STATUS `Released` and reclaim policy `Retain`. What must an admin do before another PVC can bind to it?

**Answer:** The admin must edit the PV and remove the `claimRef` field that still references the deleted PVC. Until that reference is cleared, the control plane treats the PV as unavailable for new claims.
:::

A PersistentVolume is an administrative resource. Once it exists in the cluster as `Available`, the development team can reference it from a PVC without ever needing to know about the underlying `hostPath` or disk size. That separation of concerns is exactly what makes this model scale across teams.
