---
seoTitle: "Kubernetes emptyDir, Sidecar Pattern, Shared Scratch Space"
seoDescription: "Explore emptyDir volumes for sharing temporary data between containers in the same Pod, covering the sidecar pattern and memory-backed storage."
---

# emptyDir: Shared Scratch Space

`emptyDir` is the simplest volume type. When a Pod is scheduled to a node, Kubernetes creates an empty directory on that node's disk and makes it available as a volume. The directory starts empty - hence the name. When the Pod is deleted, the directory is deleted with it. But as long as the Pod is running, the directory persists across any number of container restarts inside that Pod.

That last point is what makes `emptyDir` useful. It fills the gap between two extremes: data that you need to survive container restarts but don't need to survive Pod deletion. And because the volume is mounted at the Pod level and can be mounted by multiple containers simultaneously, it's the standard way for two containers in the same Pod to share files.

:::info
`emptyDir` is created empty when the Pod starts, survives container crashes and restarts, and is deleted when the Pod is deleted. It can be mounted by multiple containers in the same Pod simultaneously.
:::

## The Sidecar Pattern

The most common use of `emptyDir` is in the **sidecar pattern**, where a helper container runs alongside a main application container in the same Pod. The main container writes output - log files, generated files, processing results - to a shared volume, and the sidecar reads from it to do something with that output: ship it to a log aggregator, transform it, serve it over HTTP, or archive it. Neither container needs to know the other's address; they share a directory.

```yaml
spec:
  volumes:
    - name: shared-logs
      emptyDir: {}
  containers:
    - name: app
      image: my-app:1.0
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/app
    - name: log-shipper
      image: fluentd:v1.16
      volumeMounts:
        - name: shared-logs
          mountPath: /input
```

The `app` container writes logs to `/var/log/app`. The `log-shipper` container reads from `/input`. Both paths map to the same underlying directory on the node. If the `app` container crashes and restarts, the `log-shipper` still has access to the files that were written before the crash.

## Memory-Backed emptyDir

By default, `emptyDir` uses the node's regular disk storage. You can also configure it to use memory, which makes it much faster but limits its size to the node's available RAM:

```yaml
volumes:
  - name: fast-cache
    emptyDir:
      medium: Memory
      sizeLimit: 64Mi
```

This is useful for temporary data that is accessed frequently and for which disk I/O would be a bottleneck - things like build caches, processing buffers, or shared state between two tightly coupled containers. The data is completely lost when the Pod is deleted, just like disk-backed `emptyDir`.

## Hands-On Practice

**1. Create a two-container Pod sharing an emptyDir volume:**

```yaml
# emptydir-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: emptydir-demo
spec:
  volumes:
    - name: shared
      emptyDir: {}
  containers:
    - name: producer
      image: busybox:1.36
      args: ["sleep", "3600"]
      volumeMounts:
        - name: shared
          mountPath: /shared
    - name: consumer
      image: busybox:1.36
      args: ["sleep", "3600"]
      volumeMounts:
        - name: shared
          mountPath: /shared
```

```bash
kubectl apply -f emptydir-pod.yaml
kubectl get pod emptydir-demo
```

**2. Write a file from the producer container:**

```bash
kubectl exec emptydir-demo -c producer -- touch /shared/message.txt
```

The file is written into the mounted `emptyDir` path.

**3. Read the same file from the consumer container:**

```bash
kubectl exec emptydir-demo -c consumer -- cat /shared/message.txt
```

The command succeeds, even though a different container created the file. Both containers see the same shared directory mounted at `/shared`.

**4. Prove the volume survives a container restart:**

```bash
kubectl exec emptydir-demo -c producer -- kill 1

kubectl get pod emptydir-demo --watch
```

Press Ctrl+C once the `RESTARTS` column shows 1 for the producer. The producer container restarted, but the Pod is still alive.

**5. The file is still there:**

```bash
kubectl exec emptydir-demo -c consumer -- cat /shared/message.txt
```

The file persists because it's in the `emptyDir` volume, not in the container's own filesystem. The producer's restart didn't touch it.

**6. Clean up:**

```bash
kubectl delete pod emptydir-demo
```
