---
seoTitle: 'Kubernetes Namespaces and Labels, Resource Organization, Selectors'
seoDescription: 'Learn how Kubernetes Namespaces isolate resources between teams and environments, and how Labels enable flexible grouping and selection across any resource type.'
---

# Namespaces and Labels

Imagine two teams sharing one Kubernetes cluster: the payments team and the catalog team. Both are running web servers, databases, and background workers. Without any organization, every Pod, Service, and Deployment lives in the same flat list. You cannot tell which resources belong to which team, and a typo in a delete command could affect either workload.

Kubernetes provides two complementary mechanisms to deal with this: **Namespaces** for hard boundaries and **Labels** for flexible grouping.

## Namespaces

A Namespace is a virtual partition inside a cluster. Resources in one Namespace are invisible to `kubectl` commands scoped to another Namespace by default. Names only need to be unique within a Namespace, so the payments team can run a Service named `web` and so can the catalog team.

@@@
graph TB
    subgraph default["Namespace: default"]
        PA["payments: web"]
        PB["payments: api"]
    end
    subgraph catalog["Namespace: catalog"]
        CA["catalog: web"]
        CB["catalog: api"]
    end
    subgraph ks["Namespace: kube-system"]
        DNS["coredns"]
        PROXY["kube-proxy"]
    end
@@@

List the Namespaces that already exist in your cluster:

```bash
kubectl get namespaces
```

You will see at least three: `default` is where your resources land when you do not specify a Namespace. `kube-system` holds control plane components like CoreDNS and kube-proxy. `kube-public` contains a single ConfigMap with basic cluster info, readable without authentication.

Create a new Namespace:

```bash
kubectl create namespace staging
```

Now scope any `kubectl` command to that Namespace with `-n`:

```bash
kubectl get pods -n kube-system
kubectl get pods -n staging
```

:::quiz
You delete all Pods in the `default` namespace. What happens to the Pods in `kube-system`?

**Answer:** Nothing. Namespaces provide hard isolation for `kubectl` commands. Deleting resources in one Namespace does not affect any other Namespace. The kube-system Pods keep running.
:::

:::warning
Not everything in Kubernetes is Namespace-scoped. Nodes, PersistentVolumes, StorageClasses, and Namespaces themselves are **cluster-scoped** resources. They exist outside any Namespace. Running `kubectl get nodes -n staging` will not show you different nodes; it will show the same nodes regardless of Namespace because nodes are cluster-wide.
:::

You can check whether a resource type is Namespace-scoped or not:

```bash
kubectl api-resources --namespaced=true
kubectl api-resources --namespaced=false
```

## Labels

Labels are key-value pairs attached to any Kubernetes resource. Unlike Namespaces, they impose no boundary and do not restrict visibility. They are simply metadata that you and Kubernetes use to group and select resources.

A label looks like this: `app: web`, `env: production`, `tier: frontend`. You can put any labels you want on any resource. The only constraint is that label keys and values must be strings.

Add a label to a running Pod:

```bash
kubectl label pod <POD-NAME> env=staging
```

List all Pods with a specific label:

```bash
kubectl get pods -l env=staging
```

List Pods with multiple labels (both must match):

```bash
kubectl get pods -l app=web,env=staging
```

Labels work on every resource type:

```bash
kubectl get nodes -l kubernetes.io/role=worker
kubectl get namespaces -l team=payments
```

:::quiz
You have 20 Pods running across three teams. You want to list only the Pods that belong to the payments team and are in the production environment. How do you filter them?

**Try it:** `kubectl get pods -l team=payments,env=production`

**Answer:** The `-l` flag accepts a comma-separated list of label selectors. Only Pods that match all labels simultaneously are returned. This is a logical AND, not OR.
:::

## Why Labels Matter Beyond Filtering

Labels are not just for your own use. Kubernetes itself uses them internally through **label selectors** to link resources together.

When a Deployment creates Pods, it uses a label selector to identify which Pods it owns. When a Service routes traffic, it uses a label selector to find its target Pods. If the labels on a Pod do not match what the selector expects, the Service will not send it any traffic, and the Deployment will not count it as one of its replicas.

This is why the same label pattern appears in three places in a Deployment manifest: `spec.selector.matchLabels`, `spec.template.metadata.labels`, and often in a paired Service. All three must be consistent.

:::quiz
A Pod is running and healthy, but a Service is sending zero traffic to it. The Pod and Service are in the same Namespace. What is the most likely cause?

- The Service is in the wrong Namespace
- The Pod labels do not match the Service selector
- The Pod has no ports defined

**Answer:** The Pod labels do not match the Service selector. A Service finds its backends by label, not by name or position. If the labels differ by even one character, the Service has no endpoints and traffic goes nowhere.
:::

Clean up the namespace you created:

```bash
kubectl delete namespace staging
```

Deleting a Namespace deletes everything inside it. Use this with care in production.

Namespaces draw hard lines between teams and environments, while Labels create soft, flexible connections between resources. Together they give you the vocabulary to organize any cluster, from a personal sandbox to a shared platform running dozens of services. In the next lesson, you will create your first Pod and observe its full lifecycle from creation to deletion.
