---
seoTitle: 'Kubernetes ClusterRoles and ClusterRoleBindings, Cluster-Wide RBAC'
seoDescription: 'Learn when and how to use ClusterRoles and ClusterRoleBindings in Kubernetes for cross-namespace and cluster-scoped resource access, including built-in roles.'
---

# ClusterRoles and ClusterRoleBindings

A monitoring agent needs to list Pods across all namespaces. A Role would not work: Roles are namespaced, so a Role in `monitoring` can only grant access to resources in `monitoring`. To read Pods everywhere, you need a **ClusterRole**.

Start by examining what Kubernetes ships with. In your simulated cluster:

```bash
kubectl get clusterroles | grep -v system
```

You will see a short list of built-in ClusterRoles that Kubernetes creates automatically. Inspect one of them:

```bash
kubectl describe clusterrole view
```

The `view` ClusterRole grants read-only access to most resources across any namespace. `edit` adds write access. `admin` adds the ability to manage RBAC objects within a namespace. `cluster-admin` grants unrestricted access to everything in the cluster.

## ClusterRole vs Role

@@@
graph TB
    ROLE["Role\n(namespaced)"] --> NS_ONLY["Grants access\nin one namespace only"]
    CROLE["ClusterRole\n(cluster-scoped)"] --> ALL_NS["Grants access\nacross all namespaces"]
    CROLE --> CLUST_RES["Grants access to\ncluster-scoped resources\n(Nodes, PersistentVolumes, Namespaces)"]
@@@

A ClusterRole is not tied to any namespace. Its rules can apply to resources in every namespace, and they can also apply to resources that have no namespace at all: Nodes, PersistentVolumes, StorageClasses, and Namespaces themselves are cluster-scoped and can only be granted through a ClusterRole.

The shape of a ClusterRole manifest is nearly identical to a Role. The `namespace` field is absent, and the `kind` is `ClusterRole`:

```bash
nano monitor-clusterrole.yaml
```

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-lister
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
```

```bash
kubectl apply -f monitor-clusterrole.yaml
```

```bash
kubectl get clusterroles | grep pod-lister
```

:::quiz
Which of the following requires a ClusterRole rather than a Role?

- Allowing a subject to list Pods in the `default` namespace
- Allowing a subject to list Nodes across the cluster
- Allowing a subject to create ConfigMaps in the `dev` namespace

**Answer:** Listing Nodes requires a ClusterRole. Nodes are a cluster-scoped resource with no namespace. A Role cannot reference them because Roles only operate within a namespace context. The other two options can use a namespaced Role.
:::

## ClusterRoleBinding

A ClusterRoleBinding binds a ClusterRole to a subject with cluster-wide scope. The subject receives the ClusterRole's permissions in every namespace, plus any cluster-scoped resources.

```bash
nano monitor-crb.yaml
```

Note that `subjects` still requires a `namespace` for ServiceAccount entries, because a ServiceAccount is a namespaced object even if the binding is cluster-wide:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-pod-lister
subjects:
  - kind: ServiceAccount
    name: monitoring-agent
    namespace: monitoring
roleRef:
  kind: ClusterRole
  name: pod-lister
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl apply -f monitor-crb.yaml
```

```bash
kubectl get clusterrolebindings | grep monitoring
```

The ServiceAccount `monitoring-agent` in the `monitoring` namespace can now `get`, `list`, and `watch` Pods in any namespace in the cluster.

:::warning
**Never bind `cluster-admin` to an application ServiceAccount.** The built-in `cluster-admin` ClusterRole grants unrestricted access to every resource and every verb, including creating and deleting Namespaces, modifying RBAC policies, and accessing Secrets cluster-wide. A misconfigured or compromised application with `cluster-admin` can destroy the entire cluster. Reserve `cluster-admin` for cluster operators only, and even then, use it for specific administrative tasks rather than persistent bindings.
:::

## A powerful pattern: ClusterRole bound with a RoleBinding

@@@
graph LR
    CROLE["ClusterRole\npod-lister"] --> CRB["ClusterRoleBinding\n→ all namespaces"]
    CROLE --> RB["RoleBinding in dev\n→ dev namespace only"]
    CRB --> SA_GLOBAL["SA: monitoring-agent\naccess everywhere"]
    RB --> SA_LOCAL["SA: dev-reader\naccess in dev only"]
@@@

A ClusterRole can also be referenced by a regular namespaced RoleBinding. When you do this, the ClusterRole's rules apply, but only within the namespace of that RoleBinding. This pattern lets you define permission templates once as ClusterRoles and reuse them across multiple namespaces without duplicating Role objects in every namespace.

Why does Kubernetes support this? Because maintaining identical Roles across twenty namespaces is error-prone. A single ClusterRole template with per-namespace RoleBindings is the standard pattern for shared permission sets.

:::quiz
You have a ClusterRole named `log-reader` that allows `get` and `list` on `pods/log`. You create a RoleBinding in namespace `staging` that references this ClusterRole. What access does the subject receive?

**Answer:** The subject can `get` and `list` pod logs only within the `staging` namespace. The RoleBinding scopes the ClusterRole's rules to its own namespace. The subject does not gain access to pod logs in any other namespace. This is the namespace-scoping behavior of referencing a ClusterRole through a RoleBinding.
:::

ClusterRoles and ClusterRoleBindings give you the cluster-wide reach that namespaced Roles cannot provide. The next lesson shows you how to verify that these permissions actually work the way you expect, using `kubectl auth can-i` to test access before deploying.
