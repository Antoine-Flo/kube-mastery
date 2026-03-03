# Baseline and Restricted in Practice

You know the three Pod Security levels. Now let's get practical. **Baseline** and **Restricted** are the two levels you will work with most often — Privileged is simply "no restrictions." Understanding exactly what each level requires, and how to make your Pods compliant, is essential for rolling out Pod Security Standards successfully.

Think of Baseline as a seatbelt — it protects against the most common dangers with minimal inconvenience. Restricted is more like a full safety harness — it offers stronger protection, but requires a bit more setup.

## What Baseline Requires

Baseline blocks the most dangerous Pod configurations while remaining compatible with most workloads. Here are the key restrictions:

- **No host namespaces:** `hostPID`, `hostIPC`, and `hostNetwork` must not be set to `true`
- **No privileged containers:** `privileged: true` is forbidden
- **No privilege escalation:** `allowPrivilegeEscalation` must be `false`
- **Non-root execution:** `runAsNonRoot` must be `true`
- **Limited capabilities:** dangerous capabilities like `SYS_ADMIN` or `NET_RAW` are not allowed
- **Restricted volume types:** host path mounts and other sensitive volume types are forbidden

Most standard applications — web servers, APIs, background workers — can meet these requirements with just a few lines added to the Pod spec.

## A Baseline-Compliant Pod

Here is a Pod that satisfies Baseline:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: baseline-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
  containers:
    - name: app
      image: myapp:v1
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL
```

The key additions are `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, and dropping all capabilities. For many applications, this is all you need to move from no policy to Baseline compliance.

## What Restricted Adds

Restricted builds on Baseline with additional hardening requirements:

- **Read-only root filesystem:** `readOnlyRootFilesystem: true` prevents writes to the container's root filesystem
- **Seccomp profile required:** a `seccompProfile` of type `RuntimeDefault` or `Localhost` must be set
- **All capabilities dropped:** `capabilities.drop: [ALL]` is mandatory (Baseline recommends it; Restricted requires it)
- **Stricter volume types:** only a narrow set of volume types is allowed

The biggest practical impact is the read-only root filesystem. Applications that write to `/tmp`, `/var/log`, or other directories will need `emptyDir` volumes mounted at those paths.

## A Restricted-Compliant Pod

Here is a Pod that satisfies Restricted:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: restricted-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: myapp:v1
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

Notice the `emptyDir` volume for `/tmp`. This is the most common adjustment when moving from Baseline to Restricted. Many applications write temporary files to `/tmp`, and without this volume, they will fail with "read-only file system" errors.

:::info
When migrating to Restricted, start by identifying which paths your application writes to. Common writable paths include `/tmp`, `/var/log`, `/var/cache`, and application-specific data directories. Add an `emptyDir` volume for each one.
:::

## Side-by-Side Comparison

| Requirement                       | Baseline    | Restricted |
| --------------------------------- | ----------- | ---------- |
| No host namespaces                | Yes         | Yes        |
| No privileged containers          | Yes         | Yes        |
| `allowPrivilegeEscalation: false` | Yes         | Yes        |
| `runAsNonRoot: true`              | Yes         | Yes        |
| Drop all capabilities             | Recommended | Required   |
| `readOnlyRootFilesystem: true`    | No          | Yes        |
| Seccomp profile required          | No          | Yes        |

## Testing Compliance

When you apply a Pod, verify it is accepted in the enforced namespace with `kubectl get pod` and `kubectl describe pod`. If the Pod is rejected, the admission controller's error message tells you exactly which requirement was not met — use it as a checklist when fixing your spec.

:::warning
Legacy container images that run as root will fail under both Baseline and Restricted. You have two options: set `runAsUser` in the Pod spec to override the image's default, or rebuild the image with a `USER` directive in the Dockerfile. The second approach is more robust because it ensures the image works correctly as non-root.
:::

---

## Hands-On Practice

### Step 1: Create a Pod that would violate Restricted (optional)

In a namespace with enforce=restricted (or enforce=baseline), try creating a Pod without `readOnlyRootFilesystem`:

```bash
kubectl run test-restricted --image=nginx -n pss-demo --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":1000},"containers":[{"name":"test-restricted","image":"nginx","securityContext":{"allowPrivilegeEscalation":false}}]}}'
```

If the namespace enforces Restricted, this may be rejected for missing `readOnlyRootFilesystem` or `seccompProfile`. The error message tells you which rule failed.

## Wrapping Up

Baseline catches the most dangerous misconfigurations with minimal friction. Restricted adds read-only root filesystem and a mandatory seccomp profile for a hardened posture. Moving between levels is incremental — start with Baseline, add `readOnlyRootFilesystem` and `seccompProfile`, mount `emptyDir` for writable paths, and you are at Restricted. In the next lesson, we will explore the **enforcement modes:** enforce, audit, and warn — that let you roll out these policies gradually.
