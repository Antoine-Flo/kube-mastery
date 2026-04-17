---
seoTitle: 'runAsUser runAsGroup runAsNonRoot Kubernetes Security Context'
seoDescription: 'Learn how runAsUser, runAsGroup, fsGroup, and runAsNonRoot control the identity of container processes in Kubernetes Pods.'
---

# Running Containers as Non-Root

The single most impactful security change you can make to most Pod specs costs exactly one line: `runAsNonRoot: true`. If the container image's default user is root, the Pod will not start. That is the point. Kubernetes refuses to run it rather than silently allowing a known-risky configuration. This lesson covers the four fields that control process identity and explains how they interact.

## runAsNonRoot: the enforcement gate

`runAsNonRoot: true` does not change which user the container runs as. It is a validation step. Before the container starts, Kubernetes checks whether the effective UID would be 0. If it would, the container is rejected with a security error. If the UID is anything other than 0, the container starts normally.

This matters because many container images default to root. Setting `runAsNonRoot: true` without also setting `runAsUser` creates a dependency on the image itself being well-configured. If the image defaults to a non-root user, the Pod starts. If it defaults to root, the Pod fails. You get explicit feedback instead of a silent security gap.

```bash
nano nonroot-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nonroot-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
  containers:
    - name: app
      image: nginx:1.28
```

```bash
kubectl apply -f nonroot-pod.yaml
```

:::warning
`runAsNonRoot: true` alone does not change which user the container runs as. It only blocks startup if the effective user is root. To actually run as a specific non-root UID, combine it with `runAsUser`. If you set `runAsNonRoot: true` without `runAsUser` on an image that defaults to root, the Pod will fail to start with a message indicating that the container cannot run as root.
:::

## runAsUser: pinning the UID

`runAsUser` specifies the exact UID the container process runs as, overriding whatever the container image declares as its default user.

@@@
graph LR
  IMG["Container image\ndefault user: root (UID 0)"]
  IMG --> OVER["runAsUser: 1000\nin securityContext"]
  OVER --> PROC["Process runs as\nUID 1000"]
@@@

```bash
kubectl get pod nonroot-pod
```

Check that the Pod reached `Running` status. Then inspect the security context that was applied:

```bash
kubectl describe pod nonroot-pod
```

Under the `Containers` section, in the `Security Context` block, you will see `Run As User: 1000` and `Run As Non Root: true`. These are the values Kubernetes enforced at container start.

:::quiz
A Pod spec sets only `runAsNonRoot: true` with no `runAsUser`. The container image has no USER instruction in its Dockerfile and defaults to root. What happens when you apply this Pod?

**Answer:** The Pod fails to start. Kubernetes checks the effective UID before allowing the container to run. Since the image defaults to UID 0 and no `runAsUser` override is set, the check fails and the container is rejected with a security violation message. The Pod status will show an error rather than `Running`.
:::

## runAsGroup and fsGroup: controlling group identity

`runAsGroup` sets the primary GID for the container process. Without it, the process inherits the default group from the container image. Setting it explicitly gives you the same kind of predictability that `runAsUser` gives for UIDs.

`fsGroup` is a pod-level field with a specific purpose: it controls the GID applied to volumes mounted into the Pod. When a volume is mounted, Kubernetes changes the ownership of that volume's files to `fsGroup`. Any file created inside that volume inherits this GID. This is critical when multiple containers in the same Pod need to share a volume and both need write access under the same group.

Add both fields to the manifest:

```bash
nano nonroot-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nonroot-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 2000
    fsGroup: 3000
  containers:
    - name: app
      image: nginx:1.28
```

```bash
kubectl apply -f nonroot-pod.yaml
```

```bash
kubectl describe pod nonroot-pod
```

The describe output will now show `Run As User: 1000`, `Run As Group: 2000`, and `FS Group: 3000` in the security context block.

:::info
`fsGroup` only affects mounted volumes, not the container's root filesystem. If your container does not mount any volumes, `fsGroup` has no visible effect on the running process.
:::

## The failure case: image defaults to root

It is worth watching this fail once so the error message becomes recognizable. Create a Pod with `runAsNonRoot: true` but without a `runAsUser` override, targeting an image that defaults to root:

```bash
nano rootfail-pod.yaml
```

```yaml
# illustrative only
apiVersion: v1
kind: Pod
metadata:
  name: rootfail-pod
spec:
  securityContext:
    runAsNonRoot: true
  containers:
    - name: app
      image: nginx:1.28
```

```bash
kubectl apply -f rootfail-pod.yaml
```

```bash
kubectl get pod rootfail-pod
```

The Pod will not reach `Running`. Check the details:

```bash
kubectl describe pod rootfail-pod
```

In the `Events` section you will see a message stating that the container cannot run as root. The image `nginx:1.28` runs as root by default, and `runAsNonRoot: true` blocked it. To fix this, add `runAsUser: 1000` to the spec. The security gate did exactly what it was supposed to do.

:::quiz
You want to guarantee that a Pod's containers always run as UID 1000 and are blocked if something tries to start them as root. Which two fields do you combine, and at which spec level?

**Try it:** Apply a Pod with `runAsUser: 1000` and `runAsNonRoot: true` in `spec.securityContext`, then run `kubectl describe pod <your-pod-name>` and read the Security Context block.

**Answer:** In the `Containers` section under `Security Context`, you will see `Run As User: 1000` and `Run As Non Root: true`. Both fields appear together because they serve different roles: `runAsUser` sets the identity, `runAsNonRoot` enforces it as a validation gate.
:::

You now know how to control the user identity a container process runs under. The next lesson moves to capability-level hardening and filesystem write restrictions: two container-level fields that constrain what a process can do even after it has started.
