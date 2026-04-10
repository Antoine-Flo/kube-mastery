---
seoTitle: Mount PersistentVolumeClaims in Kubernetes Pods, Storage
seoDescription: Learn how to reference a PVC in a Kubernetes Pod spec, confirm data survives Pod deletion, and understand access mode constraints for multi-replica workloads.
---

# Using PVCs in Pods

The PVC is `Bound`. The PV is `Bound`. The storage is provisioned and waiting. The final step is telling the Pod how to find it and where to expose it inside the container. This requires two coordinated sections in the Pod spec: one that introduces the volume by name, and one that places it at a path inside the container.

## Wiring the PVC into a Pod

Think of it as a two-step connection. The Pod-level `volumes` list introduces the volume and gives it a local name. The container-level `volumeMounts` list says "take that named volume and put it at this path inside me."

Start with the `volumes` entry. It names the volume and points to the PVC:

```yaml
# illustrative only
volumes:
  - name: postgres-storage
    persistentVolumeClaim:
      claimName: postgres-pvc
```

The `name` here is an internal label used only to connect this entry to a `volumeMount`. The `claimName` is the name of the PVC that is already `Bound`.

Now add `volumeMounts` inside the container definition. The `name` must match the one declared in `volumes`:

```yaml
# illustrative only
containers:
  - name: postgres
    image: postgres:15
    volumeMounts:
      - name: postgres-storage
        mountPath: /var/lib/postgresql/data
```

The `mountPath` is the directory inside the container where the PV data appears. Whatever was previously at that path in the container image is replaced by the contents of the persistent volume.

Assemble the full Pod manifest:

```bash
nano db-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: postgres-pod
spec:
  volumes:
    - name: postgres-storage
      persistentVolumeClaim:
        claimName: postgres-pvc
  containers:
    - name: postgres
      image: postgres:15
      env:
        - name: POSTGRES_PASSWORD
          value: mysecretpassword
      volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
```

```bash
kubectl apply -f db-pod.yaml
```

```bash
kubectl describe pod postgres-pod
```

In the `Volumes` section of the describe output, you see `postgres-pvc` listed with type `PersistentVolumeClaim`. In `Mounts`, you see `/var/lib/postgresql/data from postgres-storage`. The storage is live.

:::quiz
In a Pod spec, what is the purpose of the `volumes` list compared to `volumeMounts`?

- `volumes` declares storage sources at the Pod level; `volumeMounts` tells each container where to access a named volume
- `volumes` and `volumeMounts` are interchangeable and either can go in the container spec
- `volumeMounts` declares storage sources; `volumes` selects which containers use them

**Answer:** `volumes` declares storage sources at the Pod level (including the PVC reference); `volumeMounts` tells each container which named volume to mount and at what path inside the container filesystem.
:::

## Data Surviving Pod Deletion

@@@
graph LR
    Pod1["postgres-pod\ndeleted"] --> PVC["postgres-pvc\nstill Bound"]
    PVC --> PV["postgres-pv\ndata preserved"]
    PV --> PVC2["postgres-pvc\nstill Bound"]
    PVC2 --> Pod2["postgres-pod\nrecreated, sees data"]
@@@

This is the core guarantee of PersistentVolumes. Delete the Pod:

```bash
kubectl delete pod postgres-pod
```

Now check the PVC:

```bash
kubectl get pvc
```

The PVC is still `Bound`. The PV still exists with its data intact. Recreate the Pod using the same manifest, and the database finds its data exactly where it left it.

Why does the PVC not get deleted along with the Pod? Because PVCs are independent Kubernetes objects. A Pod does not own its PVC. Deleting a Pod only removes the Pod resource. The PVC lifecycle is controlled separately, which is what allows new Pods to reuse the same storage over time.

Why does Kubernetes design it this way? Because tightly coupling PVC deletion to Pod deletion would make it too easy to accidentally destroy data. By separating the two lifecycles, a developer must explicitly delete the PVC to release the storage, making data loss a deliberate action rather than a side effect.

:::quiz
You delete a Pod that was using a PVC. What happens to the PVC and its data?

**Try it:** `kubectl get pvc`

**Answer:** The PVC remains `Bound` and the PV data is untouched. Deleting a Pod does not affect its PVCs. Only explicitly deleting the PVC resource changes its state.
:::

## The ReadWriteOnce Constraint with Multiple Replicas

:::warning
If your PV uses `ReadWriteOnce`, it can only be mounted on one node at a time. This becomes a problem with Deployments that have more than one replica scheduled on different nodes. The second Pod that tries to mount the PVC on a different node enters `Pending` with an error along the lines of "Multi-Attach error for volume: volume is already exclusively attached to one node and can't be attached to another."

The first Pod holds the mount, and the second waits indefinitely. This is not a bug. It is the access mode contract being enforced by the kubelet and the storage backend. If your workload genuinely needs multiple replicas that all write to the same volume from different nodes, you need a `ReadWriteMany`-capable storage backend such as NFS or CephFS.
:::

For stateful workloads with a single writer (most SQL databases, most message queues), `ReadWriteOnce` is the correct and safe choice. The one-node restriction aligns naturally with the single-writer requirement of those systems.

Mounting a PVC in a Pod completes the static provisioning flow. From here, the remaining variables are which access mode fits your workload and what happens to the data when the PVC is eventually deleted: topics covered in the next lesson.
