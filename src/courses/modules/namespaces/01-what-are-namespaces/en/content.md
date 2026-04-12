---
seoTitle: Kubernetes Namespaces, Isolation, Resource Scoping, kubectl
seoDescription: Understand how Kubernetes namespaces divide a cluster into isolated virtual spaces, the difference between namespaced and cluster-scoped resources.
---

# What Are Namespaces

Your company runs a single Kubernetes cluster. Two teams share it: the backend team and the frontend team. Both deploy a Service named `api`. Who wins? Without any organization, names collide, resources mix, and debugging becomes a nightmare. That is the problem namespaces solve.

@@@
graph TB
CLUSTER["Kubernetes Cluster"]
CLUSTER --> NS1["Namespace: frontend\nService: api\nDeployment: web"]
CLUSTER --> NS2["Namespace: backend\nService: api\nDeployment: api"]
CLUSTER --> NS3["Namespace: kube-system\nSystem Pods"]
@@@

A namespace is an isolated naming scope inside the cluster. Resources in one namespace do not conflict with resources of the same name in another namespace. Think of it like directories in a filesystem: `/frontend/api` and `/backend/api` can coexist without issue.

A cluster without namespaces is like an office with one shared desk. Everyone drops their files in the same spot. Namespaces are separate desks: each person has their own space, and objects with the same name no longer collide.

Start by listing the namespaces the simulated cluster already has:

```bash
kubectl get namespaces
```

:::quiz How many namespaces does the simulated cluster have by default?
**Try it:** `kubectl get namespaces`
**Answer:** The simulated cluster has four default namespaces: `default`, `kube-system`, `kube-public`, and `kube-node-lease`. The next lesson explains the role of each one.
:::

## Creating a Namespace

The fastest way to create a namespace is with `kubectl create namespace`:

```bash
kubectl create namespace staging
```

You can also use a manifest, which is the preferred approach when you want to track the namespace definition in version control. Open a new file:

```bash
nano staging-ns.yaml
```

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: staging
```

```bash
kubectl apply -f staging-ns.yaml
```

Both approaches produce the same result. The manifest approach lets you add labels and annotations to the namespace itself, which becomes useful for RBAC and tooling later.

## Placing Resources in a Namespace

Every `kubectl` command that creates or queries resources accepts a `-n` flag to target a specific namespace. Deploy a workload into the `staging` namespace you just created:

```bash
kubectl create deployment web --image=nginx:1.28 -n staging
kubectl get pods -n staging
```

Without `-n staging`, the Deployment would land in `default`. Without `-n staging` on the `get`, you would not see the Pod even though it exists.

:::warning
If you forget the `-n` flag when creating a resource, it silently lands in `default`. If you then search for it with `-n staging`, it appears missing. This is one of the most common sources of confusion when working with namespaces. Always double-check which namespace a resource was created in.
:::

:::quiz Why can two Services named `api` exist in the same cluster without conflict?
**Answer:** Because they live in different namespaces. A namespace is an isolated naming scope: `frontend/api` and `backend/api` are distinct resources. Within the same namespace, names must still be unique.
:::

## Namespaces Are Logical, Not Network Boundaries

Why do namespaces not isolate network traffic? Because they are a naming and access-control mechanism, not a firewall. A Pod in the `frontend` namespace can by default reach a Pod in the `backend` namespace if it knows its address or DNS name. Namespaces keep names and permissions separate; they do not block traffic.

To isolate network traffic between namespaces, you need NetworkPolicies, which are covered in a dedicated module later in the course.

## Cleaning Up

Deleting a namespace deletes everything inside it. That makes cleanup straightforward, but also means a mistaken `kubectl delete namespace` is destructive:

```bash
kubectl delete namespace staging
```

:::quiz Which kubectl flag is used to target a specific namespace?

- `--namespace-selector`
- `-n`
- `--context`
- `--scope`
  **Answer:** `-n` (or `--namespace`). It applies to `get`, `create`, `apply`, `delete`, `describe`, and most other kubectl commands.
  :::

Namespaces give your cluster a clear organizational structure. Now that you know how to create them and place resources inside them, the next lesson walks through the four namespaces that already exist in every Kubernetes cluster and explains what each one is for.
