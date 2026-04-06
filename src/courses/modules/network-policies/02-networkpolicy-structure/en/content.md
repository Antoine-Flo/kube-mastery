---
seoTitle: Kubernetes NetworkPolicy Structure, YAML, Selectors, Ports
seoDescription: Understand the full NetworkPolicy manifest structure, including podSelector, policyTypes, ingress and egress rules, and AND vs OR selector logic.
---

# NetworkPolicy Structure

Like all Kubernetes resources, a NetworkPolicy is a YAML manifest with a predictable structure. Once you internalize it, you can read and write policies confidently, and reason about what a policy does or doesn't allow just by reading it.

## The Top-Level Shape

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: my-policy
  namespace: default
spec:
  podSelector: ...
  policyTypes: [...]
  ingress: [...]
  egress: [...]
```

The `apiVersion` is always `networking.k8s.io/v1`. Everything meaningful lives under `spec`, which has four key fields: `podSelector`, `policyTypes`, `ingress`, and `egress`.

## podSelector: Which Pods This Policy Governs

The `podSelector` field determines which Pods in the namespace this policy applies to, using the same label-matching syntax you've seen throughout Kubernetes.

```yaml
podSelector:
  matchLabels:
    app: backend
```

This selects all Pods labeled `app=backend`. Any Pod without that label is completely unaffected.

There's a special case worth knowing: an **empty podSelector** (`podSelector: {}`) selects all Pods in the namespace. This is frequently used for "default deny" policies that lock down an entire namespace.

## policyTypes: Declaring Your Intent

The `policyTypes` field lists which traffic directions this policy addresses: `Ingress`, `Egress`, or both.

```yaml
policyTypes:
  - Ingress
  - Egress
```

This field matters more than it might seem:

- Including `Ingress` activates ingress filtering using your `ingress` rules. If `ingress` is empty or absent, the result is **deny-all ingress**.
- Including `Egress` activates egress filtering. If `egress` is empty or absent, the result is **deny-all egress**.

:::warning
Omitting `policyTypes` entirely means Kubernetes infers it from the presence or absence of `ingress` and `egress` sections. To avoid surprises, always declare `policyTypes` explicitly.
:::

## ingress: Rules for Inbound Traffic

The `ingress` field is a list of rules. Each rule defines allowed sources (`from`) and optionally restricts ports and protocols. Traffic is allowed if it matches **at least one** rule.

```yaml
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: frontend
    ports:
      - protocol: TCP
        port: 8080
```

This rule allows inbound TCP on port 8080 from Pods labeled `app=frontend`. Anything else, different port, different source, is blocked.

## egress: Rules for Outbound Traffic

The `egress` field mirrors `ingress`, but for outbound traffic. Instead of `from`, you use `to`.

```yaml
egress:
  - to:
      - podSelector:
          matchLabels:
            app: database
    ports:
      - protocol: TCP
        port: 5432
```

This allows outbound TCP connections on port 5432 to Pods labeled `app=database`. All other outbound traffic is blocked.

## A Complete Example

A backend service that should only accept HTTP traffic from the frontend, on a specific port:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
```

Reading this aloud: "In the `default` namespace, Pods labeled `app=backend` will only accept inbound TCP connections on port 8080 from Pods labeled `app=frontend`. All other inbound traffic is denied."

Notice that `policyTypes` only contains `Ingress`, egress from the backend is **not restricted** by this policy. The backend Pods can still make outbound connections anywhere. That's intentional here: we're only locking down who can reach the backend.

## The from and to Arrays: OR vs AND Logic

The `from` (and `to`) array supports three types of selectors:

- **podSelector**: matches Pods by their labels within the same namespace as the policy
- **namespaceSelector**: matches all Pods in namespaces whose labels match
- **ipBlock**: matches traffic from (or to) a CIDR IP range

**Multiple items in the array = OR logic.** Traffic is allowed if it matches any one of them.

```yaml
from:
  - podSelector:
      matchLabels:
        app: frontend
  - podSelector:
      matchLabels:
        app: monitoring
```

This allows traffic from frontend Pods **OR** monitoring Pods.

**Multiple fields inside a single item = AND logic.** Both conditions must be true simultaneously.

```yaml
from:
  - podSelector:
      matchLabels:
        app: frontend
    namespaceSelector:
      matchLabels:
        env: production
```

This allows traffic only from Pods labeled `app=frontend` that are _also_ in a namespace labeled `env=production`. A frontend Pod in a different namespace would be blocked.

:::info
The distinction between one list item with multiple fields (AND) versus multiple list items (OR) is one of the trickiest aspects of NetworkPolicy syntax. Each list item (`-`) is an independent path. Fields within one item all have to match at once.
:::

## The Structure as a Diagram

@@@
graph TD
    NP["NetworkPolicy"]

    NP --> PS["podSelector<br/>Which Pods this governs"]
    NP --> PT["policyTypes<br/>[Ingress, Egress]"]
    NP --> IG["ingress[]<br/>List of inbound rules"]
    NP --> EG["egress[]<br/>List of outbound rules"]

    IG --> IGR["Rule (item in list)<br/>— OR with other rules"]
    IGR --> FROM["from[]<br/>Allowed sources<br/>(OR between items)"]
    IGR --> PORTS["ports[]<br/>Allowed ports/protocols"]

    FROM --> PS2["podSelector"]
    FROM --> NS2["namespaceSelector"]
    FROM --> IP2["ipBlock (CIDR)"]

    EG --> EGR["Rule (item in list)"]
    EGR --> TO["to[]<br/>Allowed destinations"]
    EGR --> PORTS2["ports[]"]
@@@

## Ports: Restricting Further

The `ports` array within each ingress or egress rule narrows down which ports and protocols are matched. If you omit `ports` from a rule, the rule matches all ports, be intentional about this.

Each port entry can specify:

- `protocol`: `TCP`, `UDP`, or `SCTP`. Defaults to `TCP` if omitted.
- `port`: a port number (e.g., `8080`) or a named port (e.g., `"http"`)
- `endPort`: optionally specify a range when combined with `port` (covered in the advanced lesson)

If you want to allow both TCP and UDP on the same port, you need two separate entries in the `ports` list, one for each protocol.

## Hands-On Practice

Let's apply the `allow-frontend-to-backend` policy and verify it works. Use the terminal on the right panel.

**1. Create test Pods with the correct labels:**

```bash
kubectl run frontend --image=nginx:1.28 --labels="app=frontend"
kubectl run backend --image=nginx:1.28 --labels="app=backend"
kubectl run other --image=nginx:1.28 --labels="app=other"
```

**2. Get the backend Pod's IP:**

```bash
kubectl get pods -o wide
```

**3. Apply the NetworkPolicy:**

```yaml
# allow-frontend-to-backend-networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 80
```

```bash
kubectl apply -f allow-frontend-to-backend-networkpolicy.yaml
```

**4. Test from the frontend (should succeed):**

```bash
kubectl exec frontend -- curl -s --connect-timeout 3 <BACKEND-IP>
```

**5. Test from the other Pod (should be blocked):**

```bash
kubectl exec other -- curl -s --connect-timeout 3 <BACKEND-IP>
```

The `other` Pod doesn't have the `app=frontend` label, so the policy blocks it.

**6. Inspect the policy:**

```bash
kubectl describe networkpolicy allow-frontend-to-backend
```

Look at the `PodSelector` and `Allowing ingress traffic` sections, they summarize the policy in human-readable form.

**7. Clean up:**

```bash
kubectl delete pod frontend backend other
kubectl delete networkpolicy allow-frontend-to-backend
```

You now understand the complete structure of a NetworkPolicy manifest. In the next two lessons, we'll go deep on ingress rules and egress rules separately, covering all the edge cases and patterns you'll encounter in real clusters.
