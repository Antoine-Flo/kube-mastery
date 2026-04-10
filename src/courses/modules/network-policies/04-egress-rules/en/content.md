---
seoTitle: Kubernetes Egress Rules, DNS, ipBlock, Outbound Traffic
seoDescription: Learn how to restrict outbound Pod traffic in Kubernetes using egress NetworkPolicy rules, including the critical DNS exception and ipBlock selectors.
---

# Egress Rules

Your `api` Pod handles business logic. It needs to talk to `db` inside the cluster. It should not be able to call external APIs on the internet, exfiltrate data, or reach internal infrastructure it has no business accessing. The ingress policy you wrote protects `db`. But nothing yet controls what `api` itself is allowed to reach.

That is the job of egress rules.

## Egress = Outbound from the Protected Pod

An egress policy restricts traffic that leaves the Pod selected by `podSelector`. Where ingress says "who can send to me," egress says "where am I allowed to send."

@@@
graph LR
    api["Pod: api"] -- "allowed" --> db["Pod: db"]
    api -. "blocked" .-> internet["External internet"]
    api -. "blocked" .-> other["Other internal services"]
@@@

Start with the basic structure: select the Pod and declare that this policy governs egress.

```yaml
spec:
  podSelector:
    matchLabels:
      app: api # illustrative only
  policyTypes:
    - Egress
```

With `policyTypes: [Egress]` and no `egress` rules, all outbound traffic from `api` is blocked. That includes traffic to `db`, to DNS, to everything.

:::quiz
You apply a policy with `policyTypes: [Egress]` and no `egress` field to the `api` Pod. Can `api` still talk to `db`?

- Yes, because `db` has an ingress policy that allows `api`
- No, because the egress policy on `api` blocks all outbound traffic
- Only if they are in the same namespace

**Answer:** No - egress policies control what the source Pod can send, regardless of what the destination allows. Both sides must permit the traffic.
:::

## The DNS Exception You Cannot Forget

:::warning
If you add `Egress` to `policyTypes` and provide any egress rules, you must also add an explicit rule allowing outbound traffic to port 53 (UDP and TCP) toward `kube-system`. Without it, your Pod cannot resolve any hostname. It will see connection errors that look like network failures, but the real cause is DNS being silently blocked. This is one of the most common mistakes when writing egress policies.
:::

Always include the DNS rule first, before adding any other egress rules:

```yaml
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53 # illustrative only
```

Now add the rule that allows `api` to reach `db`:

```yaml
    - to:
        - podSelector:
            matchLabels:
              app: db
      ports:
        - protocol: TCP
          port: 5432 # illustrative only
```

:::quiz
You forget the DNS egress rule. Your `api` Pod tries to connect to `db` using its Service name. What happens?

**Answer:** The connection fails with a name resolution error. Even if port 5432 to `db` is allowed, `api` cannot resolve the name `db` (or `db.default.svc.cluster.local`) because DNS traffic to CoreDNS on port 53 is blocked by the egress policy.
:::

## Applying the Full Egress Policy

Build the complete manifest:

```
nano api-egress-policy.yaml
```

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-egress-only-db
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
    - to:
        - podSelector:
            matchLabels:
              app: db
      ports:
        - protocol: TCP
          port: 5432
```

```
kubectl apply -f api-egress-policy.yaml
```

```
kubectl get networkpolicy
```

You should now see `api-egress-only-db` listed. Verify the details:

```
kubectl describe networkpolicy api-egress-only-db
```

The output lists both egress rules: the DNS rule and the `db` rule. Confirm both appear before proceeding.

## ipBlock with except: Allowing a Range but Excluding IPs

Sometimes you need to allow traffic to an external CIDR but exclude specific addresses inside it. The `ipBlock` field supports an `except` list for this:

```yaml
  egress:
    - to:
        - ipBlock:
            cidr: 10.0.0.0/8
            except:
              - 10.0.0.5/32
              - 10.0.0.10/32 # illustrative only
```

This allows outbound traffic to the entire `10.0.0.0/8` range except those two specific IPs. Think of it as a CIDR allow with carved-out exceptions. The `except` list must be sub-ranges of the `cidr` value.

:::quiz
You allow egress to CIDR `10.0.0.0/8` with `except: [10.0.0.100/32]`. Can the Pod reach `10.0.0.100`?

- Yes, the except field is ignored for single-IP ranges
- No, the except list removes those addresses from the allowed range
- Only if a separate ipBlock rule explicitly allows it

**Answer:** No - `except` removes those addresses from the allowed range. To reach `10.0.0.100` you would need a separate rule targeting it explicitly.
:::

## Combining Ingress and Egress in One Policy

A single NetworkPolicy can govern both ingress and egress for the same Pod. List both in `policyTypes` and provide both sections:

```yaml
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
    - to:
        - podSelector:
            matchLabels:
              app: db
      ports:
        - protocol: TCP
          port: 5432 # illustrative only
```

This policy controls both directions for `api`: only `frontend` can reach it on port 8080, and it can only reach `db` on port 5432 plus DNS. Everything else is blocked in both directions.

Egress policies complete the picture. Ingress protects what enters a Pod; egress controls what leaves it. Together they let you enforce least-privilege networking at the Pod level, ensuring every connection in your cluster was explicitly permitted.
