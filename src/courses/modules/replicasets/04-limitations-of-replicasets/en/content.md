---
seoTitle: 'Kubernetes ReplicaSet Limitations and Why Deployments Exist'
seoDescription: 'Learn why updating a Kubernetes ReplicaSet does not restart Pods and how Deployments solve rolling updates, rollback, and zero-downtime deploys.'
---

# Limitations of ReplicaSets, Why Deployments Exist

ReplicaSets are powerful: they guarantee replica counts, self-heal, and scale with a single command through a clean, label-based mechanism. So what's the catch? Why does virtually every production Kubernetes guide tell you to "use Deployments, not ReplicaSets directly"?

The answer comes down to one question: what happens when you need to update your application?

## The Update Problem

:::warning
Updating a ReplicaSet's Pod template **does not restart existing Pods**. Running Pods keep their old image until they are replaced for some other reason, leaving you with a mixed-version fleet, indefinitely.
:::

Imagine you're running `nginx:1.28` across three replicas and you need to upgrade to `nginx:1.26`. You edit the ReplicaSet manifest, change the image tag, and apply it:

```bash
kubectl apply -f web-rs.yaml
```

The ReplicaSet's Pod template is now updated in the API server. But nothing else happens. The three existing Pods are still running `nginx:1.28`. The ReplicaSet counts three Pods matching its selector and concludes: "Desired is 3, actual is 3, nothing to do." It doesn't know, and doesn't care, that those Pods were created from an older template.

ReplicaSets are blind to the contents of their Pods. The ReplicaSet's scope is quantity, not quality. The new template only takes effect when the ReplicaSet needs to create a _new_ Pod, for example if one crashes. That replacement gets `nginx:1.26`; the other two keep running `nginx:1.28`. Your fleet is now mixed-version, indefinitely.

## The Manual Workaround, and Its Costs

To actually update all Pods with a plain ReplicaSet, you'd have to do one of the following:

**Option A: Scale to zero and back up.** Scale the ReplicaSet to 0 replicas, wait for all Pods to terminate, then scale back to 3. The new Pods will be created from the updated template. This works, but it means a complete service outage during the transition.

**Option B: Delete Pods one at a time.** Delete each Pod individually. The ReplicaSet creates a replacement using the updated template. If you're careful and patient, you can roll through all three Pods without a complete outage, but you'd always have some capacity loss (one Pod terminating while its replacement starts up). There's no coordination, no traffic draining, and no automatic rollback if something goes wrong.

Neither option is safe, repeatable, or automatable. There's also no concept of **rollback** in a ReplicaSet. If your new image is broken, you'd have to manually edit the manifest again and go through the same process in reverse.

## Enter the Deployment

A Deployment doesn't manage Pods directly, it manages ReplicaSets. When you update a Deployment's Pod template, here's what happens:

1. The Deployment controller creates a brand-new ReplicaSet with the updated Pod template.
2. It gradually scales the new ReplicaSet up (creating new Pods with the new image) while simultaneously scaling the old ReplicaSet down (terminating old Pods).
3. It monitors the rollout, checking that new Pods become Ready before proceeding, and pauses or rolls back automatically if something goes wrong.
4. The old ReplicaSet is kept around (scaled to zero) so that a rollback to the previous version is instant: just scale the old RS back up and scale the new one down.

This is a **rolling update**: zero-downtime upgrades with built-in rollback, out of the box.

@@@
graph TB
    DEP["Deployment<br/>web-deployment"]

    subgraph "Before Update"
        RS1_before["ReplicaSet v1<br/>nginx:1.28<br/>replicas: 3"]
        P1["Pod nginx:1.28"]
        P2["Pod nginx:1.28"]
        P3["Pod nginx:1.28"]
        RS1_before --> P1 & P2 & P3
    end

    subgraph "During Rolling Update"
        RS1_mid["ReplicaSet v1<br/>nginx:1.28<br/>replicas: 1 ↓"]
        RS2_mid["ReplicaSet v2<br/>nginx:1.26<br/>replicas: 2 ↑"]
        RS1_mid --> PA["Pod nginx:1.28"]
        RS2_mid --> PB["Pod nginx:1.26"] & PC["Pod nginx:1.26"]
    end

    subgraph "After Update"
        RS1_after["ReplicaSet v1<br/>nginx:1.28<br/>replicas: 0 (kept for rollback)"]
        RS2_after["ReplicaSet v2<br/>nginx:1.26<br/>replicas: 3"]
        RS2_after --> PD["Pod nginx:1.26"] & PE["Pod nginx:1.26"] & PF["Pod nginx:1.26"]
    end

    DEP --> RS1_before
    DEP -.->|"image update"| RS1_mid
    DEP -.->|"image update"| RS2_mid
    DEP -.->|"complete"| RS1_after
    DEP -.->|"complete"| RS2_after
@@@

You interact with the Deployment; you never need to touch the individual ReplicaSets it creates.

## The Full Hierarchy: Deployment → ReplicaSet → Pods

This three-tier hierarchy is how Kubernetes workloads operate in production:

- **Deployment** holds your intent: desired version, replica count, rollout strategy. Stores the history of every change and knows how to move between them.
- **ReplicaSet** implements the counting guarantee: at this moment, there must be exactly N Pods matching this selector. It doesn't think about versions or history.
- **Pods** where your containers actually run.

When you run `kubectl get rs` in a namespace where Deployments are in use, you'll see ReplicaSets with auto-generated names like `web-deployment-6d4f9b7c8`. Each one represents one version of the Deployment's Pod template, the currently-active one has a non-zero replica count; older ones are scaled to zero but retained for rollback.

:::info
If you inspect a Deployment-managed ReplicaSet with `kubectl describe rs <name>`, you'll see in its `ownerReferences` that it's owned by a Deployment. The Pods have `ownerReferences` pointing to the ReplicaSet. This is how Kubernetes tracks ownership and cascading garbage collection.
:::

## When Would You Use a ReplicaSet Directly?

Rarely. There are a few legitimate edge cases:

**Custom orchestration**: If you're building a higher-level controller that manages Pod lifecycle in a completely custom way and needs the basic counting guarantee without rolling-update semantics, you might use a ReplicaSet as a primitive.

**Stateful scenarios with very specific Pod lifecycle needs**: Some advanced operators manage ReplicaSets directly when they need fine-grained control over exactly which Pods are created and destroyed and when, control that a Deployment's rollout strategy would interfere with. StatefulSets are usually the better answer for stateful workloads, but occasionally a bare ReplicaSet is used.

**Learning and exploration**: Understanding ReplicaSets directly is essential for understanding how Deployments work. When something goes wrong with a rollout, you'll often debug it by inspecting the underlying ReplicaSets.

In every other case, and that's essentially all production workloads, use a Deployment.
