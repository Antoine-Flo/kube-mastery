---
seoTitle: 'Pod Security Admission: Enforcing PSS with Namespace Labels'
seoDescription: 'Learn how Pod Security Admission applies Pod Security Standards at the namespace level using enforce, audit, and warn modes in Kubernetes.'
---

# Pod Security Admission

Knowing the three profiles is not enough. You need a way to apply them. **Pod Security Admission (PSA)** is the built-in admission controller that enforces PSS at the namespace level. It requires no webhook server, no external tooling, just a label on the namespace.

## How PSA intercepts Pod creation

When a Pod creation request arrives at the API server, PSA reads the labels on the target namespace. Those labels tell PSA which profile to apply and in which mode. Three modes are available, and each behaves differently when a violation is detected.

@@@
graph LR
    A["kubectl apply"] --> B["API Server"]
    B --> C["PSA Controller\nreads namespace labels"]
    C --> D{"Mode?"}
    D -->|enforce| E["Reject Pod\n403 Forbidden"]
    D -->|warn| F["Allow Pod\nwarning to client"]
    D -->|audit| G["Allow Pod\nrecord in audit log"]
@@@

The `enforce` mode rejects any Pod that violates the profile. The `kubectl apply` call returns an error and the Pod is never created. The `audit` mode allows the Pod to be created but records the violation in the Kubernetes audit log, useful for detection without disrupting running workloads. The `warn` mode allows the Pod but returns a visible warning directly in the kubectl output, right in the terminal window.

## Applying labels to a namespace

The label format is `pod-security.kubernetes.io/<mode>: <profile>`. You can set multiple modes simultaneously on the same namespace.

```bash
kubectl label namespace dev pod-security.kubernetes.io/enforce=baseline
```

```bash
kubectl label namespace dev pod-security.kubernetes.io/warn=restricted
```

```bash
kubectl get namespace dev --show-labels
```

The labels appear in the output immediately. Any Pod created in `dev` from this point on is checked against `baseline` at enforcement and against `restricted` for warnings. This combination is useful during a hardening phase: you get hard rejection for serious violations while surfacing what would fail at the stricter level.

:::quiz
Apply the `baseline` enforcement label to the `default` namespace, then create a Pod with `securityContext.privileged: true`. What does kubectl return?

**Try it:**
```bash
kubectl label namespace default pod-security.kubernetes.io/enforce=baseline
```

**Answer:** Running `kubectl apply` for a privileged Pod returns: `Error from server (Forbidden): pods "<name>" is forbidden: violates PodSecurity "baseline:latest": privileged (container "app" must not set securityContext.privileged=true)`. The Pod is never created.
:::

## Seeing enforcement fail in practice

Create a manifest for a non-compliant Pod:

```bash
nano privileged-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: bad-pod
  namespace: dev
spec:
  containers:
    - name: app
      image: nginx:1.28
      securityContext:
        privileged: true
```

```bash
kubectl apply -f privileged-pod.yaml
```

:::warning
The apply command returns immediately with a `Forbidden` error. No Pod object is created in the simulated cluster. The rejection happens at admission time, before any scheduling or image pulling occurs. The violation message names the specific field that caused the rejection. If you see this error, the fix is always in the Pod spec, not in the namespace label.
:::

Why does Kubernetes reject at admission rather than letting the Pod be scheduled and then terminating it? Because a rejected admission keeps cluster state clean. There is no failed Pod object to clean up, no node resources consumed, no partial image pull. The contract is simple: if the spec is not compliant, the object does not exist.

## Combining modes for staged enforcement

A common pattern during migration is to run all three modes at once on the same namespace. Set `enforce` at the level you are confident about, `warn` at the next stricter level to surface upcoming issues, and `audit` for full logging.

:::info
The label `pod-security.kubernetes.io/enforce-version: v1.29` pins the profile definition to a specific Kubernetes minor version. Without version pinning, the profile version defaults to `latest`, which tracks the current cluster version. Pinning prevents a Kubernetes upgrade from silently changing what is allowed in your namespaces.
:::

:::quiz
You label a namespace with `enforce=baseline` and a Pod with `privileged: true` is already running there. What happens to that Pod?

- It is immediately deleted
- Nothing, PSA only acts on new admission requests
- It enters a `Terminating` state until the spec is corrected

**Answer:** Nothing. PSA only acts at admission time, when a Pod is being created or updated. Existing Pods are not evicted or deleted when you add or change PSS labels. This is why `warn` and `audit` modes are essential before switching to `enforce`: they give you a view of existing violations without touching running workloads.
:::

PSA gives you enforcement without extra infrastructure. One label, one profile, one behavior. The practical challenge is deciding which profile to use for each type of namespace, and how to migrate namespaces that already contain running workloads. That is the focus of the next lesson.
