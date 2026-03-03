# Security Context Basics

You've learned individual security settings — `runAsUser`, `runAsNonRoot`, `fsGroup`. Now let's bring everything together. The **securityContext** is where all these options live, and combining them correctly is what turns a default container into a hardened one.

Think of it as a checklist before launching a spacecraft: each individual check matters, but it's the combination that ensures safety.

## The Key Security Settings

Here are the most important securityContext fields and what they do:

| Setting                           | Level            | Purpose                                      |
| --------------------------------- | ---------------- | -------------------------------------------- |
| `runAsNonRoot: true`              | Pod or Container | Blocks running as root                       |
| `runAsUser`                       | Pod or Container | Sets the specific UID                        |
| `runAsGroup`                      | Pod or Container | Sets the primary GID                         |
| `fsGroup`                         | Pod only         | Sets volume group ownership                  |
| `allowPrivilegeEscalation: false` | Container only   | Prevents gaining extra privileges via setuid |
| `readOnlyRootFilesystem: true`    | Container only   | Makes the container filesystem read-only     |
| `capabilities.drop: [ALL]`        | Container only   | Removes all Linux capabilities               |
| `seccompProfile`                  | Pod or Container | Restricts allowed system calls               |

## A Fully Hardened Pod

Here's what a well-secured Pod looks like, combining Pod-level and container-level settings:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 10000
    runAsGroup: 10000
    fsGroup: 10000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: myapp:latest
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: data
          mountPath: /data
  volumes:
    - name: tmp
      emptyDir: {}
    - name: data
      persistentVolumeClaim:
        claimName: app-data
```

Let's break down what each setting does in this example:

- **runAsNonRoot + runAsUser**: The process runs as UID 10000, never as root
- **fsGroup**: The `/data` volume is accessible to group 10000
- **seccompProfile: RuntimeDefault**: Only common system calls are allowed
- **allowPrivilegeEscalation: false**: No process can gain more privileges than it started with
- **readOnlyRootFilesystem**: The container can't write to its own filesystem
- **capabilities.drop: ALL**: No Linux capabilities — the process runs with minimal privileges
- **emptyDir for /tmp**: Since the root filesystem is read-only, `/tmp` needs a writable volume

## readOnlyRootFilesystem in Practice

Making the root filesystem read-only is one of the most effective security measures — an attacker can't write scripts, download tools, or modify binaries. But applications often need to write somewhere:

```yaml
containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true
    volumeMounts:
      - name: tmp
        mountPath: /tmp
      - name: cache
        mountPath: /var/cache
      - name: logs
        mountPath: /var/log
volumes:
  - name: tmp
    emptyDir: {}
  - name: cache
    emptyDir: {}
  - name: logs
    emptyDir: {}
```

Common writable paths to mount: `/tmp`, `/var/log`, `/var/cache`, and any application-specific data directory.

:::info
`emptyDir` volumes are ephemeral — they're created when the Pod starts and deleted when the Pod stops. They're perfect for temporary files that don't need to persist.
:::

## Dropping Capabilities

Linux capabilities are fine-grained root powers. Even non-root processes get some default capabilities. Dropping all of them gives you the tightest possible configuration:

```yaml
securityContext:
  capabilities:
    drop:
      - ALL
```

If your application needs a specific capability (like `NET_BIND_SERVICE` to bind port 80), add it back explicitly:

```yaml
securityContext:
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE
```

:::warning
`readOnlyRootFilesystem` will break applications that write to the root filesystem — even temporary files. Always test in a non-production environment first and add `emptyDir` mounts for paths your application writes to.
:::

---

## Hands-On Practice

### Step 1: Create a hardened Pod

Create `secure-context-pod.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-context-test
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 10000
    runAsGroup: 10000
  containers:
    - name: app
      image: nginx
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL
      volumeMounts:
        - name: tmp
          mountPath: /tmp
  volumes:
    - name: tmp
      emptyDir: {}
```

Apply it:

```bash
kubectl apply -f secure-context-pod.yaml
```

### Step 2: Wait and verify the process runs as expected

```bash
kubectl wait --for=condition=Ready pod/secure-context-test --timeout=60s
kubectl exec secure-context-test -- id
```

Should show `uid=10000`. The container runs as non-root with minimal capabilities.

### Step 3: Verify read-only root filesystem

```bash
kubectl exec secure-context-test -- touch /test
```

This should fail with "Read-only file system". Writing to `/tmp` (the emptyDir) should work:

```bash
kubectl exec secure-context-test -- touch /tmp/test
```

### Step 4: Clean up

```bash
kubectl delete pod secure-context-test
```

## Wrapping Up

A well-configured securityContext combines multiple layers of protection: non-root execution, read-only filesystem, dropped capabilities, seccomp profiles, and proper volume permissions. Each setting addresses a different attack vector, and together they significantly reduce the blast radius of a container compromise. Start with the full hardened template and relax individual settings only when your application specifically requires it — always knowing which protection you're trading away.
