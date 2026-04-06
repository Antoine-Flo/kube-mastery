---
seoTitle: Kubernetes NetworkPolicies, CNI, Pod Selection, Rules
seoDescription: Learn how Kubernetes NetworkPolicies control Pod-level traffic using label selectors, CNI enforcement, and additive allow rules for cluster security.
---

# What Are NetworkPolicies?

When you first spin up a Kubernetes cluster, every Pod can talk to every other Pod, frontend to database, database to logging service, logging sidecar to payment processor. There are no firewalls, no access controls, no barriers of any kind. It's a completely flat network, and every workload trusts every other workload by default.

For learning and experimentation, that's fine. In production, it's a serious liability. A vulnerability in one dependency gives an attacker code execution inside a container, and from there, they can freely reach your database, your internal API, your secrets store, and anything else in the cluster without any additional privilege escalation. A single breach becomes a full compromise.

**NetworkPolicy** is Kubernetes's answer to this problem. It lets you define, at the Pod level, exactly which inbound and outbound traffic is permitted. Everything not explicitly permitted is denied. Think of it as a declarative, label-driven firewall living inside your cluster.

## The Open Office Analogy

Imagine a large open-plan office where every employee can freely walk up to anyone else's desk. No badges, no locked doors. That's your default Kubernetes cluster, friendly and easy to navigate, but if someone untrustworthy wanders in, they can reach any desk.

Now imagine the office installs a security system: certain areas require a badge to enter. The accounting department opens only for "Finance" badges, the server room for "Infrastructure" badges. Most people still move freely in common areas, but sensitive zones are now protected.

NetworkPolicies work the same way. You attach them to groups of Pods using **label selectors**. A policy that selects Pods labeled `app=database` defines who is allowed to connect to those Pods, and nothing else gets through.

## The Critical Caveat: CNI Plugin Support

NetworkPolicies are **defined** by Kubernetes, but **enforced** by your CNI (Container Network Interface) plugin. Kubernetes stores the policy objects; the actual packet filtering happens at the network layer.

:::warning
**If your CNI plugin doesn't support NetworkPolicies, the policies you create will have no effect.** Flannel, a popular, simple CNI, silently ignores them. Plugins that do support NetworkPolicies include **Calico**, **Cilium**, **Weave Net**, and **Antrea**. Always verify your CNI before relying on NetworkPolicies for security.
:::

Before writing any policies, confirm what CNI your cluster uses. In managed Kubernetes offerings (GKE, EKS, AKS), the CNI is typically configured by the cloud provider, and each has its own defaults for policy enforcement.

## How Selection Works

A NetworkPolicy is scoped to a **namespace**. It selects Pods within that namespace via a `podSelector`, and once a policy selects a Pod, that Pod's traffic is governed by its rules.

The logic follows two key rules:

- **No policy selected → wide open.** All ingress and egress traffic is allowed. This is the default for every Pod in a fresh namespace.
- **Any policy selected → default deny.** Only traffic explicitly allowed by some policy is permitted. The Pod shifts from "allow everything" to "deny everything except...". Creating a policy doesn't just add rules, it changes the Pod's entire default posture for the traffic types the policy covers.

@@@
graph LR
    subgraph "No Policy Applied"
        A1["Frontend Pod"] -->|"✅ allowed"| B1["Backend Pod"]
        C1["External Pod"] -->|"✅ allowed"| B1
        D1["Any Pod"] -->|"✅ allowed"| B1
    end

    subgraph "NetworkPolicy Applied to Backend"
        A2["Frontend Pod<br/>(app=frontend)"] -->|"✅ allowed<br/>(matches policy)"| B2["Backend Pod<br/>(app=backend)"]
        C2["Other Pod"] -->|"❌ blocked"| B2
        D2["Any other source"] -->|"❌ blocked"| B2
    end
@@@

## Policies Are Additive

Multiple NetworkPolicies can apply to the same Pod simultaneously. The allowed traffic is the **union** of all applicable policies, traffic is permitted if _any_ policy allows it. Policies can never cancel out or override each other; you can only add permission.

This additive nature lets you build your security model incrementally: start with a blanket deny-all policy, then add targeted allow policies for each specific traffic flow your application requires.

:::info
NetworkPolicies are a **namespace-scoped** resource. A policy in the `production` namespace can only select Pods in `production`. To secure multiple namespaces, create policies in each one, or use a CNI like Cilium that supports cluster-wide policies as an extension.
:::

## What NetworkPolicies Cannot Do

NetworkPolicies operate at Layer 3/4 (IP and port level), not at the application layer. Here's what they explicitly don't cover:

- **No mutual TLS, retries, or circuit breaking** that's the service mesh domain.
- **No traffic logging or auditing** blocked connections leave no automatic record unless your CNI adds observability features.
- **No effect on host-network Pods** Pods with `hostNetwork: true` bypass the Pod network and use the node's IP directly.
- **Not a replacement for RBAC** RBAC governs API access; NetworkPolicies govern network traffic between Pods. They're complementary.

## Hands-On Practice

Let's see the default open networking behavior and then apply a policy to see the difference. Use the terminal on the right panel.

**1. Create two test Pods in the default namespace:**

```bash
kubectl run frontend --image=nginx:1.28 --labels="app=frontend"
kubectl run backend --image=nginx:1.28 --labels="app=backend"
```

**2. Wait for them to be running, then note the backend's IP:**

```bash
kubectl get pods -o wide
```

**3. Verify the frontend can reach the backend (default behavior, no policy):**

```bash
kubectl exec frontend -- curl -s --connect-timeout 3 <BACKEND-IP>
```

Replace `<BACKEND-IP>` with the actual IP from step 2. You should see the nginx welcome HTML.

**4. Apply a NetworkPolicy that blocks all ingress to the backend:**

```yaml
# deny-all-ingress-to-backend-networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-ingress-to-backend
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress: []
```

```bash
kubectl apply -f deny-all-ingress-to-backend-networkpolicy.yaml
```

**5. Retry the curl from frontend to backend:**

```bash
kubectl exec frontend -- curl -s --connect-timeout 3 <BACKEND-IP>
```

The request should now time out, the policy is being enforced by your CNI.

**6. Check the policy was created:**

```bash
kubectl get networkpolicies
kubectl describe networkpolicy deny-all-ingress-to-backend
```

**7. Clean up:**

```bash
kubectl delete pod frontend backend
kubectl delete networkpolicy deny-all-ingress-to-backend
```

## Wrapping Up

NetworkPolicies shift a namespace from fully open to controlled: once any policy selects a Pod, only explicitly allowed traffic flows through. They rely on your CNI for enforcement and are additive by design. In the next lesson, we'll explore the full structure of a NetworkPolicy manifest so you can write precise, nuanced traffic rules.
