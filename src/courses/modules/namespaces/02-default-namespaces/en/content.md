---
seoTitle: Kubernetes Built-In Namespaces, default, kube-system, Lease
seoDescription: Explore the four built-in Kubernetes namespaces, default, kube-system, kube-public, and kube-node-lease, and learn what each one contains and why.
---

# The Default Namespaces

You run `kubectl get namespaces` on a freshly created cluster and you see four namespaces you never created. Each one has a specific purpose. This lesson explains what they are for and why you should never delete or modify their contents.

Start by running the command now:

```
kubectl get namespaces
```

@@@
graph TD
    DEF["default\nWhere resources land\nwithout an explicit -n"]
    SYS["kube-system\nCluster components\napiserver, scheduler, ..."]
    PUB["kube-public\nReadable without auth\ncluster-info configmap"]
    LEASE["kube-node-lease\nLease objects for\nnode heartbeats"]
@@@

## The `default` Namespace

`default` is the namespace used when you do not specify `-n` in your commands. Every resource created without an explicit namespace lands here silently. In a personal learning environment, deploying to `default` is perfectly fine. On a shared or production cluster, a good practice is to always use named namespaces and avoid `default` entirely, because it becomes a dumping ground for forgotten resources.

Try creating a Pod in the current namespace without specifying one, and observe where it ends up:

```
kubectl run test-pod --image=nginx:1.28
kubectl get pods
```

The Pod appears in `default` because no `-n` flag was given.

:::quiz You create a Deployment without specifying a namespace. Where does it land?
- In `kube-system`, the default namespace for workloads
- In `default`, the namespace used when `-n` is omitted
- Kubernetes requires you to specify a namespace before creating any resource
**Answer:** In `default`. `kube-system` is reserved for cluster components. Kubernetes does not require an explicit namespace; it uses `default` silently.
:::

## The `kube-system` Namespace

This is where the cluster's own components run. Inspect those Pods now:

```
kubectl get pods -n kube-system
```

You will see Pods like `kube-apiserver`, `etcd`, `kube-scheduler`, `kube-controller-manager`, `kube-proxy`, and `coredns`. These are the control plane and node components you studied in the kubernetes-basics module. They run as Pods inside `kube-system` on managed clusters so Kubernetes can manage their lifecycle like any other workload.

:::warning
Never delete or modify resources in `kube-system`. These Pods are critical cluster components. Removing them can make the cluster unusable. On production clusters, access to `kube-system` is typically restricted by RBAC so that only cluster administrators can touch it.
:::

## The `kube-public` Namespace

`kube-public` is readable by all users, even unauthenticated ones. It typically contains a ConfigMap called `cluster-info` that exposes basic cluster metadata. Some bootstrap tools use this ConfigMap to discover how to connect to the cluster.

```
kubectl get configmaps -n kube-public
```

In most clusters, `kube-public` is nearly empty. It exists to provide a standard location for public cluster information, but it is rarely used beyond the initial bootstrap.

:::quiz What makes `kube-public` different from other namespaces?
**Answer:** Its resources are readable without authentication, even by unauthenticated users. This is intentional: it gives bootstrap tools and new nodes a place to discover cluster connection information before they have credentials.
:::

## The `kube-node-lease` Namespace

This namespace contains `Lease` objects, one per node. Why does that matter? The kubelet on each node updates its Lease object regularly to signal that the node is still alive. The controller manager watches these Leases to detect failing nodes.

```
kubectl get leases -n kube-node-lease
```

Why was `kube-node-lease` created as a separate namespace instead of putting Leases in `kube-system`? Because Lease objects are updated very frequently, every few seconds by every kubelet. Putting them in their own namespace reduces noise in `kube-system` and allows different retention or access policies to apply to Lease objects without affecting other system components.

:::quiz Why does `kube-node-lease` exist as a separate namespace and not part of `kube-system`?
**Answer:** Lease objects are updated every few seconds by each kubelet. Isolating them in their own namespace reduces write traffic noise in `kube-system` and allows different access policies to be applied to lease objects independently.
:::

## Cleanup

Remove the test Pod you created earlier:

```
kubectl delete pod test-pod
```

The four built-in namespaces each have a clear role: `default` catches unscoped resources, `kube-system` runs the cluster itself, `kube-public` exposes public metadata, and `kube-node-lease` tracks node health. The next lesson shows you how to navigate between namespaces and query resources across all of them at once.
