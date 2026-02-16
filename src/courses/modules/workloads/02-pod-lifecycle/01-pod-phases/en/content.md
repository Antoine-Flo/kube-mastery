# Pod Phases

Every Pod in Kubernetes goes through a lifecycle, and at any moment, it sits in one of five **phases**. Think of these phases like the status board at an airport: a flight can be *Boarding*, *In Air*, *Landed*, or *Cancelled* — you get a quick snapshot without knowing every detail about every passenger. Pod phases work the same way. They give you a high-level answer to the question: **"Where is this Pod in its journey?"**

In this lesson, you will learn to recognize each phase, understand what triggers transitions between them, and know which tools to reach for when a Pod is stuck.

## The Five Phases

A Pod's phase is stored in `status.phase`. Here are the five possible values:

| Phase | What it means |
|---|---|
| **Pending** | The cluster accepted the Pod, but it is not running yet. Kubernetes is scheduling it to a node, pulling container images, or waiting for resources to free up. |
| **Running** | The Pod is bound to a node and at least one container is running (or starting/restarting). |
| **Succeeded** | Every container in the Pod terminated with exit code 0 and will not be restarted. This is the happy ending for batch workloads like Jobs. |
| **Failed** | Every container has terminated, and at least one exited with a non-zero code. Something went wrong. |
| **Unknown** | Kubernetes cannot determine the Pod's state — usually because the node stopped reporting back. |

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Running : Scheduled & containers start
    Running --> Succeeded : All containers exit 0
    Running --> Failed : A container exits non-zero
    Pending --> Failed : Unresolvable error
    Running --> Unknown : Node communication lost
    Unknown --> Running : Communication restored
    Succeeded --> [*]
    Failed --> [*]
```

:::info
Phase is deliberately simple. It will not tell you *which* container is having trouble or *why* a readiness probe is failing. For that level of detail, you need **container states** and **Pod conditions**, which we cover in the next lessons.
:::

## Walking Through the Phases

Let's follow a Pod from birth to completion.

**1 — Pending.** You apply a manifest. The API server persists the Pod object and the scheduler starts looking for a suitable node. During this time the Pod is *Pending*. Image pulls, Secret mounts, and resource constraints all keep a Pod in this phase until everything is ready.

**2 — Running.** The kubelet on the chosen node creates the containers. As soon as at least one container process is alive, the phase flips to *Running*. Important nuance: *Running* does not mean "ready to serve traffic." A container can be running but still failing its readiness probe — which is why phase alone is never the full picture.

**3 — Succeeded or Failed.** When all containers have stopped, Kubernetes looks at exit codes. If every container returned 0, the phase is *Succeeded*. If any returned non-zero, it is *Failed*. These are **terminal** phases — the Pod will not transition out of them.

**4 — Unknown.** If the kubelet on the node stops communicating with the control plane (network partition, node crash, kubelet down), the phase becomes *Unknown*. Once communication is restored, the phase updates to reflect reality.

## Observing Phases in Practice

The quickest way to see Pod phases is with `kubectl get pods`:

```bash
kubectl get pods -o wide
```

The `STATUS` column shows the phase (or a more specific reason like `CrashLoopBackOff`). To dig deeper into *why* a Pod is in a particular phase, use `describe`:

```bash
kubectl describe pod <pod-name>
```

The **Events** section at the bottom is especially valuable — it tells the story of what happened in chronological order: scheduling decisions, image pulls, probe failures, and more.

### A quick experiment

Apply this minimal Pod and watch it progress from Pending to Running:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: phase-demo
spec:
  containers:
    - name: nginx
      image: nginx
```

```bash
kubectl apply -f phase-demo.yaml
kubectl get pod phase-demo -w
```

The `-w` flag streams updates in real time. You should see the status move from `Pending` → `ContainerCreating` → `Running` within a few seconds on a healthy cluster.

## Troubleshooting by Phase

When something goes wrong, the phase is your first breadcrumb:

- **Stuck in Pending** — The scheduler cannot place the Pod. Check resource requests (`kubectl describe pod`), node taints and tolerations, and node capacity (`kubectl describe node`).
- **Running but not Ready** — The Pod is alive but not serving traffic. This usually points to a failing readiness probe. We will cover probes in a dedicated module, but `kubectl describe pod` will show the probe status right away.
- **Failed** — Inspect container logs with `kubectl logs <pod-name>` and look at the exit code in `kubectl describe pod`. A non-zero exit code is your starting point for root-cause analysis.
- **Unknown** — Focus on the node, not the Pod. Check `kubectl get nodes` and `kubectl describe node <node-name>`. Network issues and kubelet crashes are the usual suspects.

:::warning
**Succeeded** and **Failed** are terminal states. Once a Pod reaches either, it will not restart on its own. Workload controllers like Deployments and Jobs are responsible for creating *new* Pods when needed — the old Pod object remains for inspection until it is garbage-collected.
:::

## Wrapping Up

Pod phases give you a fast, at-a-glance picture of where a Pod stands in its lifecycle. Five values — **Pending**, **Running**, **Succeeded**, **Failed**, and **Unknown** — cover every possibility. They are intentionally broad: think of them as the chapter titles of a Pod's story, not the full text. To read the full story, you need the finer-grained tools we explore next: **container states** (what each individual container is doing) and **Pod conditions** (whether specific health checks have passed). With phase as your starting compass, you will always know which direction to investigate.
