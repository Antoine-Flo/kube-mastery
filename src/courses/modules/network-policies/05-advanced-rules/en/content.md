---
seoTitle: Advanced Kubernetes NetworkPolicy: Deny-All, Port Ranges
seoDescription: Explore advanced NetworkPolicy patterns in Kubernetes: default deny-all, cross-namespace AND logic, port ranges, and additive policy composition.
---

# Advanced NetworkPolicy Patterns

You now understand the building blocks: how NetworkPolicies select Pods, how ingress rules work, and how egress rules work. Real production clusters don't use a single simple policy, they use layered strategies, multiple overlapping policies, and nuanced selectors. This lesson covers the patterns you'll reach for when you need to go beyond the basics.

## The Default Deny All Pattern: Defense in Depth

The most effective security posture for a production namespace isn't to write careful allow rules and trust that you got them all right. It's to **start from zero trust**, deny everything by default, then add explicit allow rules for every traffic flow your application actually needs.

This is called **defense in depth**: if you forget to lock down a service, it's unreachable by default rather than wide open.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress: []
  egress: []
```

One policy. Selects all Pods. No rules. Result: nothing can reach anything, and nothing can reach out. From here, add granular allow policies for each specific service: let the frontend receive HTTP traffic, let the backend reach the database, let everything reach DNS.

:::warning
Don't forget DNS! The moment you apply a deny-all egress policy, DNS resolution breaks for all Pods in the namespace. Always add a follow-up egress policy allowing UDP/TCP port 53 to the `kube-system` namespace immediately after applying deny-all. Treat it as a mandatory companion.
:::

## Combining podSelector and namespaceSelector: AND Logic

Suppose you have a `monitoring` namespace and a `production` namespace. You want to allow your Prometheus scraper to collect metrics from production Pods, but only the Prometheus Pod, not anything else in the monitoring namespace.

Using two separate items in `from` would be wrong:

```yaml
from:
  - podSelector:
      matchLabels:
        app: prometheus
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: monitoring
```

This is OR logic: it allows any Pod labeled `app=prometheus` in the same namespace, **OR** anything from the monitoring namespace. An attacker who compromises any Pod in monitoring could now reach your production Pods.

The correct approach uses a single item with both selectors, AND logic:

```yaml
from:
  - podSelector:
      matchLabels:
        app: prometheus
    namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: monitoring
```

Now only Pods labeled `app=prometheus` that also reside in the `monitoring` namespace are allowed. This is the pattern you want whenever you're opening a cross-namespace path.

## ipBlock: CIDR Ranges and Exceptions

The `ipBlock` selector allows you to express policies in terms of IP address ranges. This is primarily useful for: allowing traffic from outside the cluster (ingress from an external load balancer or office VPN), or allowing Pods to reach external destinations (egress to a third-party API).

```yaml
ingress:
  - from:
      - ipBlock:
          cidr: 172.16.0.0/12
          except:
            - 172.16.1.0/24
```

This allows inbound traffic from the entire `172.16.0.0/12` range, a typical private network for an office VPN, except for the specific subnet `172.16.1.0/24`. The `except` field is useful when you need to allow a broad range but exclude a known segment such as a guest network.

:::info
`ipBlock` matches the source IP of the packet as seen at the node level, not the Pod's internal IP. For traffic entering through a load balancer or NodePort, the source IP may be the load balancer's IP rather than the original client's IP, depending on your cluster's configuration. Always test `ipBlock` rules carefully.
:::

## Port Ranges With endPort

Starting in Kubernetes 1.25, you can specify a range of ports in a single rule using `endPort` alongside `port`.

```yaml
ports:
  - protocol: TCP
    port: 8000
    endPort: 8999
```

This matches any TCP connection on ports 8000 through 8999 inclusive. Without `endPort`, you'd need to list each port individually or write multiple rules. The `protocol` field is required when using `endPort`, and `endPort` must always be greater than or equal to `port`.

## NetworkPolicies Are Additive: The Union Model

A Pod can be selected by multiple NetworkPolicies simultaneously. The effective rule set is the **union** of all applicable policies, traffic is allowed if _any_ policy permits it.

This architectural property lets you compose your security posture from many small, focused policies rather than one massive, hard-to-read policy. Each team or service can own its own policy, and the overall behavior is the sum of all of them.

```mermaid
graph TD
    subgraph "Policies selecting the Backend Pod"
        P1["Policy A<br/>Allow ingress from frontend:8080"]
        P2["Policy B<br/>Allow ingress from monitoring:9090"]
        P3["Policy C<br/>Allow egress to database:5432<br/>Allow egress to DNS:53"]
    end

    B["Backend Pod<br/>(app=backend)"]

    P1 -->|contributes to| B
    P2 -->|contributes to| B
    P3 -->|contributes to| B

    B --> ALLOW["Effective allowed traffic:<br/>• Ingress from frontend on :8080<br/>• Ingress from monitoring on :9090<br/>• Egress to database on :5432<br/>• Egress to DNS on :53<br/>• All other traffic blocked"]
```

There's no way to use one policy to "block" what another policy has allowed. Once traffic is permitted by any policy, it goes through.

## The Limitation: No Logging or Auditing

NetworkPolicies are silent enforcers: traffic either passes or it doesn't, with no built-in logging, auditing, or alerting on blocked connections.

For visibility into policy decisions, you need a CNI plugin with observability extensions:

- **Cilium + Hubble** real-time graphical view of all traffic flows, showing which connections were allowed or dropped and by which policy.
- **Calico** similar capabilities via flow log export.

Factor CNI observability into your cluster design from the start. Retrofitting it is significantly harder than building it in.

## A Full Multi-Service Namespace Example

Here's how you'd compose policies for a realistic three-tier application: frontend, backend, and database. Start with a deny-all, then open each necessary path.

```yaml
# 1. Default deny everything
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress: []
  egress: []
# 2. Allow DNS for all Pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: app
spec:
  podSelector: {}
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
# 3. Frontend accepts inbound HTTP from anywhere
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-ingress
  namespace: app
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
    - Ingress
  ingress:
    - ports:
        - protocol: TCP
          port: 80
# 4. Frontend can reach backend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-to-backend
  namespace: app
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - protocol: TCP
          port: 8080
# 5. Backend accepts from frontend only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-ingress
  namespace: app
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
# 6. Backend can reach database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-to-database
  namespace: app
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - protocol: TCP
          port: 5432
# 7. Database accepts from backend only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-ingress
  namespace: app
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: backend
      ports:
        - protocol: TCP
          port: 5432
```

Seven policies, clearly named, each responsible for one specific traffic path. The database is completely unreachable except from the backend. The backend is completely unreachable except from the frontend. Any path not described above is silently blocked.

## Hands-On Practice

Let's apply a multi-policy setup to a real namespace and verify isolation. Use the terminal on the right panel.

**1. Create a dedicated namespace and set up test Pods:**

```bash
kubectl create namespace secured-app
kubectl run frontend -n secured-app --image=nginx:1.28 --labels="app=frontend"
kubectl run backend -n secured-app --image=nginx:1.28 --labels="app=backend"
kubectl run intruder -n secured-app --image=busybox:1.36 --labels="app=intruder" -- sleep 3600
```

**2. Get the backend IP within the namespace:**

```bash
kubectl get pods -n secured-app -o wide
```

**3. Confirm the intruder can reach the backend before any policy:**

```bash
kubectl exec -n secured-app intruder -- wget -qO- --timeout=3 <BACKEND-IP>
```

**4. Apply a deny-all policy:**

```yaml
# default-deny-all-networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: secured-app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress: []
  egress: []
```

```bash
kubectl apply -f default-deny-all-networkpolicy.yaml
```

**5. Apply a selective allow: frontend can reach backend:**

```yaml
# frontend-to-backend-networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: frontend-to-backend
  namespace: secured-app
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
kubectl apply -f frontend-to-backend-networkpolicy.yaml
```

**6. Test access from frontend (should work) and intruder (should fail):**

```bash
kubectl exec -n secured-app frontend -- curl -s --connect-timeout 3 <BACKEND-IP>
kubectl exec -n secured-app intruder -- wget -qO- --timeout=3 <BACKEND-IP>
```

**7. List all policies in the namespace:**

```bash
kubectl get networkpolicies -n secured-app
```

**8. Clean up the entire namespace:**

```bash
kubectl delete namespace secured-app
```

Deleting the namespace removes all resources inside it, Pods, policies, and all.

## Wrapping Up

The patterns in this lesson are the foundation of a secure, understandable Kubernetes network architecture: deny-all as a baseline, targeted allows for each traffic flow, AND logic for cross-namespace precision, and the additive union model that lets you compose policies independently.
