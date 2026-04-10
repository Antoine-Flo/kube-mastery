---
seoTitle: Advanced Kubernetes NetworkPolicy, Deny-All, Port Ranges
seoDescription: Explore advanced NetworkPolicy patterns in Kubernetes, default deny-all, cross-namespace AND logic, port ranges, and additive policy composition.
---

# Advanced NetworkPolicy Patterns

The previous lessons showed you how to write individual rules for specific Pods. But in a real namespace with many Pods and multiple teams contributing policies, you need a broader strategy. What do you do with Pods that have no policy yet? How do you coordinate policies from different teams without conflicts? How do you target Pods that must come from a specific namespace and have specific labels at the same time?

These are the questions this lesson answers.

## Default Deny-All as a Security Foundation

@@@
graph LR
    subgraph before["Before deny-all"]
        A["Pod A"] --> B["Pod B"]
        A --> C["Pod C"]
        B --> C
    end
@@@

@@@
graph LR
    subgraph after["After deny-all + selective allow"]
        X["Pod api"] -- "allowed" --> Y["Pod db"]
        X -. "blocked" .-> Z["Pod cache"]
        W["Pod frontend"] -- "allowed" --> X
        W -. "blocked" .-> Y
    end
@@@

The deny-all pattern is a single policy that locks down an entire namespace in one shot. It uses an empty `podSelector` to match every Pod, and lists both `Ingress` and `Egress` in `policyTypes` with no rules. The result is that all inbound and outbound traffic across every Pod in the namespace is blocked.

```
nano deny-all.yaml
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: default
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

```
kubectl apply -f deny-all.yaml
```

After applying this, every Pod in the namespace is isolated. No communication is possible, including DNS. From this clean baseline, you selectively open what you actually need by adding targeted policies. Nothing is accidentally allowed. Every permitted connection exists because someone wrote a rule for it.

```
kubectl get networkpolicy
```

Verify the `deny-all` policy appears. Now add the selective allow for `api` to reach `db` (with DNS):

:::quiz
You apply the deny-all policy above. A Pod with no other NetworkPolicy tries to reach another Pod. What happens?

- Traffic is allowed because the Pod has no specific policy targeting it
- Traffic is blocked because the deny-all policy covers every Pod via `podSelector: {}`
- Only egress is blocked; ingress still works

**Answer:** Traffic is blocked in both directions - the empty `podSelector: {}` matches every Pod in the namespace, and listing both `Ingress` and `Egress` with no rules blocks everything.
:::

## Policy Composition: Multiple Policies Are Additive

Once you have a deny-all in place, you start building your allowed connections one policy at a time. Each policy you add opens a specific communication path. Because policies are additive, they stack cleanly.

Say the `db` Pod needs to accept traffic from two separate sources: `api` and a `monitoring` agent in a different namespace. You could write a single policy with both rules. But you can also write two separate policies, one from each team:

```yaml
# Policy from the app team
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-db
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
          port: 5432 # illustrative only
```

```yaml
# Policy from the monitoring team
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring-to-db
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - protocol: TCP
          port: 9187 # illustrative only
```

Both policies select `db`. The result is that `db` accepts traffic from `api` on port 5432 AND from any Pod in the `monitoring` namespace on port 9187. Neither policy cancels the other.

:::warning
NetworkPolicies are additive, not restrictive. Adding a new policy to a Pod can only increase what is permitted, never reduce it. If you want to tighten access, you must remove or modify existing policies, not add new ones. This is why starting from deny-all and building upward is the safer model.
:::

:::quiz
Pod `db` has two NetworkPolicies: one allows ingress from `app=api`, another allows ingress from `app=monitoring`. A request arrives from a Pod labeled `app=monitoring`. Is it allowed?

- No, only the most recently applied policy counts
- Yes, because at least one policy permits it and policies are additive
- Only if both policies agree on the same source

**Answer:** Yes - if any applicable policy permits the traffic, it is allowed. The second policy is sufficient on its own to grant access.
:::

## Cross-Namespace AND Logic

@@@
graph LR
    A["Pod: app=api\nnamespace labeled team=backend"] -- "AND - allowed" --> db["Pod: db"]
    B["Pod: app=api\nnamespace: default (no label)"] -. "blocked" .-> db
    C["Pod: app=frontend\nnamespace labeled team=backend"] -. "blocked" .-> db
@@@

Namespaces and Pod labels can be combined in the same `from` entry to require both conditions simultaneously. This is the cross-namespace AND pattern: the source Pod must have the right label AND come from the right namespace.

```
nano cross-ns-policy.yaml
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-from-backend-ns
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
          namespaceSelector:
            matchLabels:
              team: backend # illustrative only
```

Both `podSelector` and `namespaceSelector` are inside the same `-` list item. The source must satisfy both. A Pod labeled `app: api` in a namespace not labeled `team: backend` is blocked. A Pod in a `team: backend` namespace without the `app: api` label is also blocked.

```bash
kubectl apply -f cross-ns-policy.yaml
```

```bash
kubectl describe networkpolicy allow-api-from-backend-ns
```

:::quiz
You need to allow ingress from Pods labeled `role=scraper` that are also in a namespace labeled `env=prod`. What is the correct structure in the `from` field?

- Two separate `-` entries, one for `podSelector` and one for `namespaceSelector`
- Both `podSelector` and `namespaceSelector` inside the same `-` entry

**Answer:** Both inside the same `-` entry - this produces AND logic. Two separate entries would produce OR logic, allowing either condition independently.
:::

## Ports, Protocols, and Port Ranges

Each rule in `ingress` or `egress` can specify ports by number and protocol. Both TCP and UDP are supported. Some CNI plugins also support named ports (matching the port name defined in the Pod spec), and port ranges using `endPort`:

```yaml
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 8000
          endPort: 8080 # illustrative only
```

This allows TCP traffic on any port from 8000 to 8080 inclusive. The `endPort` field is only valid when the CNI plugin supports it. Without `endPort`, you list each port individually.

## Putting It All Together

The recommended pattern for any production namespace is:

1. Apply a deny-all policy first to lock everything down.
2. Add targeted ingress allow policies for each service that needs to accept traffic.
3. Add targeted egress allow policies for each service that needs to reach other services, including the DNS exception.
4. Use cross-namespace AND selectors when the source must come from a specific namespace with specific labels.
5. Rely on additive composition: each team owns the policies relevant to their services.

NetworkPolicies are your primary tool for network-level least privilege in Kubernetes. The deny-all baseline combined with selective allow policies gives you a clear, auditable record of every permitted connection in the namespace.
