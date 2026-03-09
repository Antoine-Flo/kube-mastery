# emptyDir Volumes

Of all the volume types Kubernetes offers, `emptyDir` is the simplest to understand and the easiest to use. When a Pod starts, Kubernetes creates an empty directory, mounts it into the container (or containers) you specify, and deletes it permanently when the Pod is removed. Within a Pod's lifetime, it survives any number of container restarts.

:::info
Think of `emptyDir` as a temporary shared notepad for the entire Pod. Individual containers might come and go, but the notepad stays on the table, until the meeting ends and the Pod is deleted.
:::

## When to Use emptyDir

**Sharing data between containers in the same Pod** is the classic use case. This is the sidecar pattern: one container produces files and another processes or forwards them. Because both containers are in the same Pod, they share the same volumes, `emptyDir` is the natural choice for this in-Pod coordination.

A concrete example: an application writes processed events to a directory as JSON files, and a sidecar ships them to a centralized logging system. Neither container needs to know the other's internals, they just read and write to a shared directory.

**Scratch space for a single container** is the second use case. Some workloads need significant temporary storage:

- A video transcoder working with large intermediate files
- An AI inference service unpacking a large model into memory-mapped files
- A build tool compiling source code into a temporary output directory

In these cases, `emptyDir` gives the container a place to work without polluting the container image or consuming the container's layered filesystem.

## The Manifest

Here's the minimum declaration:

```yaml
spec:
  volumes:
    - name: shared-data
      emptyDir: {}
```

The `{}` is not a placeholder, it's valid YAML for an empty object, meaning "use all defaults." The name is the only required field.

## A Multi-Container Example

Let's look at a full example with two containers sharing a single `emptyDir` volume:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: writer-reader
spec:
  volumes:
    - name: shared-data
      emptyDir: {}
  containers:
    - name: writer
      image: busybox
      command: ['sh', '-c', 'echo hello > /data/file.txt && sleep 3600']
      volumeMounts:
        - name: shared-data
          mountPath: /data
    - name: reader
      image: busybox
      command: ['sh', '-c', 'sleep 2 && cat /data/file.txt && sleep 3600']
      volumeMounts:
        - name: shared-data
          mountPath: /data
```

The writer writes `hello` to `/data/file.txt`. The reader waits two seconds, then reads from the same path. Notice that both containers use the same `mountPath` here, but that's not required, you could mount the same volume at `/output` in the writer and `/input` in the reader.

## How Containers Communicate Through a Volume

```mermaid
graph LR
    subgraph "Pod: writer-reader"
        W["Writer Container\n/data/file.txt ← writes"]
        R["Reader Container\n/data/file.txt → reads"]

        V["emptyDir Volume\nshared-data\n/data/file.txt"]

        W -->|"writes to"| V
        V -->|"read by"| R
    end

    style W fill:#7ED321,color:#fff,stroke:#5a9c18
    style R fill:#4A90D9,color:#fff,stroke:#2c6fad
    style V fill:#F5A623,color:#fff,stroke:#c77d00
```

The volume is the single source of truth. There's no network call, no serialization overhead, no API to agree on, just a shared filesystem path.

## Surviving Container Restarts

The key benefit of `emptyDir` over writing to the container's own filesystem is that it survives container restarts. If the writer crashes after writing half its files and Kubernetes restarts it, the new instance finds those partially-written files still in the volume.

This makes `emptyDir` useful as a crash-recovery buffer: a container can checkpoint its progress to the volume, and after any restart, it picks up from the last checkpoint rather than starting from scratch.

:::warning
`emptyDir` does NOT survive Pod deletion or Pod rescheduling. If the Pod is evicted from a node, deleted manually, or replaced during a Deployment rollout, the emptyDir is gone. Do not use `emptyDir` for anything that needs to outlive the Pod itself. For durable persistence, use PersistentVolumes.
:::

## Memory-Backed emptyDir

By default, Kubernetes stores `emptyDir` data on the node's disk. You can opt for a **tmpfs** (in-memory) backing by setting `medium: Memory`:

```yaml
volumes:
  - name: fast-scratch
    emptyDir:
      medium: Memory
      sizeLimit: 512Mi
```

A memory-backed `emptyDir` operates at memory speed, useful for high-throughput workloads where disk I/O would be a bottleneck. The downside is that memory-backed volumes count against the container's memory limit, if a container writes 200Mi to a `medium: Memory` volume, that 200Mi comes out of its memory budget and can trigger an OOM kill.

:::info
You can set `sizeLimit` on any `emptyDir` (disk or memory). Kubernetes will evict the Pod if the volume exceeds this limit, a safety valve to prevent a runaway container from filling up a node's disk or exhausting its memory.
:::

## readOnly Mounts

When multiple containers share the same volume, you might want to prevent one of them from accidentally modifying files that another container wrote. Mount the volume as read-only in a specific container using the `readOnly` field:

```yaml
volumeMounts:
  - name: shared-data
    mountPath: /data
    readOnly: true
```

With this setting, any attempt to write returns a permission error. This is useful for enforcing clear ownership: only the writer container has a read-write mount, while all consumer containers have read-only mounts.

## Hands-On Practice

Let's recreate the writer-reader pattern and confirm that data survives a container restart. Use the terminal on the right panel.

**1. Apply the multi-container Pod manifest:**

```yaml
# writer-reader-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: writer-reader
spec:
  volumes:
    - name: shared-data
      emptyDir: {}
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "echo 'Written by writer container' > /data/message.txt && sleep 3600"]
      volumeMounts:
        - name: shared-data
          mountPath: /data
    - name: reader
      image: busybox:1.36
      command: ["sh", "-c", "sleep 2 && while true; do cat /data/message.txt; sleep 10; done"]
      volumeMounts:
        - name: shared-data
          mountPath: /data
```

```bash
kubectl apply -f writer-reader-pod.yaml
```

**2. Wait for the Pod to be running:**

```bash
kubectl get pod writer-reader
```

**3. Check the reader's logs to confirm it read the file written by the writer:**

```bash
kubectl logs writer-reader -c reader
```

You should see: `Written by writer container`

**4. Confirm both containers share the same volume contents:**

```bash
kubectl exec writer-reader -c writer -- ls /data
kubectl exec writer-reader -c reader -- ls /data
```

Both should show `message.txt`.

**5. Prove the volume survives a container restart, kill the writer and check:**

```bash
kubectl exec writer-reader -c writer -- kill 1
```

Wait a moment for it to restart:

```bash
kubectl get pod writer-reader
```

The restart count on the writer should increment to 1.

**6. Read the file from the reader, it should still be there:**

```bash
kubectl exec writer-reader -c reader -- cat /data/message.txt
```

The file is still there. The volume was not affected by the writer container's restart.

**7. Now try the memory-backed version:**

```yaml
# memory-scratch-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: memory-scratch
spec:
  volumes:
    - name: ramdisk
      emptyDir:
        medium: Memory
        sizeLimit: 64Mi
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "dd if=/dev/zero of=/scratch/bigfile bs=1M count=10 && ls -lh /scratch/ && sleep 3600"]
      volumeMounts:
        - name: ramdisk
          mountPath: /scratch
```

```bash
kubectl apply -f memory-scratch-pod.yaml
```

**8. Check the output, it wrote 10MB to memory:**

```bash
kubectl logs memory-scratch -c app
```

You should see the `bigfile` listed at 10MB, written entirely to RAM.

**9. Clean up:**

```bash
kubectl delete pod writer-reader memory-scratch
```

You've now seen `emptyDir` in action for both of its primary use cases. In the next lesson, we'll look at `hostPath` volumes, which mount directories from the underlying node's filesystem directly into Pods.
