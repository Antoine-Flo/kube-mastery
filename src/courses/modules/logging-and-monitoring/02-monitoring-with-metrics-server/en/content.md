---
seoTitle: Kubernetes Metrics Server, kubectl top, CPU, Memory, HPA
seoDescription: Understand how Metrics Server aggregates resource usage in Kubernetes, enabling kubectl top nodes, kubectl top pods, and the Horizontal Pod Autoscaler.
---

# Monitoring with Metrics Server

Your application is slow, but `kubectl get pods` shows everything as `Running`. No crashes, no errors in the logs. The Pod looks healthy on paper. What you are missing is the actual resource consumption: how much CPU and memory is each Pod using right now?

`kubectl get pods` only tells you the scheduling state. It has no information about live CPU or memory usage. To answer that question, Kubernetes relies on a separate component called Metrics Server.

## What Metrics Server Does

Think of Metrics Server as a lightweight data aggregator. Each node in your cluster runs a kubelet, and inside kubelet there is a subsystem called cAdvisor that continuously measures container resource usage. Metrics Server queries these endpoints every 15 seconds, aggregates the numbers, and exposes them through the standard Kubernetes API under `metrics.k8s.io`.

@@@
graph LR
    A[cAdvisor<br/>on each node] --> B[kubelet<br/>metrics endpoint]
    B --> C[Metrics Server]
    C --> D[metrics.k8s.io API]
    D --> E[kubectl top]
@@@

This design fits Kubernetes' API-first philosophy. Instead of building metrics into the core API server, the metrics surface is an extension. `kubectl top` is simply a client for that extension API.

:::info
In the simulator, Metrics Server is pre-installed. `kubectl top` returns realistic simulated metrics for all Pods and nodes in your session.
:::

## Checking Node and Pod Consumption

To see CPU and memory usage per node, run:

```bash
kubectl top nodes
```

The output shows the node name, current CPU usage in millicores, CPU percentage relative to allocatable capacity, current memory in mebibytes, and memory percentage. This is the live picture of how loaded your cluster is.

To see usage per Pod in the current namespace:

```bash
kubectl top pods
```

To look at Pods in a specific namespace:

```bash
kubectl top pods -n kube-system
```

This is useful for understanding how much the control plane components themselves consume, which becomes relevant when debugging cluster-level slowdowns.

:::quiz
You want to find which Pod in the `production` namespace is consuming the most memory. What command gives you that information sorted by memory?

**Try it:** `kubectl top pods -n production --sort-by=memory`

**Answer:** The `--sort-by=memory` flag sorts the output descending by memory consumption. Without it, the order is arbitrary and hard to scan when many Pods are running.
:::

## Consumption vs Limits: An Important Distinction

:::warning
`kubectl top` shows current consumption, not configured limits. A Pod consuming 180m CPU with a limit of 100m is actively being throttled by the container runtime, but `kubectl top` will show 180m and not warn you. To see the configured limits, run `kubectl describe pod <name>` and look at the Limits section, or use `kubectl get pod <name> -o yaml`.
:::

Why does Kubernetes separate consumption from limits like this? Because limits are part of the Pod spec, a static declaration, while consumption is a live measurement. Mixing them in the same view would conflate configuration with reality, making it harder to reason about both.

:::quiz
A Pod is running but your application is being throttled. `kubectl top pods` shows the Pod consuming 200m CPU. Where do you check what the CPU limit is?

- kubectl top pods --limits
- kubectl describe pod my-app, look at the Limits section
- kubectl logs my-app --cpu

**Answer:** `kubectl describe pod my-app` - the Limits section appears in the describe output under each container. `kubectl top` has no flag to show limits.
:::

## Metrics Server and the Horizontal Pod Autoscaler

Metrics Server is not just for humans. The Horizontal Pod Autoscaler (HPA) uses it as its data source. The HPA controller runs a loop: it reads current CPU or memory usage from the metrics API, compares it to the target threshold you configured, and adjusts the replica count of your Deployment accordingly.

@@@
graph LR
    A[Metrics Server] --> B[HPA Controller]
    B --> C{Usage > threshold?}
    C -- yes --> D[Scale up<br/>Deployment]
    C -- no --> E[Scale down or<br/>hold replicas]
@@@

If Metrics Server is not installed or not yet ready, the HPA cannot function. It will show a status of `unknown` for its metrics target, and it will not scale anything. This is one of the first things to check when an HPA is not working as expected.

:::warning
If `kubectl top nodes` returns `error: Metrics API not available`, Metrics Server is either not installed or still starting up. On a fresh cluster, Metrics Server can take a minute to start collecting data before the API becomes available.
:::

Metrics Server fills a precise gap: it gives you and the autoscaler a live view of resource consumption without the overhead of a full monitoring stack. For simple visibility into whether your cluster is healthy right now, `kubectl top` is the right tool. For trend analysis and alerting over time, you would reach for something like Prometheus.
