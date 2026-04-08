---
seoTitle: 'Kubernetes Pod IPs, Ephemeral Networking, Why Services Exist'
seoDescription: 'Understand why Pod IP addresses are temporary, what happens to them when Pods restart or reschedule, and why that makes direct Pod-to-Pod communication unreliable.'
---

# Ephemeral Pod IPs

Every Pod that reaches `Running` state gets its own IP address. You can see it with `kubectl get pods -o wide`, and you can reach it from any other Pod in the cluster without any special configuration. The cluster network is flat: every Pod can talk to every other Pod directly by IP.

This sounds like a solid foundation for inter-service communication. It is not, and understanding why is the starting point for everything that follows in this module.

## Why Pod IPs Cannot Be Trusted

When a Deployment updates its Pods, old Pods are deleted and new ones are created. The new Pods get new IP addresses. The old IPs are gone. If another service was talking to the old IP, it is now talking to nothing.

The same happens whenever a Pod crashes and restarts through a controller: the replacement Pod gets a fresh IP. Or when a node runs out of memory and the scheduler evicts a Pod and places it elsewhere: new node, new IP.

@@@
sequenceDiagram
    participant A as Pod A (client)
    participant B1 as Pod B v1<br/>IP: 10.0.0.5
    participant B2 as Pod B v2<br/>IP: 10.0.0.9

    A->>B1: HTTP GET /api (10.0.0.5)
    B1-->>A: 200 OK

    Note over B1,B2: Deployment rolls out new version

    B1->>B1: deleted
    B2->>B2: created, new IP

    A->>B1: HTTP GET /api (10.0.0.5)
    Note over A: connection refused
@@@

Pod IPs are ephemeral by design. Kubernetes never guarantees that a Pod keeps the same IP across restarts, rescheduling events, or rolling updates. Hardcoding a Pod IP into any configuration is always wrong.

:::quiz
Your frontend Pod connects to a backend Pod by its IP address `10.0.0.5`. The backend Deployment rolls out a new version. What happens to the frontend?

**Answer:** The frontend loses its connection. The old backend Pod is deleted and its IP `10.0.0.5` disappears. The new backend Pod gets a different IP. The frontend has no way to discover it unless something else provides a stable address in front of the Pods.
:::

## Proving It

Start a Deployment with two replicas:

```bash
kubectl create deployment backend --image=nginx:1.28 --replicas=2
```

Wait for it to be ready, then check the Pod IPs:

```bash
kubectl get pods -o wide -l app=backend
```

Note the IPs. Now trigger a rollout by changing the image:

```bash
kubectl set image deployment/backend nginx=nginx:1.27
kubectl get pods -o wide -l app=backend --watch
```

Press Ctrl+C once the rollout is done. Run `kubectl get pods -o wide -l app=backend` again. The IPs have changed. The old ones are gone and unreachable.

:::visualizer
Watch the cluster visualizer: old Pods disappear and new Pods appear on the node with different IPs as the rollout progresses.
:::

:::warning
Some people attempt to work around ephemeral IPs by targeting the node IP directly or using `hostNetwork: true` on a Pod. Both approaches break the cluster network model, create implicit coupling to specific nodes, and cause failures when Pods reschedule. The correct solution is always a Service.
:::

## What the Cluster Network Guarantees

Before leaving ephemeral IPs behind, it is worth understanding what the cluster network does guarantee.

Every Pod can reach every other Pod in the cluster by IP without NAT. There is no firewall between Pods by default. A Pod on node 1 can open a TCP connection to a Pod on node 2 using the Pod's IP directly, and the packet arrives with the source IP intact. This is the Container Network Interface (CNI) contract that every Kubernetes networking plugin must fulfill.

What the cluster network does not provide is any form of stable addressing, load balancing, or service discovery. Those are the job of the Service resource, which is what the next lesson covers.

```bash
kubectl delete deployment backend
```

Pod IPs are real and routable within the cluster, but they are not reliable. Every time a Pod is replaced, its IP changes. Building inter-service communication on direct Pod IPs means building on sand. The solution Kubernetes provides is the Service: a stable virtual IP that sits in front of a group of Pods and stays constant regardless of what happens to the Pods behind it.
