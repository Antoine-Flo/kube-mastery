---
seoTitle: 'Kubernetes emptyDir Volume, Shared Scratch Space, Container Communication'
seoDescription: 'Learn how emptyDir volumes provide temporary shared storage for containers in the same Pod, surviving container restarts but not Pod deletion.'
---

# emptyDir

The simplest volume type in Kubernetes is `emptyDir`. It starts as an empty directory when the Pod is created and exists for as long as the Pod does. When the Pod is deleted, the emptyDir is permanently gone.

That sounds limiting, but it covers a large category of real use cases. A sidecar container that pre-processes files before the main container reads them. A web server and a log shipper that share a log directory. Two containers that need to pass data to each other without making a network call. For all of these, emptyDir is the right tool.

## What emptyDir Gives You

The volume starts empty and is backed by the node's local disk by default. Both containers in the same Pod can mount it at different paths and see the same files. A write from one container is immediately visible to the other.

@@@
graph LR
    subgraph POD["Pod"]
        A["Container: app<br/>mountPath: /output"]
        B["Container: shipper<br/>mountPath: /input"]
        V["emptyDir: shared-logs"]
    end

    A -->|write| V
    V -->|read| B
@@@

The lifecycle rule is strict: the volume survives container crashes and restarts, but it is destroyed when the Pod itself is deleted. If you need this data to survive a Pod replacement or a rolling update, emptyDir is the wrong choice. Use a PersistentVolume instead.

## A Working Example

Here is a Pod with two containers sharing an emptyDir volume. The first container writes a message to a file every few seconds. The second container reads from that file. Create it:

```bash
nano shared-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-pod
spec:
  volumes:
    - name: shared-logs
      emptyDir: {}
  containers:
    - name: writer
      image: busybox:1.36
      command: ["/bin/sh", "-c"]
      args:
        - while true; do echo "$(date) - alive" >> /output/log.txt; sleep 3; done
      volumeMounts:
        - name: shared-logs
          mountPath: /output
    - name: reader
      image: busybox:1.36
      command: ["/bin/sh", "-c"]
      args:
        - tail -f /input/log.txt
      volumeMounts:
        - name: shared-logs
          mountPath: /input
```

```bash
kubectl apply -f shared-pod.yaml
```

Wait for the Pod to be running:

```bash
kubectl get pod shared-pod --watch
```

Press Ctrl+C once it shows `Running`. Now read the reader container's logs to see what the writer is producing:

```bash
kubectl logs shared-pod -c reader
```

You should see timestamped lines being printed. The writer container writes to `/output/log.txt`, and the reader container reads from `/input/log.txt`. Both paths point to the same `emptyDir` volume. The names `/output` and `/input` are just the mount paths inside each container. The actual data is in the shared volume.

:::quiz
The writer container in the Pod above crashes and is restarted by the kubelet. After it restarts, does `log.txt` still exist?

**Try it:** `kubectl exec shared-pod -c writer -- ls /output`

**Answer:** Yes. The emptyDir volume is attached to the Pod, not to the container. The container restarted, but the Pod is still the same Pod, so the volume and its contents are untouched. The writer will append new lines to the existing file rather than starting fresh.
:::

## Proving Pod Deletion Destroys the Volume

Now delete the Pod:

```bash
kubectl delete pod shared-pod
```

Recreate it:

```bash
kubectl apply -f shared-pod.yaml
kubectl get pod shared-pod --watch
```

Once it is running, check the reader logs again:

```bash
kubectl logs shared-pod -c reader
```

The log starts from a fresh timestamp. The previous contents are gone. A new Pod means a new emptyDir, even if the Pod has the same name and runs on the same node.

:::warning
Do not use emptyDir for data you care about keeping. It has no persistence guarantee beyond the Pod's lifetime. A rolling update, a node eviction, or a manual `kubectl delete pod` all destroy the volume and everything in it. If the data matters, use a PersistentVolumeClaim.
:::

## Memory-Backed emptyDir

There is one variant worth knowing: `emptyDir` with `medium: Memory`. This stores the volume contents in RAM (tmpfs on Linux) instead of on disk. It is faster and is never flushed to a physical drive.

```yaml
# illustrative only
volumes:
  - name: fast-scratch
    emptyDir:
      medium: Memory
      sizeLimit: 64Mi
```

Use this for ephemeral data that is performance-sensitive and should never touch disk, such as decrypted secrets or intermediate processing buffers. The `sizeLimit` field is important here: memory is a shared resource on the node, and an unbounded memory volume can starve other Pods.

:::quiz
You need two containers in a Pod to share a temporary working directory that is only needed during the Pod's lifetime and should be as fast as possible. Which volume type fits best?

- `hostPath`, because it uses the node's local disk
- `emptyDir` with `medium: Memory`, because it stores data in RAM
- `emptyDir` without any medium, because it uses local disk and is simple

**Answer:** `emptyDir` with `medium: Memory`. It is the fastest option and the data is truly temporary, fitting perfectly within the emptyDir lifecycle. hostPath creates a dependency on a specific node, which breaks rescheduling.
:::

Clean up:

```bash
kubectl delete pod shared-pod
```

emptyDir is the go-to volume for inter-container file sharing and scratch space within a single Pod. It requires no infrastructure, no provisioning, and no cleanup. The next lesson introduces a different volume use case: injecting configuration files and secrets directly into the container filesystem.
