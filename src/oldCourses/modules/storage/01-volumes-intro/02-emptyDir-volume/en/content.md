# emptyDir Volume

The `emptyDir` volume is the simplest volume type in Kubernetes. It starts empty, lives as long as the Pod does, and gets deleted when the Pod is removed. No setup, no provisioning, no external storage system needed.

Despite its simplicity, `emptyDir` is incredibly useful. Let's explore when and how to use it.

## What emptyDir Is For

Think of `emptyDir` as a shared whiteboard between containers in a Pod. While the Pod is alive, any container can write to it and any container can read from it. When the Pod goes away, the whiteboard is erased.

This makes it ideal for several scenarios:

- **Inter-container communication:**  A producer container writes data, a sidecar container reads and processes it
- **Temporary scratch space:**  Disk-based sorting, image processing, or other tasks that need temporary storage
- **Caching:**  Data that can be regenerated if lost, but is faster to read from local storage

## A Practical Example

Here's a Pod with two containers sharing an `emptyDir` volume. The producer writes a greeting file; the consumer reads it:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-storage-pod
spec:
  containers:
    - name: producer
      image: busybox
      command: ['sh', '-c', 'echo "hello from producer" > /shared/greeting && sleep 3600']
      volumeMounts:
        - name: shared-data
          mountPath: /shared
    - name: consumer
      image: busybox
      command: ['sh', '-c', 'sleep 5 && cat /shared/greeting && sleep 3600']
      volumeMounts:
        - name: shared-data
          mountPath: /shared
  volumes:
    - name: shared-data
      emptyDir: {}
```

Both containers mount the same volume at `/shared`. The producer creates a file, and the consumer reads it a few seconds later. This pattern — one container generating data, another consuming it — is the classic sidecar use case.

```mermaid
flowchart LR
  Producer["Producer container"] -->|writes to /shared| Volume["emptyDir volume"]
  Volume -->|reads from /shared| Consumer["Consumer container"]
```

## Memory-Backed emptyDir

By default, `emptyDir` uses the node's disk. But if you need faster I/O, you can back it with RAM instead by setting `medium: Memory`:

```yaml
volumes:
  - name: cache
    emptyDir:
      medium: Memory
```

This creates a `tmpfs` mount — a filesystem in RAM. It's significantly faster than disk but counts against the Pod's memory limits. If your application writes a lot of data to a Memory-backed emptyDir, make sure the Pod has enough memory allocated.

You can also set a size limit to prevent the volume from consuming too much space:

```yaml
volumes:
  - name: cache
    emptyDir:
      medium: Memory
      sizeLimit: 128Mi
```

:::info
Memory-backed `emptyDir` volumes are perfect for temporary caches that need high throughput. Just remember that the data counts against the Pod's memory usage — if the volume grows beyond the Pod's memory limit, the Pod may be evicted.
:::

## What emptyDir Is NOT For

It's important to be clear about what `emptyDir` doesn't do:

- It **does not persist data** across Pod restarts. If the Pod is deleted and recreated, the data is gone.
- It **does not survive rescheduling**. If the Pod moves to a different node, the data is lost.
- It **is not shared** between Pods. Each Pod gets its own independent `emptyDir`.

If you need data to persist, use a PersistentVolumeClaim instead. We'll cover that in the next chapter.

:::warning
A common mistake is using `emptyDir` for data you can't afford to lose. Remember: when the Pod dies, the data dies with it. If persistence matters, use a PVC.
:::

---

## Hands-On Practice

### Step 1: Create a multi-container Pod with a shared emptyDir

```bash
nano emptydir-demo.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: emptydir-demo
spec:
  containers:
    - name: writer
      image: busybox
      command: ["sh", "-c", "echo 'Hello from writer' > /shared/message.txt && sleep 3600"]
      volumeMounts:
        - name: shared-data
          mountPath: /shared
    - name: reader
      image: busybox
      command: ["sh", "-c", "sleep 5 && cat /shared/message.txt && sleep 3600"]
      volumeMounts:
        - name: shared-data
          mountPath: /shared
  volumes:
    - name: shared-data
      emptyDir: {}
```

```bash
kubectl apply -f emptydir-demo.yaml
```

### Step 2: Verify the writer created the file

```bash
kubectl exec emptydir-demo -c writer -- cat /shared/message.txt
```

### Step 3: Verify the reader can see it

```bash
kubectl exec emptydir-demo -c reader -- cat /shared/message.txt
```

Both containers share the same data through the `emptyDir` volume.

### Step 4: List files in the shared directory

```bash
kubectl exec emptydir-demo -c writer -- ls -la /shared
```

### Step 5: Clean up

```bash
kubectl delete pod emptydir-demo
```

## Wrapping Up

`emptyDir` is the go-to volume for temporary, ephemeral storage within a Pod. It's created automatically, requires no setup, and enables inter-container data sharing — one of the most common patterns in multi-container Pods. Use `medium: Memory` when you need speed, and remember that the data's lifetime is tied to the Pod's lifetime. In the next lesson, we'll look at ConfigMap and Secret volumes — a different kind of volume that injects configuration data as files.
