---
seoTitle: 'Kubernetes hostPath Volumes, DaemonSets, Types, Security'
seoDescription: 'Understand hostPath volumes in Kubernetes, when to use them for log collection and node monitoring, the type field options, and critical security warnings.'
---

# hostPath

You are deploying a log collection agent as a DaemonSet. Its job is to read log files that other Pods write to the node's filesystem under `/var/log/pods`. An `emptyDir` volume cannot help here: it starts empty and is private to the Pod. You need to reach into the node's own filesystem and read what is already there. This is the exact problem `hostPath` was designed for.

## What hostPath does

A `hostPath` volume mounts a path from the **node's filesystem** directly into the container. Unlike `emptyDir`, the directory already exists on the node before the Pod starts. The container sees it as if it were part of its own filesystem, but reads and writes go straight to the node's disk.

@@@
graph LR
    N[Node filesystem\n/var/log/pods]
    subgraph Pod
        V[(hostPath volume)]
        C[log-collector container\n/host-logs]
    end
    N -- mounted as --> V
    V --> C
@@@

Think of it like mounting a network drive. The drive exists independently of the machine you plug it into. The container accesses the node's directory through the mount point, but the data lives on the node.

## Building the manifest

Start with the volume declaration, which requires a `path` (the node-side location) and optionally a `type`:

```yaml
# illustrative only
spec:
  volumes:
    - name: node-logs
      hostPath:
        path: /var/log/pods
        type: Directory
```

Then mount it into the container:

`nano log-collector.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: log-collector
spec:
  volumes:
    - name: node-logs
      hostPath:
        path: /var/log/pods
        type: Directory
  containers:
    - name: collector
      image: busybox
      command: ["sh", "-c", "ls /host-logs && sleep 3600"]
      volumeMounts:
        - name: node-logs
          mountPath: /host-logs
```

Apply and inspect the mount:

```
kubectl apply -f log-collector.yaml
```

```
kubectl describe pod log-collector
```

Look at the `Volumes:` section. You will see the `hostPath` entry with the `Path` and `Type` fields. The `Mounts:` line inside the container block confirms `/host-logs`.

:::info
In the simulator, `hostPath` is fully supported. It mounts a path from the simulated node's virtual filesystem, not from the real host machine running your browser. You can read and write to these paths just as you would in a real cluster.
:::

## The type field

The `type` field tells Kubernetes what to check before mounting. This is a pre-flight validation, not storage provisioning.

`Directory` requires the path to exist and be a directory. `File` requires it to exist and be a regular file. `DirectoryOrCreate` creates the directory if it does not exist. `FileOrCreate` creates the file if it does not exist. `Socket` requires a Unix socket at that path, which is used for tools that communicate through sockets like the Docker daemon. `CharDevice` and `BlockDevice` are for device files used in specialized hardware access scenarios.

If the type check fails, the Pod fails to start with a clear error message in `kubectl describe pod`.

:::quiz
You set `type: Directory` but the path `/var/custom-logs` does not exist on the node. What happens when you apply the Pod manifest?

- Kubernetes creates the directory and the Pod starts normally.
- The Pod fails to start because the directory does not exist.
- The Pod starts but the volume mount is silently skipped.

**Answer:** The Pod fails to start. `type: Directory` is a pre-mount check. If the path does not exist, the kubelet rejects the mount and sets the Pod to a failed state. Use `type: DirectoryOrCreate` if you want Kubernetes to create it automatically.
:::

## When hostPath is legitimate

The valid use cases for `hostPath` are narrow. Log collection agents (like Fluentd or Fluent Bit) running as DaemonSets mount `/var/log` or `/var/log/pods` to read logs written by the container runtime. Security monitoring tools like Falco mount `/var/run/docker.sock` or the containerd socket to observe system calls. Node monitoring agents may mount `/proc` or `/sys` to read kernel metrics.

What these cases share: they are system-level agents that need privileged access to node internals, and they are deployed by cluster administrators, not by application developers.

:::quiz
Why is `hostPath` commonly used in DaemonSets but rarely in regular application Pods?

**Answer:** DaemonSets run exactly one Pod per node and are deployed for cluster-level concerns like logging, monitoring, and security. They legitimately need to access node-local paths. Regular application Pods should be stateless and node-independent; giving them access to the node filesystem breaks that isolation and creates a maintenance and security liability.
:::

## Security warning

`hostPath` is one of the most dangerous volume types in Kubernetes.

:::warning
A container with a `hostPath` mount to `/` has full read-write access to the entire node filesystem. An attacker who can execute code in that container can read secrets from `/etc`, modify system binaries, or escape the container entirely. Never mount `/`, `/etc`, `/usr`, or `/bin` with a `hostPath` volume. Restrict `hostPath` to specific, narrow paths needed for legitimate system tools. In production clusters, admission controllers like OPA Gatekeeper or Kyverno are commonly used to block unauthorized `hostPath` mounts entirely.
:::

Why does Kubernetes allow this at all? Because Kubernetes is designed to run the full spectrum of workloads, including privileged node-level agents that genuinely need this access. The responsibility for deciding whether a workload should have this privilege falls on the cluster administrator, not the scheduler.

`hostPath` is a powerful tool for a narrow set of system-level use cases. If you reach for it for an application workload, that is almost always a design problem worth revisiting.
