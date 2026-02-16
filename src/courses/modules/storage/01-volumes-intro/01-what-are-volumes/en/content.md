# What Are Volumes?

Here's a fundamental truth about containers: their filesystem is temporary. When a container restarts, everything written inside it disappears — config files, cached data, uploaded images, all gone. For many applications, that's a serious problem.

**Volumes** solve this by providing storage that exists outside the container's filesystem. A volume is a directory accessible to one or more containers in a Pod. Depending on the type, it can be temporary (lasting only as long as the Pod) or persistent (surviving restarts and even rescheduling to different nodes).

## Why Volumes Matter

Think of a container's filesystem as a whiteboard. You can write whatever you want on it, but when the whiteboard is replaced (container restart), everything is erased. A volume is like a notebook sitting next to the whiteboard — it stays even when the whiteboard is swapped.

Volumes serve three main purposes in Kubernetes:

- **Sharing data between containers** — Two containers in the same Pod can mount the same volume, each at a different path. One writes, the other reads.
- **Persisting data** — With PersistentVolumeClaim volumes, data survives Pod restarts, rescheduling, and even node failures.
- **Injecting configuration** — ConfigMap and Secret volumes let you mount configuration files and credentials without baking them into your container image.

## How Volumes Are Defined

Volumes are defined at the **Pod level**, not the container level. You declare them in the `spec.volumes` section, and then each container mounts them using `volumeMounts`. The volume name must match between the two sections.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-with-volume
spec:
  containers:
    - name: app
      image: nginx
      volumeMounts:
        - name: data-vol
          mountPath: /usr/share/nginx/html
  volumes:
    - name: data-vol
      emptyDir: {}
```

In this example, an `emptyDir` volume is mounted at `/usr/share/nginx/html`. The volume is created when the Pod starts and deleted when the Pod is removed.

:::info
All containers in a Pod can access the same volume — each mounting it at a different path. This is the primary mechanism for inter-container communication within a Pod.
:::

## Volume Types at a Glance

Kubernetes supports many volume types. Here are the most common ones you'll encounter:

- **emptyDir** — Temporary storage, created with the Pod, deleted with the Pod. Great for scratch space and inter-container sharing.
- **configMap** and **secret** — Read-only volumes that inject configuration data or sensitive information as files.
- **persistentVolumeClaim (PVC)** — Binds to a PersistentVolume for data that needs to survive Pod restarts.
- **hostPath** — Mounts a directory from the node. Useful for development but risky in production multi-node clusters.
- **CSI volumes** — Provisioned via StorageClass for cloud block storage and other backends.

Each type has different lifecycle and sharing semantics. We'll explore the most important ones in detail throughout this chapter.

## Trying It Out

Let's verify a volume mount on a running Pod:

```bash
# See the volumes defined on a Pod
kubectl get pod pod-with-volume -o jsonpath='{.spec.volumes}'

# Check the mount inside the container
kubectl exec pod-with-volume -- ls -la /usr/share/nginx/html
```

You can also use `subPath` in `volumeMounts` to mount a specific file or subdirectory rather than the entire volume root — useful when you need to mount a single config file without overwriting the entire directory.

## Common Issues

**Volume mount fails** — Make sure the volume name in `volumes` matches exactly with `volumeMounts`. A typo here means the mount silently doesn't happen.

**Permission denied** — The container user may not have access to the mounted files. Adjust `fsGroup` or `runAsUser` in the Pod's security context.

**PVC stuck in Pending** — No matching PersistentVolume exists. Check that a PV with the right size and access mode is available, or that a StorageClass can dynamically provision one.

:::warning
The volume type determines the data's lifecycle. An `emptyDir` volume disappears with the Pod. A PVC-backed volume persists independently. Choose the right type for your use case — using `emptyDir` for data you can't afford to lose is a common mistake.
:::

## Wrapping Up

Volumes bridge the gap between containers' ephemeral filesystems and the real-world need for shared, persistent, or injected data. They're defined at the Pod level and mounted per container. In the next lessons, we'll dive into specific volume types — starting with `emptyDir`, the simplest and most commonly used ephemeral volume.
