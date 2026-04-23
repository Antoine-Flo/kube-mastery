---
seoTitle: Kubernetes Label Selectors - Equality, Set-Based Filtering
seoDescription: Understand equality-based and set-based label selectors in Kubernetes, and how matchLabels, matchExpressions, and Services use them to connect resources.
---

# Label Selectors

When you create a Deployment, you declare a template for the Pods it should run. But how does the Deployment know which running Pods are "its" Pods? Pod names change with every rollout. The Deployment cannot track them by name. Instead, it uses a label selector: a query that says "find every Pod that carries these labels". The selector is the glue that connects controllers to the workloads they manage.

@@@
graph TD
DEP["Deployment\nselector:\n matchLabels:\n app: web"]
SVC["Service\nselector:\n app: web"]
P1["Pod\napp=web"]
P2["Pod\napp=web"]
P3["Pod\napp=api"]
DEP -->|"manages"| P1
DEP -->|"manages"| P2
SVC -->|"routes to"| P1
SVC -->|"routes to"| P2
DEP -->|"ignores"| P3
SVC -->|"ignores"| P3
@@@

Both the Deployment and the Service in the diagram share the same selector. The Deployment manages Pod lifecycle; the Service routes traffic. Neither of them knows the Pod names. They only care about labels.

## Two Types of Selectors

Kubernetes defines two selector styles, and they are used in different places.

**Equality-based selectors** match a key to an exact value. You have already used them with `-l` on the command line: `app=web`, `env!=production`. Services also use equality-based selectors in their `selector:` field.

**Set-based selectors** are more expressive. They use operators like `In`, `NotIn`, `Exists`, and `DoesNotExist` to match a key against a set of possible values, or simply check for the presence of a key. Deployments (and other workload controllers) use set-based selectors inside `matchExpressions`.

Here is `matchLabels` in a Deployment spec, the simpler form:

```yaml
# illustrative only
spec:
  selector:
    matchLabels:
      app: web
```

And the Pod template labels must include every key-value pair in that selector:

```yaml
# illustrative only
template:
  metadata:
    labels:
      app: web
```

Why must they match? Because the Deployment uses the selector to find its own Pods. If the template produced Pods with different labels, the Deployment would never claim them. The API server actually validates this at creation time and rejects the object immediately if `selector.matchLabels` and `template.metadata.labels` are inconsistent.

Here is `matchExpressions`, the more flexible form:

```yaml
# illustrative only
spec:
  selector:
    matchExpressions:
      - key: env
        operator: In
        values: [staging, production]
      - key: app
        operator: Exists
```

The four operators are: `In` (key value is in the list), `NotIn` (key value is not in the list), `Exists` (key is present, any value), `DoesNotExist` (key is absent). All expressions in the list must be true simultaneously.

## Seeing Selectors in the Simulator

Create a Deployment and observe how the selector reaches the Pods:

```bash
kubectl create deployment web --image=nginx:1.28 --replicas=2
kubectl get pods -l app=web
kubectl get replicaset -l app=web
```

The Deployment created a ReplicaSet, and the ReplicaSet created the Pods. All of them share the `app=web` label because the Deployment's template declared it. Now try to describe the ReplicaSet to see its selector field. You have used `kubectl describe` before on Pods, and the flag is the same here.

:::quiz
A Deployment has `selector.matchLabels: {app: web}`. A Pod with labels `{app: web, version: v2}` is running. Is that Pod managed by the Deployment?

- No, the Pod has an extra label `version: v2` which the selector does not mention
- Yes, the Pod has all the labels in the selector, extra labels are ignored
- It depends on whether `version` is listed in `matchExpressions`

**Answer:** Yes, extra labels are ignored. The selector checks that every required key-value pair is present on the Pod. It does not require an exact match of the full label set. A Pod with `{app: web, version: v2, env: prod}` is still matched by a selector `{app: web}`.
:::

## The Immutability Rule

:::warning
Changing `selector` on a live Deployment is forbidden. The API server rejects the request with an error. Selectors are immutable after creation. If you need to change a selector, you must delete the Deployment and recreate it.
:::

Why is this enforced so strictly? Because the controller uses the selector to identify every Pod it owns. If the selector changed, the controller would stop seeing the existing Pods (they no longer match the new selector) and would start creating replacements. The old Pods would keep running with no controller to manage them, no restart policy, no cleanup. They become "orphaned". Kubernetes prevents this to avoid silent resource leaks.

:::quiz
Why are selectors immutable after a Deployment is created?

**Answer:** The controller uses the selector to find Pods it owns. Changing the selector would cause the controller to lose sight of the existing Pods (they no longer match) while creating new ones. The old Pods would run indefinitely with no lifecycle management. Kubernetes treats this as too dangerous to allow at runtime.
:::

## Cleanup

```bash
kubectl delete deployment web
```

Selectors are what give labels their structural power. The next lesson moves away from selection entirely and looks at annotations: metadata that Kubernetes ignores but tools depend on.
