---
seoTitle: 'Linux Capabilities readOnlyRootFilesystem allowPrivilegeEscalation Kubernetes'
seoDescription: 'Harden Kubernetes containers by dropping Linux capabilities, enabling read-only root filesystem, and blocking privilege escalation with securityContext.'
---

# Capabilities and Read-Only Root Filesystem

Running as a non-root UID is a strong first step. But a process that runs as UID 1000 can still hold Linux capabilities inherited from the container runtime. And a process without any dangerous capabilities can still write malware to its own filesystem if it gets compromised. Two container-level fields address these remaining attack surfaces: `capabilities` and `readOnlyRootFilesystem`. Together with `allowPrivilegeEscalation: false`, they form the practical hardening checklist for a container.

## Linux capabilities in practice

Recall from the first lesson that Linux capabilities break root into discrete privileges. The container runtime grants a default set when it starts a container. That set typically includes `CAP_NET_RAW` (raw socket access), `CAP_CHOWN` (change file ownership), `CAP_SETUID`, `CAP_SETGID`, and around a dozen others. Most applications need none of them.

@@@
graph LR
  DEF["Container default\ncapability set"]
  DEF --> RAW["CAP_NET_RAW"]
  DEF --> CHOWN["CAP_CHOWN"]
  DEF --> SETUID["CAP_SETUID"]
  DEF --> MORE["... ~14 more"]
  HARD["After: drop ALL\nadd NET_BIND_SERVICE"]
  HARD --> BIND["CAP_NET_BIND_SERVICE\n(port < 1024)"]
@@@

The recommended pattern is: drop all capabilities first, then add back only the ones the application genuinely needs. This is the principle of least privilege applied at the kernel level.

```bash
nano hardened-pod.yaml
```

Start with the drop-all baseline:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened-pod
spec:
  containers:
    - name: app
      image: nginx:1.28
      securityContext:
        capabilities:
          drop:
            - ALL
```

```bash
kubectl apply -f hardened-pod.yaml
```

```bash
kubectl describe pod hardened-pod
```

In the `Security Context` block, look for `Drop: [ALL]`. That single entry tells the runtime to strip every capability from the container before it starts. If the application needs to bind to a port below 1024, you would add `NET_BIND_SERVICE` back:

```yaml
# illustrative only
securityContext:
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE
```

:::quiz
Why is `drop: ["ALL"]` followed by specific `add` entries safer than relying on the default capability set?

**Answer:** The default set includes capabilities the application may never use but that an attacker could leverage after compromising the process. For example, `CAP_NET_RAW` allows crafting arbitrary raw packets, which is useful for network attacks. Dropping all and adding back only what is needed means a compromised container has the smallest possible kernel-level attack surface. This is least privilege applied at the syscall boundary.
:::

## allowPrivilegeEscalation: blocking setuid

Even without dangerous capabilities, a container can escalate privileges through setuid binaries, programs that run with the owner's permissions rather than the caller's. `allowPrivilegeEscalation: false` prevents any process in the container from gaining more privileges than its parent process holds. It blocks setuid and setgid execution at the kernel level.

Add it to the manifest:

```bash
nano hardened-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened-pod
spec:
  containers:
    - name: app
      image: nginx:1.28
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL
```

```bash
kubectl apply -f hardened-pod.yaml
```

This field is container-level only, for the same reason capabilities are container-level: it is a per-process property, not a pod-wide policy.

## readOnlyRootFilesystem: removing the writable surface

Now consider a different threat. An attacker achieves remote code execution inside your container. They want to install a persistent backdoor or download additional tools. If the container's root filesystem is writable, they can. If it is not, they cannot.

`readOnlyRootFilesystem: true` mounts the container's root filesystem as read-only. Writes fail immediately. The process can still read every file, but cannot create, modify, or delete anything on the root filesystem.

Add it to the manifest:

```bash
nano hardened-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened-pod
spec:
  containers:
    - name: app
      image: nginx:1.28
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
```

```bash
kubectl apply -f hardened-pod.yaml
```

```bash
kubectl describe pod hardened-pod
```

The describe output will show `Read Only Root Filesystem: true` under the container's security context.

:::warning
Setting `readOnlyRootFilesystem: true` on `nginx:1.28` will cause the container to crash. nginx writes to `/var/run/nginx.pid` and `/var/cache/nginx` during startup. With a read-only root filesystem, those writes fail and nginx exits immediately. The fix is to mount `emptyDir` volumes at those paths, providing a writable in-memory location. In a real scenario you would add volume mounts for every directory the application needs to write to. For this lesson, the failure itself is the point: it shows that `readOnlyRootFilesystem: true` is genuinely enforced, not just advisory.
:::

## The complete hardened manifest

Here is the fully assembled hardened Pod spec with all three container-level fields applied:

```bash
nano hardened-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 2000
  containers:
    - name: app
      image: nginx:1.28
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
```

```bash
kubectl apply -f hardened-pod.yaml
```

```bash
kubectl describe pod hardened-pod
```

Reading the describe output from top to bottom gives you the full security posture: the pod-level UID and GID, then per-container the capability set, the privilege escalation block, and the filesystem mode. That is the complete picture.

:::quiz
You set `readOnlyRootFilesystem: true` and the Pod crashes immediately after starting. How do you diagnose the problem using only the simulator?

**Try it:** `kubectl describe pod hardened-pod`

**Answer:** The `Events` section at the bottom of the describe output will show the container's exit event and often the reason. If the application crashes because it cannot write to a path on the root filesystem, you will see the container exit with a non-zero code shortly after starting. The fix is to identify which paths need to be writable and mount `emptyDir` volumes at those exact paths.
:::

You now have the complete security context toolkit for container hardening: identity fields at the pod level, and capability, escalation, and filesystem restrictions at the container level. The next module moves from runtime security to image security, examining where container images come from, how to verify them, and how to control which images are allowed to run in a cluster.
