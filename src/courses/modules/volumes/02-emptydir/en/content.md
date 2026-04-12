---
seoTitle: 'Kubernetes emptyDir Volumes, Sidecar, tmpfs, Restart'
seoDescription: 'Explore emptyDir volumes in Kubernetes for sharing data between sidecar containers, scratch space, and memory-backed tmpfs storage with size limits.'
---

# emptyDir

Your application generates processed files and drops them in `/tmp/cache`. A second container in the same Pod, a log shipper, needs to read those files and forward them to a remote service. Both containers need access to the same directory. But a container's filesystem is private: container A cannot see the filesystem of container B. How do you bridge them?

This is one of the most common needs in multi-container Pods, and `emptyDir` is the simplest answer.

## What emptyDir does

An `emptyDir` volume is a temporary directory that Kubernetes creates fresh when the Pod starts. It starts empty (hence the name) and is mounted into every container that declares a `volumeMount` pointing to it. Because all containers in a Pod run on the same node and share the same volume directory, they can read and write to the same files.

@@@
graph LR
subgraph Pod
A[app container\n/tmp/cache]
S[sidecar container\n/data/cache]
E[(emptyDir\nvolume)]
end
A -- writes --> E
E -- reads --> S
@@@

The analogy: think of the `emptyDir` volume as a shared whiteboard in a room where both containers work. They both see it, they can both write on it, and it disappears when they leave the room (when the Pod is deleted).

`emptyDir` survives container restarts. If the `app` container crashes and restarts, the files it wrote to the shared directory are still there when it comes back. This is the same guarantee from the previous lesson, applied to the shared-access case.

:::info
`emptyDir` is the most common volume type for intra-Pod data sharing. It requires no external infrastructure, no storage class, and no claims. It is available in any Kubernetes cluster.
:::

## Building the Pod manifest

Start with the volume declaration:

```yaml
# illustrative only
spec:
  volumes:
    - name: shared-cache
      emptyDir: {}
```

Now add both containers and give each of them a `volumeMount` pointing to `shared-cache` at different paths:

`nano shared-pod.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cache-pair
spec:
  volumes:
    - name: shared-cache
      emptyDir: {}
  containers:
    - name: app
      image: busybox
      command:
        [
          'sh',
          '-c',
          'while true; do echo hello > /tmp/cache/data.txt; sleep 10; done'
        ]
      volumeMounts:
        - name: shared-cache
          mountPath: /tmp/cache
    - name: sidecar
      image: busybox
      command:
        ['sh', '-c', 'while true; do cat /data/cache/data.txt; sleep 10; done']
      volumeMounts:
        - name: shared-cache
          mountPath: /data/cache
```

Apply and inspect:

```bash
kubectl apply -f shared-pod.yaml
```

```bash
kubectl describe pod cache-pair
```

In the output, look for the `Volumes:` section. You will see `shared-cache` with type `EmptyDir`. Under each container, the `Mounts:` line confirms which path the shared volume appears at.

:::quiz
Two containers in the same Pod both declare a `volumeMount` with `name: shared-cache`. Container A writes a file to its mount path. What does Container B see at its own mount path?

- Nothing. Each container gets its own private copy of the volume.
- The same file. Both containers access the same underlying directory.
- An error. Two containers cannot mount the same volume.

**Answer:** The same file. An `emptyDir` volume is a single directory on the node. All containers mounting it by the same `name` access that same directory. Paths inside the container can differ, but the underlying storage is shared.
:::

## Memory-backed emptyDir with tmpfs

By default, `emptyDir` uses the node's disk. For workloads that need very fast scratch space, like an in-memory cache or a build step producing many small files, you can ask Kubernetes to back the volume with RAM using `medium: Memory`.

```yaml
# illustrative only
spec:
  volumes:
    - name: fast-scratch
      emptyDir:
        medium: Memory
        sizeLimit: 64Mi
```

This creates a `tmpfs` mount. Reads and writes happen at memory speed, which is orders of magnitude faster than disk. The tradeoff: the data counts against the container's memory limit, and it is lost if the Pod is deleted or even if the node restarts.

The `sizeLimit` field protects the node. Without it, a container could write enough data to exhaust the node's RAM. Kubernetes enforces this limit and will evict the Pod if the volume exceeds it.

:::warning
`emptyDir`, whether disk-backed or memory-backed, is not persistent. If the Pod is deleted, rescheduled on another node, or the node reboots (for `medium: Memory`), all data in the volume is gone. Never use `emptyDir` to store data you cannot afford to lose.
:::

:::quiz
You set `medium: Memory` on an `emptyDir` volume. The Pod gets deleted and rescheduled on a new node. What happens to the data?

- It is preserved in node memory across rescheduling.
- It is lost because memory-backed volumes are tied to the node and the Pod.
- It is saved to disk automatically before the Pod is evicted.

**Answer:** It is lost. `tmpfs` is RAM-local. When the Pod is deleted, the memory is freed. A new Pod on a new node starts with a fresh, empty volume.
:::

## When to use emptyDir

The log shipper sidecar pattern is the canonical use case: one container produces data, another consumes it. Beyond that, `emptyDir` is useful as scratch space during multi-step processing (download a file, decompress it, transform it), as a shared socket directory between two containers, or as a fast in-memory buffer for high-throughput workloads.

Why does Kubernetes not make inter-container sharing automatic, without requiring a volume? Because it keeps the container model clean: each container has its own private root filesystem. Sharing must be explicit. This prevents accidental coupling and makes the Pod's data flow visible in the YAML manifest.

`emptyDir` is deliberately simple. It asks nothing from the cluster infrastructure, it is always available, and it does exactly one thing: give containers in the same Pod a shared directory for the duration of the Pod's life.
