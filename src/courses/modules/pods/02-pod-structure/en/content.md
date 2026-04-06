---
seoTitle: 'Kubernetes Pod Structure, Manifest, Volumes, Init Containers'
seoDescription: 'Explore the anatomy of a Kubernetes Pod manifest, covering containers, env vars, resource limits, volumes, restartPolicy, and init containers.'
---

# Pod Structure and Anatomy

Now that you understand what a Pod is, it's time to open it up and look at the mechanics. A Pod manifest can look simple, just a container name and image, or it can be quite detailed, with volumes, init containers, environment variables, resource constraints, and scheduling hints. In this lesson, we'll walk through every major section of a Pod manifest so you know exactly what each field does and when to use it.

:::info
The key sections of a Pod spec are: `containers[]`, `volumes[]`, `restartPolicy`, `initContainers[]`, and scheduling hints like `nodeSelector`. Everything else builds on these.
:::

## The Complete Manifest at a Glance

Before diving into individual sections, here is a reasonably complete Pod manifest that demonstrates the most commonly used fields:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  labels:
    app: my-app
spec:
  containers:
    - name: main-container
      image: nginx:1.28
      ports:
        - containerPort: 80
      env:
        - name: ENV_VAR
          value: 'hello'
      resources:
        requests:
          memory: '64Mi'
          cpu: '250m'
        limits:
          memory: '128Mi'
          cpu: '500m'
  restartPolicy: Always
```

This manifest creates a single Pod with one container. Let's break down every piece of it, and then go beyond it to cover fields this example doesn't show.

## `spec.containers[]`

The heart of a Pod manifest is the `spec.containers` field, a list of containers that will run inside the Pod. At minimum, each container entry needs a `name` and an `image`. Everything else is optional, though you'll almost always want at least some of it.

### `name` and `image`

The `name` must be unique within the Pod (you can't have two containers with the same name in one Pod). The `image` is the container image to pull from a registry, just like you'd pass to `docker run`. You should always specify a version tag (like `nginx:1.28`) rather than relying on `latest`, which can cause unexpected behavior when a new image version is pulled without you realizing it.

### `ports`

The `ports` section documents which ports the container listens on. It's mostly informational, it doesn't actually expose or open any ports. The real networking is configured at the Service level. But declaring ports is good practice for documentation, and some tools use this information to auto-configure things. Each port entry can have a `containerPort` (required), a `name` (optional but useful for referencing in Services), and a `protocol` (defaults to TCP).

### `env`

The `env` field is a list of environment variables to inject into the container. Each entry has a `name` and a `value`. This is the simplest form, a hardcoded string. But Kubernetes also supports reading values from ConfigMaps and Secrets using `valueFrom`:

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: db-secret
        key: url
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef:
        name: app-config
        key: log_level
```

This keeps sensitive data out of your manifests and decouples configuration from code.

### `command` and `args`

By default, a container runs whatever command is baked into its image (the Docker `ENTRYPOINT` and `CMD`). You can override both fields:

```yaml
containers:
  - name: debug
    image: busybox:1.36
    command: ['sh', '-c']
    args:
      - |
        echo started
        sleep 3600
```

`command` replaces the entrypoint, `args` replaces the default command. This is especially useful for debug pods or utility containers where you need a specific behavior from a generic image without rebuilding it.

### `resources`

Resource management is critical for running a stable cluster. The `resources` field has two sub-fields:

- **`requests`** What the container is guaranteed. The scheduler uses requests to decide which node has enough capacity. If your container requests `250m` CPU and `64Mi` memory, the scheduler only places this Pod on a node that has that much available.
- **`limits`** The maximum the container is allowed to use. Exceeding the memory limit triggers an **OOMKill**. Exceeding the CPU limit causes **throttling** (slowed down, not killed).

CPU is measured in **millicores** (`250m` = a quarter of one core). Memory uses binary units (`64Mi` = 64 mebibytes).

:::info
Always set both `requests` and `limits` in production. Without `requests`, the scheduler has no information to make good placement decisions. Without `limits`, a misbehaving container can consume all the resources on a node and starve other workloads.
:::

### `volumeMounts`

If the Pod declares volumes (more on that later), containers can mount them using `volumeMounts`. Each mount specifies the volume name and where in the container's filesystem to attach it:

```yaml
volumeMounts:
  - name: data-volume
    mountPath: /var/data
  - name: config-volume
    mountPath: /etc/config
    readOnly: true
```

### Probes

Kubernetes supports `livenessProbe` and `readinessProbe` fields inside the container spec to actively check container health. A failing liveness probe triggers a container restart; a failing readiness probe removes the Pod from Service traffic without restarting it. Both sit at the same level as `env` and `resources` inside a container definition. Probes are covered in their own lesson.

## `spec.volumes[]`

Volumes are declared at the Pod level, not the container level, and then mounted into one or more containers. This design allows multiple containers in the same Pod to share the same volume. Volumes have many possible types: `emptyDir` (temporary storage that lives as long as the Pod), `configMap` and `secret` (expose Kubernetes objects as files), `persistentVolumeClaim` (durable storage), `hostPath` (mounts a path from the node's filesystem), and more.

A simple example using an `emptyDir` shared between two containers:

```yaml
spec:
  volumes:
    - name: shared-logs
      emptyDir: {}
  containers:
    - name: app
      image: myapp:1.0
      volumeMounts:
        - name: shared-logs
          mountPath: /var/log/app
    - name: log-shipper
      image: logstash:8.0
      volumeMounts:
        - name: shared-logs
          mountPath: /input
```

## `spec.restartPolicy`

The `restartPolicy` field controls what happens when a container in the Pod exits. It applies to all containers in the Pod. There are three options:

- `Always` (the default): Kubernetes will always restart the container when it exits, regardless of the exit code. This is appropriate for long-running services like web servers.
- `OnFailure`: Restart only if the container exits with a non-zero exit code (i.e., it failed). Useful for batch jobs that should retry on error but not restart on success.
- `Never`: Never restart the container, regardless of how it exits. Useful for one-shot tasks.

We'll go into this field in more depth in the lesson on container restart policies.

## `spec.nodeName` and `spec.nodeSelector`

By default, the Kubernetes scheduler decides which node to place a Pod on, and you should usually let it do its job. However, there are times when you need to influence scheduling.

`spec.nodeName` is the most direct option: you hard-code the name of the node you want the Pod to run on. This bypasses the scheduler entirely. It's rarely a good idea in production because it creates a brittle coupling between your Pod and a specific node.

`spec.nodeSelector` is a more flexible approach. You provide a set of key-value pairs, and the Pod will only be scheduled on nodes that have matching labels:

```yaml
spec:
  nodeSelector:
    disktype: ssd
    region: us-east-1
```

This means the scheduler will only consider nodes that have the label `disktype=ssd` and `region=us-east-1`. Kubernetes has more powerful scheduling features (like node affinity and taints/tolerations) for advanced use cases, but `nodeSelector` covers the majority of simple placement requirements.

## Init Containers

Init containers are a special type of container that runs **before** the main containers start. They run to completion in sequence, if you have three init containers, the first must complete successfully before the second starts, and so on. Only after all init containers have successfully completed will the main containers be started.

This is useful for preparation tasks: waiting for a database to become available, downloading a configuration file, running database migrations, or initializing a shared volume with some data.

```yaml
spec:
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command: ['sh', '-c']
      args:
        - |
          until nc -z db-service 5432
          do
            sleep 2
          done
  containers:
    - name: app
      image: myapp:1.0
```

In this example, the `wait-for-db` init container loops until port 5432 on `db-service` is reachable. Only then does the main `app` container start. This neatly solves the startup ordering problem without building the waiting logic into your application image.

:::warning
If an init container fails (exits with a non-zero code), Kubernetes will restart the Pod according to its `restartPolicy`. If the `restartPolicy` is `Always` or `OnFailure`, the init container will be retried. Make sure your init containers are idempotent, they should be safe to run multiple times.
:::

## Full Structural Overview

The diagrams below show the same structure in three compact layouts, pick the one that feels clearest to you:

@@@
stateDiagram-v2
    state "spec (Pod)" as Spec3
    state "initContainers[]" as IC3
    state "containers[]" as C3
    state "volumes[]" as V3
    state "restartPolicy" as RP3
    state "nodeSelector / nodeName" as S3
    state "name, image, ports[], env[], resources, volumeMounts[]" as CFields3
    state "emptyDir, configMap, secret, persistentVolumeClaim, hostPath" as VTypes3

    Spec3 --> IC3
    Spec3 --> C3
    Spec3 --> V3
    Spec3 --> RP3
    Spec3 --> S3
    C3 --> CFields3
    V3 --> VTypes3
@@@

## Hands-On Practice

In this exercise, you will practice the core Pod fields with a concise manifest and a few essential `kubectl` checks.

**1. Create the following manifest and save it as `simple-pod.yaml`:**

```yaml
# simple-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: simple-pod
  labels:
    app: my-app
    tier: frontend
spec:
  containers:
    - name: main-container
      image: nginx:1.28
      ports:
        - containerPort: 80
          name: http
      env:
        - name: MY_VAR
          value: 'hello-from-env'
      resources:
        requests:
          memory: '64Mi'
          cpu: '100m'
        limits:
          memory: '128Mi'
          cpu: '200m'
  restartPolicy: Always
```

Apply it:

```bash
kubectl apply -f simple-pod.yaml
```

**2. Confirm the Pod is created:**

```bash
kubectl get pod simple-pod
```

Wait until the Pod reaches `Running`.

**3. Describe the Pod to inspect its structure:**

```bash
kubectl describe pod simple-pod
```

Focus on these sections in the output:

- `Containers:`
- `Environment:`
- `Limits` and `Requests`
- `Mounts`

**4. Clean up:**

```bash
kubectl delete pod simple-pod
```

You now know how to read the essential sections of a Pod manifest and verify them live with `kubectl get` and `kubectl describe`. In the next lesson, you'll dig into the full live object, including its `status` section populated by the kubelet.
