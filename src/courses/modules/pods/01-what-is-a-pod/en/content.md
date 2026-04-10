---
seoTitle: 'Kubernetes Pods, Containers, Sidecars, Ephemeral Units'
seoDescription: 'Learn how Kubernetes Pods work as the smallest deployable unit, when to use multi-container sidecars, and why Pods are ephemeral by design.'
---

# What Is a Pod

You have a containerized application. You want to run it on Kubernetes. Your first instinct might be to tell Kubernetes: "run this container." But that is not quite how it works. Kubernetes does not deploy containers directly. It deploys **Pods**, and each Pod contains one or more containers. So what is the difference, and why does that extra layer exist?

## The smallest deployable unit

A Pod is the smallest deployable unit in Kubernetes. Think of it as a wrapper around your containers. Every container in the cluster lives inside a Pod, even if that Pod holds only one container.

@@@
graph TB
    subgraph pod ["Pod: web-pod"]
        C1["Container: nginx\nport 80"]
        C2["Container: log-collector\n(sidecar)"]
        NET["Shared network\nIP: 10.244.x.x"]
        VOL["Shared volume\n(optional)"]
    end
    C1 --- NET
    C2 --- NET
    C1 --- VOL
    C2 --- VOL
@@@

A useful analogy: a Pod is like an apartment. The containers are the tenants. They all share the same address (IP), the same mailbox (network ports), and they can knock on each other's door directly (localhost). One address per apartment, always. The building management (Kubernetes) decides which floor of the building (node) that apartment sits on, and it always moves the whole apartment, never just one tenant.

In practical terms, every container inside a Pod shares the same network namespace. They see the same IP address, the same loopback interface, and the same set of ports. Two containers in the same Pod can talk to each other with just `localhost:port`. They can also optionally share a volume, which lets them exchange files on a shared disk.

:::info
Most Pods in the wild hold exactly one container. The multi-container pattern (called a sidecar) is reserved for cases where two containers are genuinely inseparable: a web server paired with a log shipper, or an app container paired with a proxy that handles authentication. If the two containers could run independently and communicate over the network, they belong in separate Pods.
:::

## Why group containers at all?

Why does Kubernetes introduce this Pod concept instead of scheduling containers directly? Because some containers must always run together, on the same node, with the same network. Kubernetes schedules the **whole Pod** onto a node, not individual containers. This guarantees that the nginx container and its log-collector sidecar land on the same machine and can always reach each other via localhost. If Kubernetes scheduled containers individually, those two might end up on different nodes, breaking the guarantee.

That is the core answer to "why Pods exist": they are the unit of co-location. Containers inside the same Pod are always co-located, always co-scheduled, and always share a network.

:::quiz
Which of the following is true for two containers running inside the same Pod?

- They run on different nodes and communicate through the cluster network
- They share the same IP address and can communicate via localhost
- They each get their own IP address and isolated volume mounts

**Answer:** They share the same IP address and can communicate via localhost. The other options describe containers in *different* Pods. The sidecar pattern works precisely because of this shared network: the main container and the sidecar behave as if they are on the same machine.
:::

## Pods are ephemeral by design

Here is something that surprises many beginners: if a Pod crashes or is deleted, **it does not restart itself**. A Pod you create directly is gone when it is gone. Kubernetes does not try to bring it back.

Why is that the intended behavior? Because the components that manage Pod lifecycles, called controllers (you will meet Deployments in the next module), are responsible for creating replacement Pods. If a Pod could repair itself, it would conflict with the controller trying to replace it. The controller would see a missing Pod, create a new one, and the old one would simultaneously try to come back. Chaos.

The correct model is: a Pod dies, a controller notices, and the controller creates a **new** Pod from the same template. Same spec, but a new object with a new unique identifier. The old and new Pods are entirely unrelated from Kubernetes's point of view.

:::warning
Do not confuse "container" and "Pod." Kubernetes never deploys a raw container. Every running unit is a Pod. Even a Pod with a single container is still a Pod, with all the Pod properties: its own IP, its own spec, its own lifecycle. The container is just what runs inside it.
:::

:::quiz
Why are Pods ephemeral by design, rather than self-healing?

**Answer:** Controllers (like Deployments and ReplicaSets) own the job of replacing failed Pods. A Pod that could heal itself would compete with those controllers, creating conflicts and undefined state. The clean contract is: Pods are disposable, controllers are responsible. A dead Pod is replaced by a new Pod with a new UID, not resurrected.
:::

A Pod is the atom of Kubernetes execution. You now know what it is, what it contains, and why it is designed to be temporary. The next step is to look at the structure of a Pod manifest so you can write one from scratch.
