---
seoTitle: 'Kubernetes Security Fundamentals, Authentication, Authorization, Admission'
seoDescription: 'Learn the three security gates every Kubernetes request passes through: Authentication, Authorization, and Admission Control, and which cluster surfaces need protecting.'
---

# Kubernetes Security Fundamentals

You just deployed a web application to the simulated cluster. Anyone with credentials can run `kubectl delete deployment my-app` and wipe it. A rogue internal service could try to list all Secrets and read passwords. A misconfigured CI pipeline could push workloads to namespaces it should never touch. These are not theoretical risks. In a real organization, the cluster surface is accessible to many actors: developers, operators, automation jobs, and third-party tools.

The question is: how does Kubernetes decide who can do what?

## Three gates, one path

Every request that reaches the Kubernetes API server, whether it comes from `kubectl`, a Pod's service account, or any external client, travels through exactly three gates in sequence. None can be skipped.

@@@
graph LR
    Client["Client\n(kubectl / Pod / CI)"]
    Authn["Authentication\nWho are you?"]
    Authz["Authorization\nAre you allowed?"]
    Admission["Admission Control\nIs the request valid?"]
    Etcd["etcd\n(cluster state)"]

    Client --> Authn
    Authn --> Authz
    Authz --> Admission
    Admission --> Etcd
@@@

**Authentication** answers: who is making this request? It verifies an identity, a certificate, a token, or an external credential. If the API server cannot identify the caller, the request stops here with a `401 Unauthorized` error.

**Authorization** answers: is this identity allowed to perform this action? Kubernetes uses RBAC (Role-Based Access Control) by default. A valid identity that lacks permission gets a `403 Forbidden`.

**Admission Control** is the third gate. It validates and mutates the request before the object is written to etcd. Admission controllers can enforce policies like "no container may run as root" or "every resource must have a label." If a request fails admission, it is rejected even though the caller was authenticated and authorized.

Each gate is independent. Passing one does not guarantee passing the next.

:::quiz
A request reaches the API server with a valid certificate. The API server returns 403 Forbidden. Which gate rejected it?

- Authentication, because the certificate was not trusted
- Authorization, because the identity lacks the required permission
- Admission Control, because the resource spec is invalid

**Answer:** Authorization. The certificate was valid (Authentication passed), but the identity behind it does not have permission to perform the requested action. A 403 means "I know who you are, but you cannot do this."
:::

## What surfaces need protecting?

The three-gate model applies to every API request. But the cluster has more surfaces than just the API. Start by seeing your cluster's entry point:

```bash
kubectl cluster-info
```

The output shows the control plane address. Every `kubectl` command, every Pod making API calls, every admission webhook, all of it goes through that single HTTPS endpoint. That is why the `kube-apiserver` is the highest-value target to protect.

```bash
kubectl get nodes
```

Each node runs a `kubelet`, the agent that starts and monitors Pods. The kubelet exposes its own HTTPS API on port 10250. It can be used to read logs, execute commands in containers, or query running Pods on that node. By default, the kubelet requires authenticated and authorized requests. A misconfigured kubelet with anonymous access enabled is a known attack vector.

@@@
graph TB
    APIServer["kube-apiserver\n:6443 (HTTPS)"]
    Etcd["etcd\n:2379 (TLS)"]
    Kubelet1["kubelet\nnode-1 :10250"]
    Kubelet2["kubelet\nnode-2 :10250"]

    APIServer --> Etcd
    APIServer --> Kubelet1
    APIServer --> Kubelet2
@@@

Beyond the API server and kubelets, **etcd** is the most sensitive component. It stores every object in the cluster in plaintext. Anyone with direct read access to etcd bypasses all three gates. In a production cluster, etcd requires mutual TLS and is accessible only from the control plane. The simulator abstracts this with an in-memory store, but the access model remains the same.

:::info
The scheduler and controller manager also communicate with the API server using client certificates. They are internal actors, but they are still authenticated through the same gates. The principle is consistent: no component, internal or external, bypasses authentication.
:::

:::warning
The `kubectl cluster-info dump` command (not available in the simulator) produces a large JSON snapshot of cluster state including Secrets. In a real cluster, treat that output as sensitive. Always scope what you expose in CI pipelines or support tickets.
:::

:::quiz
Which component stores every Kubernetes object and must be protected independently from the API server?

**Answer:** etcd. It is the underlying key-value store for all cluster state. Direct read access to etcd bypasses Authentication, Authorization, and Admission Control entirely. This is why etcd is isolated behind TLS and network controls in any hardened cluster.
:::

## Why the model is sequential

The sequence matters. Authentication always runs first because authorization needs a verified identity to evaluate. Admission Control always runs last because it validates the final, authorized request, often by injecting or mutating fields before writing to etcd. Reversing the order would break the entire security contract.

This design also means you can reason about failures precisely. A `401` tells you the identity check failed. A `403` tells you the identity was valid but the permission was not granted. An admission rejection has its own error message from the specific controller that blocked it. Each gate gives you a distinct diagnostic signal.

The next lessons go deeper into the first gate: how Kubernetes actually verifies identities, what methods it supports, and why users in Kubernetes work differently from users in almost every other system you have used.
