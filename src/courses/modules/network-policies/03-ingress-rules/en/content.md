---
seoTitle: Kubernetes Ingress Rules, podSelector, Namespaces, Deny-All
seoDescription: Learn how to write Kubernetes NetworkPolicy ingress rules using pod and namespace selectors, ipBlock, and the deny-all pattern for inbound traffic control.
---

# Ingress Rules

Your `db` Pod holds the application's persistent data. Right now it accepts connections from `api`, from `frontend`, from `monitoring`, and from anything else that happens to reach it. Your goal is simple: only `api` should be allowed in. Everything else should be rejected at the network level before it even gets a response.

This is exactly the problem ingress rules solve.

## Protecting a Pod with podSelector

An ingress rule tells Kubernetes who is allowed to send traffic to the protected Pod. The most common way to identify allowed sources is by label, using `podSelector` inside the `from` array.

Start with the minimal structure. The `podSelector` at the top of `spec` identifies the Pod being protected:

```yaml
spec:
  podSelector:
    matchLabels:
      app: db # illustrative only
  policyTypes:
    - Ingress
```

This alone, with `policyTypes: [Ingress]` and no `ingress` rules listed, produces a deny-all for inbound traffic to `db`. No source is allowed in.

Now add the allowed source:

```yaml
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: api # illustrative only
```

The `app: api` Pod is now the only allowed source. Any other Pod that tries to connect to `db` is silently dropped.

:::quiz
You apply a NetworkPolicy with `policyTypes: [Ingress]` and no `ingress` field. What happens to inbound traffic to the selected Pod?

- All traffic is allowed because no rules means no restriction
- All inbound traffic is denied
- Only traffic on port 80 is allowed

**Answer:** All inbound traffic is denied - listing `Ingress` in `policyTypes` without providing any `ingress` rules creates an implicit deny-all for incoming connections.
:::

## Apply and Check

Build the full policy manifest:

```
nano db-ingress-policy.yaml
```

```yaml
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
          port: 5432
```

```
kubectl apply -f db-ingress-policy.yaml
```

```
kubectl describe networkpolicy allow-api-to-db
```

The describe output lists the allowed sources and ports. Confirm that `app=api` appears under ingress sources.

## Allowing an Entire Namespace with namespaceSelector

Sometimes the source is not a single Pod but an entire namespace. A monitoring system might run in its own namespace, and all Pods from that namespace should be able to scrape metrics from `db`.

Add a second `from` entry to allow any Pod from the `monitoring` namespace:

```yaml
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: api
  - from:
      - namespaceSelector:
          matchLabels:
            kubernetes.io/metadata.name: monitoring # illustrative only
```

The two separate `from` entries use OR logic. Either source is independently sufficient to get through.

:::quiz
You want to allow ingress from any Pod in the `monitoring` namespace, regardless of the Pod's own labels. Which field do you use in the `from` entry?

- podSelector with an empty matchLabels
- namespaceSelector with the namespace label
- ipBlock with the cluster CIDR

**Answer:** namespaceSelector with the namespace label - this matches any Pod that runs inside that namespace, without any further Pod label constraint.
:::

## Combining podSelector AND namespaceSelector

Sometimes you need to be more precise: a source must have a specific label AND be in a specific namespace. Place both selectors inside the same `-` element in `from`:

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

This allows only Pods with `app: api` that are also in a namespace labeled `env: production`. A Pod labeled `app: api` in a different namespace is blocked. A Pod in the `production` namespace without the `app: api` label is also blocked. Both conditions must be true simultaneously.

@@@
graph LR
A["Pod: app=api\nnamespace: production"] -- "allowed (AND)" --> db["Pod: db"]
B["Pod: app=api\nnamespace: staging"] -. "blocked" .-> db
C["Pod: app=frontend\nnamespace: production"] -. "blocked" .-> db
@@@

## Allowing External Traffic with ipBlock

Traffic does not always come from other Pods. Sometimes a known external IP or CIDR range needs access. Use `ipBlock` in the `from` array for this:

```yaml
ingress:
  - from:
      - ipBlock:
          cidr: 192.168.1.0/24 # illustrative only
```

This allows any IP in that CIDR to reach the protected Pod. You can combine `ipBlock` with other `from` entries, each as a separate `-` item, using OR logic.

## The Deny-All Ingress Pattern

@@@
graph LR
any["Any Pod"] -. "all blocked" .-> ns["All Pods in namespace"]
@@@

A powerful foundation for namespace security is a deny-all ingress policy that blocks inbound traffic to every Pod in the namespace at once. You then add specific allow policies on top of it:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress
  namespace: default
spec:
  podSelector: {}
  policyTypes:
    - Ingress
```

The empty `podSelector: {}` selects all Pods in the namespace. No `ingress` rules are listed. The result: zero inbound connections are allowed to any Pod in this namespace until you explicitly allow them.

:::warning
A policy that protects `db` does not protect `api` or `frontend`. Each Pod is only protected by the policies whose `podSelector` matches it. Pods with no matching policy remain completely unrestricted. The deny-all pattern avoids this gap by covering everything at once.
:::

:::quiz
You apply a deny-all ingress policy to the `default` namespace and nothing else. A Pod with `app: frontend` tries to receive traffic. What happens?

- Traffic is allowed because no policy targets `frontend` specifically
- Traffic is blocked because the deny-all policy covers all Pods in the namespace

**Answer:** Traffic is blocked - the deny-all policy uses `podSelector: {}` which matches every Pod in the namespace, including `frontend`.
:::

Writing ingress rules is about being explicit: who may enter, from where, and on which port. The deny-all pattern combined with targeted allow rules gives you a clean, auditable security posture where every allowed connection was intentionally permitted.
