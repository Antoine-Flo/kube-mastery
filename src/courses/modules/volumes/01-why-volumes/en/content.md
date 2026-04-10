---
seoTitle: 'Kubernetes Volumes Explained, Lifecycle, Types, Mounts'
seoDescription: 'Learn how Kubernetes volumes outlive container restarts, covering the two-step mount declaration, volume lifecycle, and the difference from PersistentVolumes.'
---

# Why Volumes?

Imagine your application writes structured logs to `/app/logs` inside its container. The app runs fine for an hour, then it crashes due to an out-of-memory error. Kubernetes restarts it automatically, which is great. But when you try to retrieve the logs from the previous run, they are gone. The container's filesystem was wiped at restart. This is not a bug; it is how containers work by design.

A container's writable layer is ephemeral. It exists only as long as the container process lives. The moment the container stops, all changes to its filesystem are discarded. For stateless HTTP services this is harmless. For anything that writes files you care about, it is a real problem.

Kubernetes solves this with **volumes**.

## What a volume is

A volume is a directory that is mounted into a container and that outlives the container's process. Think of it like a USB drive: you can plug it into different machines (containers), it persists across reboots (restarts), but if you lose the drive itself (Pod deletion), the data on it may be gone depending on the drive type.

@@@
graph LR
    subgraph Pod
        C1[Container\nrestart #1]
        C2[Container\nrestart #2]
        V[(Volume\n/app/logs)]
    end
    C1 -- writes --> V
    C2 -- reads --> V
    V -.->|survives restart| C2
@@@

When the container restarts, Kubernetes re-mounts the same volume directory at the same path. The files written by the previous container are still there.

The critical distinction: the volume is bound to the **Pod**, not to the container. Restart the container, the volume persists. Delete the Pod, the volume is gone too (for most volume types). This is by design: volumes are meant to provide durability across container crashes, not across Pod replacements.

:::info
PersistentVolumes (covered in the next module) survive Pod deletion. The volumes covered in this lesson, `emptyDir`, `hostPath`, and `configMap`, are all scoped to the Pod's lifetime.
:::

## Declaring a volume in two steps

Kubernetes uses a two-step pattern to connect a volume to a container. This separation exists because a single volume can be mounted into multiple containers inside the same Pod at different paths.

**Step 1: declare the volume under `spec.volumes`.**

```yaml
# illustrative only
spec:
  volumes:
    - name: log-storage
      emptyDir: {}
```

The `name` field is the identifier you will reference in step 2. The type (`emptyDir` here) defines how the storage is provided.

**Step 2: mount the volume inside a container using `spec.containers[].volumeMounts`.**

```yaml
# illustrative only
spec:
  containers:
    - name: app
      image: busybox
      volumeMounts:
        - name: log-storage
          mountPath: /app/logs
```

The `name` in `volumeMounts` must match exactly the `name` in `spec.volumes`. The `mountPath` is where the directory appears inside the container.

:::quiz
What is the purpose of the `name` field in both `spec.volumes` and `spec.containers[].volumeMounts`?

- It sets the filesystem label for the volume directory.
- It links the volume declaration to the container mount point.
- It defines the storage class used for provisioning.

**Answer:** It links the volume declaration to the container mount point. The `name` acts as a reference key: the `volumes` entry defines the source and the `volumeMounts` entry references it by the same name. Storage class is a PersistentVolume concept.
:::

## Putting it together: a full Pod manifest

Now combine both steps into a working Pod. This Pod writes a timestamp to `/app/logs/run.log` every five seconds.

`nano log-pod.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: log-writer
spec:
  volumes:
    - name: log-storage
      emptyDir: {}
  containers:
    - name: app
      image: busybox
      command: ["sh", "-c", "while true; do date >> /app/logs/run.log; sleep 5; done"]
      volumeMounts:
        - name: log-storage
          mountPath: /app/logs
```

Apply it:

```
kubectl apply -f log-pod.yaml
```

After a few seconds, inspect what Kubernetes sees about the volume mount:

```
kubectl describe pod log-writer
```

Look for the `Volumes` section and the `Mounts` line inside the container block. You will see `log-storage` listed with its type and the mount path confirmed.

:::quiz
After you run `kubectl describe pod log-writer`, what section shows the volumes attached to the Pod?

**Try it:** `kubectl describe pod log-writer`

**Answer:** Look for the `Volumes:` block near the bottom. Each entry shows the volume name, its type, and any relevant parameters like `MediumType` for emptyDir.
:::

## Volume lifecycle and the Pod boundary

Why does Kubernetes tie volumes to the Pod and not to individual containers? Because a Pod is the unit of co-scheduling and co-location. All containers in a Pod run on the same node and share the same network namespace. It makes sense for the storage layer to follow the same boundary.

This means that if Kubernetes evicts a Pod and schedules a replacement on a different node, a new Pod is created with a fresh volume. The old volume, and its data, stays on the old node and is cleaned up. This is not a failure; it is the expected behavior for node-local storage.

:::warning
Do not confuse a volume with a PersistentVolumeClaim. An `emptyDir` volume is not persistent storage. It holds data as long as the Pod exists on that node. If you need data to survive Pod restarts across nodes or Pod deletions, you need a PersistentVolume, which is covered in the next module.
:::

:::quiz
You have a Pod with an `emptyDir` volume. The node it runs on is cordoned and the Pod is evicted. What happens to the data in the volume?

- The data is migrated to the new node automatically.
- The data is lost because the volume is scoped to the Pod and the node.
- The data is preserved in etcd until the new Pod starts.

**Answer:** The data is lost. `emptyDir` volumes live on the node's local disk for the duration of the Pod's lifetime. When the Pod is evicted, the volume is deleted with it. There is no cross-node migration for node-local volumes.
:::

Volumes give your containers a place to write data that survives crashes. The two-step YAML pattern keeps the declaration of storage separate from how individual containers use it, which makes it easy to share one volume across multiple containers in the same Pod. Remember that this durability is bounded by the Pod's lifetime: for data that must survive Pod deletion, you will need PersistentVolumes.
