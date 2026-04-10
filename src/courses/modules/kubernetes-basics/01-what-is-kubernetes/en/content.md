---
seoTitle: 'What Is Kubernetes, Orchestration, Scheduling, Self-Healing'
seoDescription: 'Understand what Kubernetes is, how it solves container management challenges, and the key capabilities it provides including scheduling and self-healing.'
---

# What Is Kubernetes

Imagine your team just shipped a new version of your backend service. You packaged it as a container, pushed the image, and SSH'd into three servers one by one to pull and restart it. At 2am, one of those containers crashed. Nobody noticed until users started complaining. You restarted it manually, went back to sleep, and it crashed again an hour later. Meanwhile, traffic was hitting all three servers unevenly because the load balancer config was done by hand two months ago and nobody touched it since.

That is not an unusual story. That is what running containers without an orchestrator looks like.

## Kubernetes as an Orchestrator

Kubernetes is a container orchestration platform. It takes over the operational work your team was doing by hand: deciding where containers run, keeping them running, distributing traffic, and reacting when things fail. You stop giving direct orders to individual servers, and you start telling Kubernetes what the final result should look like.

This shift is called **desired state**. Instead of saying "go to server 3 and start this container", you say "I want 3 copies of this container running at all times." Kubernetes holds that intention, observes the actual state of the cluster continuously, and acts whenever reality drifts from what you declared.

@@@
flowchart TD
    A["Declare"] --> B["Observe"]
    B --> C{Drift?}
    C -->|Yes| D["Act"]
    C -->|No| E["Wait"]
    D --> B
    E --> B
@@@

This reconciliation loop runs constantly. If a Pod crashes, Kubernetes starts a replacement. If a node goes offline, Kubernetes reschedules the affected Pods onto healthy nodes. You declared the goal once, and Kubernetes keeps chasing it.

:::quiz
Why does Kubernetes use "desired state" instead of letting you issue direct commands like "start this container on server 2"?

**Answer:** Direct commands describe a one-time action, not an ongoing intention. If the server crashes or the container dies, nothing triggers a restart. Desired state lets Kubernetes continuously reconcile reality against your intent, without you having to watch.
:::

## Looking at Your Cluster

The simulated cluster you are working in already has Kubernetes running. You can see its nodes right now:

```bash
kubectl get nodes
```

You will see two entries: one node with the role `sim-control-plane`, and two worker nodes. The control plane is the brain of the cluster, the worker is where your application containers will actually run. You will go deeper into this architecture in a later lesson.

## Scheduling, Self-Healing, and Scaling

**Scheduling** is how Kubernetes decides which node runs which Pod. When you ask for a container, Kubernetes evaluates the available nodes, checks their resources, applies any constraints you defined, and picks the best fit. You do not point to a server, you describe what the container needs, and Kubernetes places it.

**Self-healing** is the direct result of the reconciliation loop. A container that exits unexpectedly is detected within seconds. Kubernetes restarts it on the same node, or reschedules it elsewhere if the node is gone. This is not magic, it is the reconciler noticing that actual state (0 replicas running) does not match desired state (3 replicas).

**Scaling** is adjusting the desired state. If you change "3 replicas" to "10 replicas", Kubernetes schedules 7 more Pods. If you scale back down, it terminates the excess ones gracefully. The cluster adapts to whatever you declare.


:::warning
Kubernetes manages infrastructure, not application correctness. If your container crashes because of a bug in your code, Kubernetes will restart it. It will keep restarting it. You will see it stuck in `CrashLoopBackOff` status. The orchestrator cannot fix what is broken inside the container, it can only try to keep it running.
:::

:::quiz
You declare a desired state of 5 replicas. While Kubernetes is scheduling them, a node goes down and takes 2 already-running replicas with it. Without any manual action, how many replicas will Kubernetes try to maintain?

- 3, because 2 replicas were lost and only 3 remain
- 5, because the desired state has not changed and Kubernetes will reconcile toward it
- 0, because a node failure puts the cluster in an error state

**Answer:** 5. The desired state you declared is still 5 replicas. Kubernetes detects that actual state (3 running) no longer matches it, and the reconciliation loop schedules 2 new replicas on the remaining healthy nodes. Nobody had to intervene.
:::

Kubernetes gives your team a shared operational foundation: scheduling, self-healing, and scaling, all driven by declarations rather than manual steps. The next lesson traces how the industry arrived at this model, from bare metal servers through virtual machines to containers, and why each transition created new problems that led to the next era.
