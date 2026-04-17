---
seoTitle: 'Pod vs Container Security Context Kubernetes Override Hierarchy'
seoDescription: 'Learn the difference between pod-level and container-level securityContext in Kubernetes, which fields belong where, and how overrides work.'
---

# Pod vs Container Security Context

You want to enforce that every container in a Pod runs as a non-root user. You also want one specific container to run as a different UID than the others. Kubernetes handles both cases, but through two separate fields in the spec: one at the Pod level and one at the container level. Using the wrong level is one of the most common configuration mistakes in CKA scenarios. This lesson draws that line clearly.

## Two levels, one spec

The Pod spec has two distinct places where you can set security properties.

@@@
graph TB
  SPEC["Pod spec"]
  SPEC --> PSC["spec.securityContext\n(pod-level)"]
  SPEC --> CONT["spec.containers[]"]
  CONT --> CSC["containers[].securityContext\n(container-level)"]
  PSC -->|"applies to all containers\nunless overridden"| ALL["All containers"]
  CSC -->|"overrides pod-level\nfor this container only"| ONE["This container"]
@@@

`spec.securityContext` is the **pod-level** security context. It applies to every container in the Pod by default. Fields you set here become the baseline for all containers.

`spec.containers[].securityContext` is the **container-level** security context. It applies only to the specific container it is nested under. If a field is set at both levels, the container-level value wins for that container.

The override rule is field-by-field, not all-or-nothing. A container can inherit some pod-level settings and override others independently.

## Which fields belong where

Not every field is available at both levels. The placement is deliberate.

Pod-level `securityContext` supports: `runAsUser`, `runAsGroup`, `fsGroup`, `runAsNonRoot`, `sysctls`, `seccompProfile`, and `supplementalGroups`. These are properties that make sense to apply uniformly across all containers.

Container-level `securityContext` supports: `runAsUser`, `runAsNonRoot`, `allowPrivilegeEscalation`, `capabilities`, `readOnlyRootFilesystem`, `privileged`, and `seccompProfile`. The most impactful hardening fields (`capabilities` and `readOnlyRootFilesystem`) live exclusively at the container level, because capability sets and filesystem write access are per-process concerns.

:::info
`fsGroup` is pod-level only. It sets the GID applied to volumes mounted into the Pod, so it is a property of the shared storage context, not of an individual container. You cannot set it per container.
:::

## Building the manifest incrementally

Start with a pod-level `securityContext` that sets a default UID for all containers.

```bash
nano secure-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
  containers:
    - name: app
      image: nginx:1.28
```

At this point, every container in the Pod, there is only one here, will run as UID 1000 and primary GID 3000. Apply it:

```bash
kubectl apply -f secure-pod.yaml
```

Now add a container-level override. The `app` container needs to run as UID 2000 specifically, while still inheriting the pod-level group.

```bash
nano secure-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
  containers:
    - name: app
      image: nginx:1.28
      securityContext:
        runAsUser: 2000
```

The result: the `app` container runs as UID 2000 (container-level wins for `runAsUser`) and GID 3000 (pod-level applies for `runAsGroup`, because no container-level override was set for that field).

:::quiz
A Pod sets `runAsUser: 1000` at the pod level. One container sets `runAsUser: 2000` at the container level. Which UID does that container run as?

- 1000, because pod-level settings always take precedence
- 2000, because container-level settings override pod-level for the same field
- Both are applied and the process inherits both UIDs

**Answer:** 2000, because container-level settings override pod-level for the same field. The other options are wrong: pod-level is a default, not a ceiling, and a Linux process has exactly one effective UID, not two.
:::

## Verifying the applied settings

```bash
kubectl describe pod secure-pod
```

In the output, look for the `Containers` section. Under each container you will see a `Security Context` block listing the effective settings. The pod-level settings also appear under the `Security Context` block at the Pod level, above the container entries.

If the describe output shows `Run As User: 2000` for the container while the pod-level block shows `Run As User: 1000`, the override is working correctly.

This two-level model is not an accident. It reflects a deliberate separation of concerns: the Pod author sets a security baseline for the workload as a whole, and individual containers can tighten or adjust that baseline without breaking the others. A logging sidecar might need a different UID than the main application, without relaxing the pod-wide non-root policy.

:::quiz
You have a Pod with two containers. You want both to run as non-root, but each needs a different UID. Where do you set `runAsNonRoot` and where do you set `runAsUser`?

**Answer:** Set `runAsNonRoot: true` at the pod level so it applies to both containers as a shared baseline. Set `runAsUser` at the container level for each container individually, so each gets its own UID. The container-level `runAsUser` values override the pod-level default (if any) for `runAsUser`, while `runAsNonRoot` continues to apply from the pod level.
:::

The next lesson goes deeper into the three most common pod-level fields: `runAsUser`, `runAsGroup`, and `runAsNonRoot`. You will see what happens when they are set correctly, and what happens when they conflict with what the container image expects.
