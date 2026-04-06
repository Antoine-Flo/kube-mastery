---
seoTitle: Kubernetes Metrics Server, kubectl top, CPU, Memory, HPA
seoDescription: Understand how Metrics Server aggregates resource usage in Kubernetes, enabling kubectl top nodes, kubectl top pods, and the Horizontal Pod Autoscaler.
---

# Monitoring with Metrics Server

Logs tell you what happened. Metrics tell you how much, CPU usage, memory consumption, whether you're trending toward a resource limit. Kubernetes provides `kubectl top` for this, but it requires an add-on called **Metrics Server** to be installed in your cluster. This lesson covers what Metrics Server is, how to install it, and how to use `kubectl top` effectively.

## Why `kubectl top` Needs Metrics Server

Kubernetes doesn't continuously measure CPU and memory usage at the API level, that would require the API server to poll every node and container, which would be expensive and complex. Instead, the kubelet on each node already collects resource metrics for every container it manages (it needs this information internally for enforcing resource limits). What Metrics Server does is aggregate those per-node metrics from every kubelet and expose them through the **Resource Metrics API** (`metrics.k8s.io`).

`kubectl top` then simply queries this API, just like it queries the standard API server for Pod information. Without Metrics Server, the `metrics.k8s.io` endpoint doesn't exist, and `kubectl top` returns an error like `error: Metrics API not available`.

## Installing Metrics Server

Installing Metrics Server is typically a single command:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

This deploys a Metrics Server Pod in the `kube-system` namespace. On most managed Kubernetes services (GKE, EKS, AKS), Metrics Server is already installed and you don't need to do this manually.

:::info
On some local or development clusters (like kind or kubeadm-based setups), the Metrics Server may fail to start because it cannot validate the TLS certificates of the kubelets. In that case, you'll need to add `--kubelet-insecure-tls` to the Metrics Server deployment arguments. This is acceptable for development but should not be used in production.
:::

After installing, wait about 60 seconds for the Metrics Server to collect its first round of data from all nodes. Running `kubectl top` immediately after installation may still return an error while the server is initializing.

## The Data Flow

@@@
flowchart LR
    A["kubelet<br/>(Node 1)"] -->|"resource metrics<br/>/metrics/resource"| C[Metrics Server]
    B["kubelet<br/>(Node 2)"] -->|"resource metrics<br/>/metrics/resource"| C
    C -->|"aggregates and exposes<br/>metrics.k8s.io API"| D[Kubernetes<br/>API Server]
    D --> E["kubectl top<br/>nodes / pods"]
    D --> F[Horizontal Pod<br/>Autoscaler HPA]
@@@

The kubelet on each node exposes a `/metrics/resource` endpoint. Metrics Server scrapes these endpoints every 60 seconds by default, aggregates the data, and makes it available via the standard Kubernetes API. This data is held entirely in memory, Metrics Server does not write to any database or disk. If the Metrics Server Pod is restarted, the metrics history resets.

## `kubectl top nodes`

The most basic use case is checking the resource usage of your nodes:

```bash
kubectl top nodes
```

Expected output:

```
NAME           CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
node-1         312m         15%    2048Mi          64%
node-2         187m         9%     1536Mi          48%
control-plane  428m         21%    3072Mi          96%
```

Each column tells you something useful:

- **CPU(cores)**: The actual CPU usage in millicores. `1000m` equals one full CPU core. `312m` means about 31% of one core.
- **CPU%**: CPU usage as a percentage of the node's total CPU capacity.
- **MEMORY(bytes)**: The actual memory in use, shown in mebibytes (Mi) or gibibytes (Gi).
- **MEMORY%**: Memory usage as a percentage of the node's total allocatable memory.

Notice the `control-plane` node in the example above, it's at 96% memory, which would be cause for concern in a real cluster.

## `kubectl top pods`

To see resource usage by Pod:

```bash
kubectl top pods
```

Expected output:

```
NAME                          CPU(cores)   MEMORY(bytes)
frontend-7d9b4f8bc-xk2pl      5m           32Mi
backend-api-5d9c77f7b-9vqtz   48m          256Mi
postgres-0                    23m          512Mi
redis-6c5f9b7d4-p8qlm         3m           64Mi
```

By default this shows Pods in your current namespace. Add `-A` or `--all-namespaces` to see all Pods cluster-wide:

```bash
kubectl top pods -A
```

To show Pod metrics in a specific namespace:

```bash
kubectl top pods -n kube-system
```

## Finding Resource Hogs

One of the most practical uses of `kubectl top pods` is quickly identifying which Pods are consuming the most resources. The `--sort-by` flag makes this easy:

```bash
kubectl top pods --sort-by=memory
```

```bash
kubectl top pods --sort-by=cpu
```

This sorts by memory or CPU in descending order. The hungriest Pods appear at the top. This is invaluable when a node is under pressure and you need to find out what's eating all the resources.

:::info
`kubectl top pods` shows the _sum_ of all containers within a Pod. To see individual container metrics within a Pod, use the `--containers` flag: `kubectl top pods --containers`. This adds a CONTAINER column showing each container's separate usage.
:::

## Metrics Server vs Prometheus: Understanding the Trade-Offs

Metrics Server is deliberately lightweight. It stores only the most recent metrics snapshot in memory, which means:

- You can't query historical data ("what was my CPU usage at 3 AM last Tuesday?")
- You can't define alerts based on metrics thresholds
- There are no graphs or dashboards

For these capabilities you need a full metrics pipeline. **Prometheus** is the de facto standard in the Kubernetes ecosystem. It scrapes metrics from all components, stores them in a time-series database, and supports a rich query language (PromQL) for building dashboards in Grafana and firing alerts via Alertmanager.

The two tools are complementary, not competing. Many clusters run both: Metrics Server for `kubectl top` and HPA, and Prometheus for historical analysis, dashboards, and alerting.

## The Horizontal Pod Autoscaler Connection

One of the most important consumers of Metrics Server data is the **Horizontal Pod Autoscaler (HPA)**. The HPA watches a Deployment (or other scalable resource) and automatically increases or decreases the replica count based on observed CPU or memory usage. It queries the `metrics.k8s.io` API every 15 seconds to check current usage against your target thresholds.

Without Metrics Server, HPA cannot function. If you apply an HPA object to a cluster that doesn't have Metrics Server installed, the HPA will report an error condition and will not scale your Deployments.

:::warning
If you're planning to use HPA, make sure Metrics Server is installed and healthy before creating HPA objects. A simple check: `kubectl top nodes` should return data, not an error.
:::

## Hands-On Practice

**Step 1: Verify Metrics Server is running**

```bash
kubectl get pods -n kube-system
```

Locate a Pod whose name contains `metrics-server`. Expected shape:

```
metrics-server-6d94bc8694-xkl9v   1/1     Running   0          5m
```

If it's not running, install it:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

**Step 2: Check node resource usage**

```bash
kubectl top nodes
```

Expected output:

```
NAME           CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
controlplane   212m         10%    1024Mi          32%
```

**Step 3: Deploy a workload and check Pod metrics**

```bash
kubectl create deployment stress-test --image=nginx --replicas=2
kubectl wait --for=condition=Available deployment/stress-test --timeout=60s
kubectl top pods
```

Expected output:

```
NAME                           CPU(cores)   MEMORY(bytes)
stress-test-79d4b8c4f5-4hkpl   1m           4Mi
stress-test-79d4b8c4f5-xzqw9   1m           4Mi
```

**Step 4: Sort by memory**

```bash
kubectl top pods -A --sort-by=memory
```

This shows all Pods across all namespaces, sorted by memory usage (highest first).

**Step 5: View per-container metrics**

```bash
kubectl top pods --containers
```

Expected output:

```
POD                            NAME         CPU(cores)   MEMORY(bytes)
stress-test-79d4b8c4f5-4hkpl   nginx        1m           4Mi
stress-test-79d4b8c4f5-xzqw9   nginx        1m           4Mi
```

**Step 6: Check kube-system Pods**

```bash
kubectl top pods -n kube-system
```

This shows the resource consumption of your cluster's own control plane components. You'll see the Metrics Server itself, CoreDNS, and any other system add-ons your cluster runs.

**Step 7: Clean up**

```bash
kubectl delete deployment stress-test
```
