---
seoTitle: Kubernetes NetworkPolicies, CNI, Pod Selection, Rules
seoDescription: Learn how Kubernetes NetworkPolicies control Pod-level traffic using label selectors, CNI enforcement, and additive allow rules for cluster security.
---

# What Are Network Policies?

Imagine you deploy a three-tier application: a `frontend` Pod, an `api` Pod, and a `db` Pod. Everything works. But then you realize that the `frontend` Pod can also talk directly to `db`, bypassing `api` entirely. Worse, any other Pod that lands in the cluster, whether from a misconfigured deployment or something more hostile, can reach `db` just as freely. Nothing is blocking it.

This is the default state of Kubernetes networking: every Pod can reach every other Pod, across namespaces, without restriction.

## No Isolation by Default

@@@
graph LR
    frontend["Pod: frontend"] --> api["Pod: api"]
    frontend --> db["Pod: db"]
    api --> db
    rogue["Pod: rogue"] --> db
    rogue --> api
@@@

In the diagram above, all four Pods communicate freely. Kubernetes sets up an internal network where every Pod gets a unique IP, and that IP is reachable from any other Pod in the cluster. There is no built-in firewall between Pods. This design makes networking simple and predictable, but it means isolation is your responsibility.

Run this command in the simulator to see the Pods currently running:

```
kubectl get pods -o wide
```

Notice each Pod has its own IP address. Without any policy, all of those IPs can communicate with each other.

:::quiz
By default, can a Pod in namespace `frontend` reach a Pod in namespace `backend` on any port?

- No, namespaces create network isolation automatically
- Yes, all Pods can reach all other Pods regardless of namespace
- Only if they share a Service

**Answer:** Yes, all Pods can reach all other Pods regardless of namespace - namespaces are organizational boundaries, not network boundaries.
:::

## NetworkPolicy as a Declarative Firewall

A NetworkPolicy is a Kubernetes resource that declares which Pods are allowed to communicate with which others, and on which ports. Think of it as a label-based firewall rule that lives inside the cluster. Instead of configuring IP tables manually on each node, you write a policy that targets Pods by their labels and Kubernetes enforces it cluster-wide.

@@@
graph LR
    frontend["Pod: frontend"] --> api["Pod: api"]
    api --> db["Pod: db"]
    frontend -. "blocked" .-> db
    rogue -. "blocked" .-> db
    rogue -. "blocked" .-> api
@@@

With a NetworkPolicy applied, only `api` can reach `db`. The `frontend` and any rogue Pod are blocked. The cluster topology did not change, the Pod IPs are the same, but traffic is now filtered.

```
kubectl get networkpolicy
```

If you run this now, the list is empty. That confirms no policies are active yet and everything is open.

## The CNI Plugin Enforces the Rules

Kubernetes itself does not enforce NetworkPolicies. The enforcement is delegated to the CNI plugin, which is the network layer responsible for connecting Pods. Popular CNI plugins that support NetworkPolicies include Calico, Cilium, and Weave. If your cluster uses a CNI that does not support NetworkPolicies (such as Flannel without additional components), you can create policy objects but they will be completely ignored.

:::info
In this simulator, NetworkPolicies are applied by the simulated network layer. The enforcement behavior matches what you would see with a compatible CNI plugin.
:::

Why is enforcement delegated to the CNI? Because Kubernetes is designed around extensibility. The control plane defines the desired state; the network plugin implements it. This separation keeps the core API stable while allowing different networking implementations.

## Policies Are Additive

When multiple NetworkPolicies select the same Pod, their rules are combined using a logical OR. If policy A allows traffic from `frontend` and policy B allows traffic from `monitoring`, then the Pod covered by both policies accepts traffic from either source. There is no conflict, no precedence, no override.

This additive model means you can safely apply policies from different teams or different purposes without worrying that one will cancel another. You only ever grant permissions; you never accidentally revoke them by adding a second policy.

:::quiz
You apply two NetworkPolicies to the same Pod. Policy A allows ingress from label `role=api`. Policy B allows ingress from label `role=monitoring`. What is the result?

- The second policy overrides the first
- The Pod accepts traffic from both `role=api` and `role=monitoring`
- A conflict error is raised and neither policy applies

**Answer:** The Pod accepts traffic from both - NetworkPolicies are additive, each one adds allowed sources, none can remove what another has permitted.
:::

## Verifying What Is Selected

Once you start writing policies, you need to verify they are targeting the right Pods. Two commands help here:

```
kubectl get networkpolicy
```

```
kubectl describe networkpolicy <policy-name>
```

The `describe` output shows the `PodSelector`, the `PolicyTypes`, and the actual ingress and egress rules. It also lists which Pods in the namespace currently match the selector, which makes it easy to confirm your labels are correct.

:::warning
NetworkPolicies do not affect traffic between containers inside the same Pod. Containers in a Pod share a network namespace and communicate over localhost. Policies only govern traffic crossing Pod boundaries.
:::

NetworkPolicies give you the ability to enforce the principle of least privilege at the network level. A Pod should only be reachable from the sources it actually needs. Everything else should be blocked by default, not by luck.
