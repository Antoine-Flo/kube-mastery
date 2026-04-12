---
seoTitle: 'Kubernetes Volumes, Ephemeral Container Filesystem, Why Persistence Matters'
seoDescription: 'Understand why container filesystems are discarded on restart, how Kubernetes Volumes solve this, and the two-step declaration pattern every volume requires.'
---

# Why Volumes?

Your application writes a log file to `/var/log/app.log`. The container crashes. Kubernetes restarts it. The log file is gone.

This is not a bug. It is how containers are designed to work. Every container gets a private filesystem built from its image layers. When the container process exits, that filesystem is discarded. The next container starts from a clean slate, identical to what the image provides. This predictability is what makes containers reproducible and easy to distribute. But it means anything written to the container's own filesystem during runtime disappears the moment the container stops.

Most real applications need to persist at least some data across restarts: log files, uploaded files, database records, configuration state. For those cases, the container filesystem is not enough.

## Container Lifetime vs Pod Lifetime

The key distinction in Kubernetes is between two different lifetimes.

A container can crash and restart many times within the life of a single Pod. Each restart gives the container a fresh filesystem. But the Pod object itself keeps running through those restarts. A Volume is attached to the Pod, not to any individual container. Data written to a Volume survives container restarts because the Volume is mounted from outside the container at Pod creation time.

@@@
sequenceDiagram
participant P as Pod
participant C as Container filesystem
participant V as Volume

    P->>C: created (clean image layers)
    P->>V: mounted

    C->>C: write /tmp/cache.bin
    V->>V: write /data/record.db

    Note over C,V: Container crashes and restarts

    C->>C: wiped, fresh from image
    Note over V: untouched

    Note over C: /tmp/cache.bin gone
    Note over V: /data/record.db still there

@@@

The Pod's lifetime is a different story. When the Pod is deleted, most volume types are deleted with it. This is intentional for temporary data. For data that must outlive a Pod deletion or a rolling update, you need a PersistentVolume, which this module covers in lesson 4.

:::quiz
A container writes a file to `/tmp/session.json`. The container crashes and the kubelet restarts it. Is `/tmp/session.json` still there?

**Answer:** No. `/tmp` is inside the container's own filesystem, not in a Volume. When the container crashes, its filesystem is discarded. The new container starts with a clean copy of the image and `/tmp/session.json` does not exist in the image, so it is gone. Only data written to a mounted Volume survives the restart.
:::

## The Two-Step Declaration

You cannot simply reference a volume path in a container spec. Every volume in Kubernetes requires two coordinated declarations.

The first is in `spec.volumes[]`, at the Pod level. This names the volume and specifies what kind of storage it represents.

The second is in `spec.containers[].volumeMounts[]`, inside a specific container. This declares the path inside the container where the volume is accessible.

```yaml
# illustrative only
spec:
  volumes:
    - name: data
      emptyDir: {}
  containers:
    - name: app
      image: my-app:1.0
      volumeMounts:
        - name: data
          mountPath: /var/data
```

The `name` field is the link between the two declarations. It must match exactly. If it does not, the Pod fails to start with a validation error.

:::warning
A common mistake is declaring a volume in `spec.volumes` but forgetting to add the corresponding `volumeMount` in the container. The volume exists in the Pod spec but is completely inaccessible from inside any container. The container sees no trace of it and writes to its own ephemeral filesystem instead. Always check both declarations.
:::

One volume can be mounted into multiple containers within the same Pod at the same or different paths. This is how containers in a multi-container Pod share files without any network overhead.

:::quiz
You have a volume named `logs` declared in `spec.volumes`. You add a `volumeMount` in container A with `name: log` (missing the `s`). What happens?

**Answer:** The Pod fails to start. Kubernetes validates that every `volumeMount.name` in a container corresponds to an entry in `spec.volumes`. A mismatch causes the Pod to be rejected with a clear error message listing the unresolvable volume name.
:::

Volumes extend the container's ephemeral filesystem into something that survives restarts. The following lessons cover the specific volume types you will use most: `emptyDir` for shared scratch space, ConfigMap and Secret volumes for injecting configuration, and PersistentVolumes for data that must outlive the Pod itself.
