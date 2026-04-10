---
seoTitle: Kubernetes NetworkPolicy Structure, YAML, Selectors, Ports
seoDescription: Understand the full NetworkPolicy manifest structure, including podSelector, policyTypes, ingress and egress rules, and AND vs OR selector logic.
---

# NetworkPolicy Structure

You know a NetworkPolicy controls which Pods can communicate. Now the question is: how do you actually write one? The YAML structure is not long, but every field has a specific meaning, and one misread field can produce a policy that silently does nothing, or silently does the opposite of what you intended.

This lesson builds the manifest field by field so each piece has a clear purpose before the next one is added.

## The podSelector: Who This Policy Protects

The first and most important field is `podSelector`. This field answers the question: which Pods does this policy apply to? It does not mean "who is allowed to send traffic." It identifies the Pods being protected by this policy.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: protect-db
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: db # illustrative only
```

:::warning
An empty `podSelector` written as `podSelector: {}` selects every Pod in the namespace, not zero Pods. This is a frequent source of mistakes. If you intend to protect only `db`, you must provide an explicit label.
:::

:::quiz
You write a NetworkPolicy with `podSelector: {}`. Which Pods does it protect?

- No Pods, because the selector is empty
- All Pods in the namespace
- All Pods in the cluster

**Answer:** All Pods in the namespace - an empty selector matches everything in scope, which is the current namespace.
:::

## policyTypes: Ingress, Egress, or Both

Once you define which Pods the policy covers, you tell Kubernetes what kind of traffic it governs with `policyTypes`.

```yaml
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
    - Ingress # illustrative only
```

`Ingress` controls traffic entering the protected Pod. `Egress` controls traffic leaving it. You can list one or both. If you list `Ingress` but define no ingress rules, you get a deny-all for incoming traffic on those Pods. If you list `Egress` but define no egress rules, all outbound traffic from those Pods is denied.

## ingress.from: Who Can Enter

@@@
graph LR
    source["Allowed source"] -- "Ingress" --> pod["Protected Pod"]
    blocked["Other Pods"] -. "denied" .-> pod
@@@

The `ingress` section lists which sources may send traffic to the protected Pods. Each entry in the `from` array describes an allowed source using one or more of three selectors: `podSelector`, `namespaceSelector`, or `ipBlock`.

```yaml
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api # illustrative only
```

This rule allows traffic from any Pod with `app: api` in the same namespace.

## egress.to: Where the Pod Can Go

The `egress` section works symmetrically. It lists where the protected Pods are allowed to send traffic.

```yaml
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: db # illustrative only
```

## ports: Restricting by Port

Both `ingress` and `egress` rules accept a `ports` field that limits the rule to specific ports and protocols.

```yaml
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 5432 # illustrative only
```

Without a `ports` field, the rule allows all ports. With it, only the listed ports are permitted.

:::quiz
You define an ingress rule with no `ports` field. Which ports are allowed?

**Try it:** `kubectl describe networkpolicy protect-db`

**Answer:** All ports are allowed when no `ports` field is specified. Look for "Allowing ingress traffic" in the describe output and check whether ports are listed or shown as any.
:::

## AND vs OR: The Critical Selector Logic

@@@
graph TD
    subgraph AND["Single from element (AND)"]
        A["Pod must match label AND be in namespace"]
    end
    subgraph OR["Two from elements (OR)"]
        B["Pod matches label"]
        C["OR Pod is in namespace"]
    end
@@@

This is the most misunderstood part of NetworkPolicy. When you write multiple fields inside a single `from` element, they are combined with AND. The source must satisfy all conditions.

```yaml
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
          namespaceSelector:
            matchLabels:
              env: production # illustrative only
```

Here, both conditions are inside the same list item (same `-`). The source Pod must have `app: api` AND be in a namespace labeled `env: production`.

When you write multiple elements in the `from` array (multiple `-` entries), they are combined with OR. Either condition is sufficient.

```yaml
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
        - namespaceSelector:
            matchLabels:
              env: production # illustrative only
```

Now any Pod with `app: api` in any namespace is allowed, OR any Pod in a namespace labeled `env: production` regardless of its own label.

Why does this distinction exist? Because network rules often need both fine-grained Pod control and namespace-scoped access. The YAML list structure naturally expresses the difference, but only if you pay close attention to the indentation and where each `-` appears.

:::quiz
You want to allow only a Pod labeled `app: api` that is also in a namespace labeled `team: backend`. Which structure is correct?

- Two separate `-` entries in the `from` array, one for each selector
- Both selectors inside the same `-` entry in the `from` array

**Answer:** Both selectors inside the same `-` entry - this produces AND logic. Two separate entries would produce OR logic, allowing any `app: api` Pod from any namespace.
:::

## Applying and Verifying the Full Policy

Now build the complete manifest for a policy that protects `db`, allows ingress from `api` on port 5432, and governs only incoming traffic.

```
nano db-network-policy.yaml
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: protect-db
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 5432
```

```bash
kubectl apply -f db-network-policy.yaml
```

```bash
kubectl describe networkpolicy protect-db
```

The `describe` output shows the selector, the policy types, and each ingress rule with its sources and ports. Read it carefully: it is your confirmation that the policy matches what you intended.

A NetworkPolicy is compact, but each field carries precise meaning. Getting the AND vs OR distinction right in `from` and `to` arrays is what separates a policy that works from one that silently allows too much or too little.
