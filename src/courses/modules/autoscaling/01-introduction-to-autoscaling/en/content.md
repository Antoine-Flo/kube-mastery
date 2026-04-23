---
seoTitle: 'Kubernetes Autoscaling Overview, HPA VPA Cluster Autoscaler'
seoDescription: 'Learn the three Kubernetes autoscaling dimensions: HPA for pod count, VPA for pod resources, and Cluster Autoscaler for node count, and when to use each.'
---

# Introduction to Autoscaling

Traffic spikes. Workloads grow. Batch jobs complete. Manual scaling is reactive and slow. Kubernetes provides three distinct autoscaling mechanisms, each operating on a different dimension. Understanding which mechanism handles which dimension prevents the common mistake of using the wrong tool for a given problem.

## The three dimensions of autoscaling

@@@
graph TB
HPA["Horizontal Pod Autoscaler\nAdjusts replica count\nMore/fewer Pods"] --> LOAD["Traffic spike\nCPU/memory\nincreases"]
VPA["Vertical Pod Autoscaler\nAdjusts resource requests\nBigger/smaller Pods"] --> OOMK["Pod OOMKilled\nor throttled"]
CA["Cluster Autoscaler\nAdjusts node count\nMore/fewer nodes"] --> PEND["Pods stuck\nPending\n(no room)"]
@@@

**Horizontal Pod Autoscaler (HPA)**: scales the number of Pod replicas in a Deployment or ReplicaSet. Traffic increases, more Pods start. Traffic decreases, Pods are removed. The size of each Pod stays the same. This is the most commonly used autoscaler for web services.

**Vertical Pod Autoscaler (VPA)**: adjusts the resource requests and limits on individual Pods. A Pod that keeps getting OOMKilled has its memory limit increased. A Pod that is heavily throttled has its CPU limit increased. The number of replicas stays the same. VPA is useful for workloads that cannot be horizontally scaled (stateful services, singleton controllers).

**Cluster Autoscaler**: adds or removes nodes from the cluster. When Pods stay Pending because no node has enough capacity, the Cluster Autoscaler provisions a new node. When nodes are underutilized, it drains and terminates them. The Cluster Autoscaler works at the infrastructure level and is typically managed by cloud providers.

## How they work together

HPA and VPA address different failure modes:
- HPA helps when there are too many requests for the current replica count
- VPA helps when individual Pods are undersized for their actual workload

The Cluster Autoscaler operates at a different layer and enables both: when HPA wants to add replicas but the cluster has no free capacity, the Cluster Autoscaler adds a node.

:::warning
Running HPA and VPA together on the same Deployment is possible but requires care. VPA changes resource requests, which affects scheduling decisions. HPA scales replicas, which affects total resource consumption. If VPA increases per-Pod requests significantly, HPA may trigger scaling that the cluster cannot accommodate. For most production workloads, pick one: HPA for stateless services, VPA for stateful or singleton workloads.
:::

## Prerequisites

HPA and VPA both require the metrics server to be running in the cluster. The metrics server collects resource usage (CPU, memory) from nodes and Pods and exposes it through the Kubernetes Metrics API.

```bash
kubectl get pods -n kube-system | grep metrics-server
```

If metrics-server is running, you can query it:

```bash
kubectl top nodes
kubectl top pods
```

These commands show actual CPU and memory consumption. Without metrics-server, HPA cannot function: it has no data source for the metrics it watches.

:::quiz
A Deployment has an HPA targeting 50% CPU utilization. Traffic doubles. The HPA should add more Pods. But the new Pods stay Pending. Metrics-server is running. What is the most likely missing component?

**Answer:** The Cluster Autoscaler (or equivalent node provisioning). The HPA scaled the replica count correctly (more Pods desired), but the cluster has no free capacity to schedule them. The new Pods stay Pending until a new node is added. Without a Cluster Autoscaler, the operator must add nodes manually.
:::

:::quiz
A Pod repeatedly gets OOMKilled. You add an HPA targeting CPU utilization. Does this fix the OOM issue?

**Answer:** No. HPA adds more Pod replicas when CPU increases. OOMKilled is a memory limit issue. Adding more Pods does not increase the memory available to each Pod. The correct tool is VPA, which can increase the memory request and limit on the existing Pod(s). HPA and OOM issues are on different axes.
:::

The three autoscaling mechanisms are complementary. HPA handles replica count, VPA handles Pod sizing, and the Cluster Autoscaler handles node capacity. The next lesson covers HPA in detail.
