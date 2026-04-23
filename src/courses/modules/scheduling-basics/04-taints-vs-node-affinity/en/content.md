---
seoTitle: 'Kubernetes Taints vs Node Affinity, When to Use Each'
seoDescription: 'Learn the difference between taints/tolerations and node affinity in Kubernetes, when each mechanism is the right choice, and how to combine them for precise scheduling.'
---

# Taints vs Node Affinity

You have studied three node targeting mechanisms: taints/tolerations, `nodeSelector`, and `nodeAffinity`. They look similar from a distance but they work from opposite directions. Knowing which one to use is a CKA exam skill and a real operational judgment.

## The fundamental difference

@@@
graph LR
T["Taint on node\nNode repels Pods\nPod must opt in\nvia toleration"]
NA["Node affinity on Pod\nPod attracts itself\nto matching nodes\nIgnores non-matching nodes"]
T -->|"exclusive use"| GPU["GPU node:\nonly tolerated Pods get in"]
NA -->|"preferred placement"| ZONE["Zone nodes:\nPods prefer eu-west"]
@@@

**Taints/tolerations work from the node outward**: the node declares "you cannot run here unless you explicitly tolerate me." This is a restriction that applies to all Pods by default.

**Node affinity works from the Pod inward**: the Pod declares "I want to run on nodes with these properties." Nodes without matching labels are simply not considered. Other Pods without the affinity are free to schedule on those nodes.

## When to use taints

Use taints when you need to **dedicate a node** to specific workloads and keep everything else off:

- GPU nodes: no ordinary Pod should consume GPU capacity
- High-memory nodes for in-memory databases: prevent ordinary workloads from landing there and starving the database
- Control plane nodes: the `node-role.kubernetes.io/control-plane:NoSchedule` taint prevents user workloads from running on the control plane

The access model is: "this node is restricted, specific Pods are allowed through."

```bash
kubectl taint node sim-worker dedicated=gpu:NoSchedule
```

Now only Pods with the `dedicated=gpu:NoSchedule` toleration can run on `sim-worker`. Every other Pod is excluded without any configuration on its part.

## When to use node affinity

Use node affinity when you want to **attract** Pods to specific nodes without locking non-matching Pods out:

- Schedule an application in specific availability zones for data locality
- Prefer nodes with fast storage for latency-sensitive workloads
- Require a minimum CPU architecture for a compute-intensive Job

The access model is: "I want to run on these nodes, but others can also use those nodes."

```bash
kubectl label node sim-worker disk=ssd
```

A Pod with `nodeAffinity` for `disk=ssd` will schedule on `sim-worker`. Pods without affinity can also schedule there. Nothing is locked.

## The combination: dedicated + attracted

The most robust pattern for dedicated nodes uses both mechanisms together:

- A **taint** prevents ordinary workloads from landing on the special node
- A **node affinity** (required) ensures the special workload always goes to those nodes

```yaml
# On the special workload Pod
tolerations:
  - key: dedicated
    value: gpu
    operator: Equal
    effect: NoSchedule
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: dedicated
              operator: In
              values:
                - gpu
```

Without the toleration, the Pod cannot schedule on the tainted node. Without the node affinity, the Pod could schedule on non-tainted nodes. Both are needed when you want to guarantee that the special workload only runs on special nodes and those nodes only run this workload.

:::quiz
A cluster has GPU nodes with taint `gpu=true:NoSchedule` and label `gpu=true`. A GPU workload Pod has the toleration for the taint but no node affinity. Where can the Pod schedule?

**Answer:** Anywhere in the cluster. The toleration removes the repulsion from the GPU nodes, allowing the Pod to schedule there. But without a required node affinity, the scheduler can also place the Pod on non-GPU nodes (which have no taint to repel it). If you want the GPU workload to only run on GPU nodes, you need both the toleration (to get past the taint) and a required node affinity (to require the GPU label).
:::

## Quick decision guide

| Scenario | Use |
|---|---|
| Reserve a node for a specific workload | Taint + toleration |
| Prefer certain nodes without excluding others | Node affinity (preferred) |
| Require specific nodes, no fallback | Node affinity (required) |
| Both dedicate and attract | Taint + node affinity together |
| Simple exact label match | nodeSelector |

:::warning
Using only node affinity to target special nodes (without a taint) does not protect the special nodes from ordinary workloads. Other teams' Pods can still land on your "reserved" nodes unless a taint is also in place. In a shared cluster, always use taints to protect dedicated resources.
:::

```bash
kubectl taint node sim-worker dedicated=gpu:NoSchedule-
kubectl label node sim-worker disk-
```

:::quiz
You want batch Jobs to schedule only on batch-dedicated nodes, but also want to prevent regular application Pods from landing on those nodes. What is the minimal correct configuration?

**Answer:** Taint the batch nodes with `role=batch:NoSchedule`. Add a matching toleration to the Job Pod specs. Optionally add a required node affinity on the Jobs to ensure they always go to the batch nodes even if untainted nodes are available. Without the taint, the node is not protected from regular Pods.
:::

The combination of taints (to protect nodes) and affinity (to attract Pods) gives you precise control over workload placement. The next module covers advanced scheduling: manual scheduling, static Pods, priority classes, and multiple schedulers.
