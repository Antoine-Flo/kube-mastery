# Why Volumes?

A container has its own private filesystem, built from the image layers. When the container process starts, it can read and write files anywhere in that filesystem. But this filesystem has a property that surprises many people the first time they encounter it: it is completely discarded when the container stops. If the container crashes and Kubernetes restarts it, the new container starts with a clean filesystem from the image. Everything the previous container wrote is gone.

This behavior is intentional. Containers are designed to be stateless and reproducible. An image is immutable, and every container started from the same image is identical. That predictability is what makes scaling, updating, and debugging so straightforward. But most real applications need to persist at least some data - log files, uploaded files, database records, cache state - and for those cases, the ephemeral filesystem is a problem.

:::info
Kubernetes **Volumes** solve this problem by attaching storage to a Pod's lifecycle rather than to a container's lifecycle. Data written to a volume survives container restarts, because the volume is not part of the container's own filesystem.
:::

## The Container and the Pod Are Different Lifetimes

The key insight is that Kubernetes distinguishes between two different lifetimes. A container can crash and be restarted by the kubelet multiple times within the same Pod's lifetime. Each restart gives the container a fresh copy of its own filesystem - but any volumes attached to the Pod are untouched. The volume persists across container restarts because it's mounted from outside the container, at the Pod level.

The Pod itself has a different lifetime. When the Pod is deleted - either explicitly by `kubectl delete pod`, or implicitly by a rolling update or node failure - most volume types are also deleted along with it. This is fine for temporary data that doesn't need to outlive a deployment cycle, but for data that must survive Pod deletion, you need a different kind of storage.

Kubernetes handles this distinction explicitly. **Volumes** are declared inside the Pod spec and live for the Pod's lifetime. **PersistentVolumes** are separate cluster resources that can outlive any Pod and be reattached to new Pods. This module covers both.

## Declaring a Volume Always Requires Two Steps

You can't just declare a volume and expect containers to see it. Every volume in Kubernetes requires two coordinated declarations.

The first step is declaring the volume at the Pod level, inside `spec.volumes[]`. This is where you give the volume a name and specify what kind of storage it represents - temporary disk space, a ConfigMap, a PersistentVolumeClaim, and so on.

The second step is mounting the volume inside a specific container, in `spec.containers[].volumeMounts[]`. This attaches the volume to a path inside the container's filesystem. Without a mount, the volume exists in the Pod spec but is completely inaccessible from inside any container.

```yaml
spec:
  volumes:
    - name: my-data       # step 1: declare the volume
      emptyDir: {}
  containers:
    - name: app
      image: my-app:1.0
      volumeMounts:
        - name: my-data   # step 2: mount it (name must match exactly)
          mountPath: /var/data
```

The `name` field is the link between the two declarations. It must match exactly. One volume can be mounted into multiple containers in the same Pod, at the same or different paths - this is how containers share files within a Pod.

## Hands-On Practice

Let's prove the ephemeral nature of the container filesystem before we introduce volumes.

**1. Start a Pod and write a file to its container filesystem:**

```bash
kubectl run ephemeral-demo \
  --image=busybox:1.36 \
  -- sh -c "echo 'I will not survive' > /tmp/message.txt && sleep 3600"
```

**2. Wait for the Pod to be running, then read the file:**

```bash
kubectl get pod ephemeral-demo
kubectl exec ephemeral-demo -- cat /tmp/message.txt
```

The file is there - `I will not survive`.

**3. Force a container restart by killing the process:**

```bash
kubectl exec ephemeral-demo -- kill 1
```

**4. Watch the restart happen:**

```bash
kubectl get pod ephemeral-demo --watch
```

Press Ctrl+C once the `RESTARTS` column increments to 1. The Pod is still running - the same Pod object still exists - but the container inside it was restarted.

**5. Try to read the file again:**

```bash
kubectl exec ephemeral-demo -- cat /tmp/message.txt
```

The file is gone. The container restarted with a clean filesystem from the image. The `/tmp/message.txt` file never existed in the image, so the new container has no trace of it.

**6. Clean up:**

```bash
kubectl delete pod ephemeral-demo
```

In the next lesson, you'll add an `emptyDir` volume to a Pod and prove that data written to a volume survives exactly this kind of restart.
