---
seoTitle: 'Kubernetes Roles and RoleBindings, RBAC Namespace Permissions'
seoDescription: 'Learn how to create Kubernetes Roles and RoleBindings to grant scoped permissions within a namespace, with worked YAML examples and common failure cases.'
---

# Roles and RoleBindings

You want to give a developer read-only access to Pods in the `dev` namespace. They should not see Secrets or modify anything. RBAC does this with two objects: a **Role** that defines what is allowed, and a **RoleBinding** that connects the Role to a subject. Neither object on its own does anything; you need both.

Start by creating the `dev` namespace in the simulated cluster:

```bash
kubectl create namespace dev
```

## The Role object

@@@
graph LR
    ROLE["Role\n(namespaced)"] --> RULES["rules:\n- apiGroups\n- resources\n- verbs"]
    RULES --> NS["Effective only\nwithin its namespace"]
@@@

A Role is a namespaced resource. It holds a list of `rules`, where each rule combines three elements: `apiGroups`, `resources`, and `verbs`. The Role grants only the listed verbs on the listed resources, and only within the namespace where the Role lives. A Role in `dev` has no effect in `production`.

Build the manifest one field at a time. Create the file:

```bash
nano dev-role.yaml
```

The `kind` field tells the API server this is a Role, not a ClusterRole:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
```

The `metadata` section anchors the Role in the right namespace:

```yaml
metadata:
  name: pod-reader
  namespace: dev
```

The `rules` section is where the permissions live. Each rule lists an `apiGroups` array (use `""` for core resources like Pods), a `resources` array, and a `verbs` array:

```yaml
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
```

Full file to write:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: dev
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
```

```bash
kubectl apply -f dev-role.yaml
```

```bash
kubectl get roles -n dev
```

You should see `pod-reader` listed. The Role exists, but nothing uses it yet. A Role without a RoleBinding grants access to nobody.

:::quiz
What is the minimum Role definition to allow a subject to list and get ConfigMaps in a namespace?

**Try it:** Write a Role manifest with `resources: ["configmaps"]` and `verbs: ["get", "list"]`, apply it, and verify with `kubectl get roles -n dev`.

**Answer:** The `apiGroups` must be `[""]` (ConfigMaps are a core resource), `resources` must include `"configmaps"`, and `verbs` must include at least `"get"` and `"list"`. Watch is optional but commonly added for controllers that need to observe changes.
:::

## The RoleBinding object

A RoleBinding connects a Role to one or more subjects. The binding lives in the same namespace as the Role it references. A RoleBinding cannot reference a Role in a different namespace.

```bash
nano dev-rolebinding.yaml
```

The `subjects` array lists who receives the permissions. Each entry has a `kind` (`User`, `Group`, or `ServiceAccount`), a `name`, and an `apiGroup`:

```yaml
subjects:
  - kind: User
    name: developer
    apiGroup: rbac.authorization.k8s.io
```

The `roleRef` points at the Role being bound. Once a RoleBinding is created, `roleRef` is immutable. To change it, delete the binding and recreate it:

```yaml
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

Full manifest:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: dev
subjects:
  - kind: User
    name: developer
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl apply -f dev-rolebinding.yaml
```

```bash
kubectl get rolebindings -n dev
```

Now `developer` can `get`, `list`, and `watch` Pods in `dev`. They still cannot touch Secrets, ConfigMaps, or resources in any other namespace.

## Binding a Role to a ServiceAccount

The `subjects` entry changes slightly when the subject is a ServiceAccount. A ServiceAccount belongs to a namespace, so you must specify it:

```yaml
subjects:
  - kind: ServiceAccount
    name: my-app
    namespace: dev
```

:::warning
A common mistake is omitting the `namespace` field on a ServiceAccount subject. If `namespace` is missing, the API server looks for the ServiceAccount in the namespace of the RoleBinding itself. If the ServiceAccount lives in a different namespace, the binding silently fails to grant access. The binding is created successfully, but the permissions never take effect for that subject. Always specify `namespace` explicitly when binding to a ServiceAccount.
:::

:::quiz
You created a RoleBinding in namespace `dev` that binds to ServiceAccount `reporter` with `namespace: staging`. The Role grants `get pods`. When `reporter` in `staging` tries to get pods in `dev`, access is denied. Why?

**Answer:** The API server resolves the ServiceAccount identity as `system:serviceaccount:staging:reporter`. The RoleBinding subjects entry has `namespace: staging`, which means the binding correctly identifies that ServiceAccount. The issue is the opposite: if you wrote the wrong namespace, it would look for a ServiceAccount in the wrong place. In the correct scenario, the binding should work. Double-check that the `name` matches exactly, and use `kubectl auth can-i` with `--as system:serviceaccount:staging:reporter` in the `dev` namespace to debug.
:::

With Roles and RoleBindings, you can grant precise permissions within a single namespace. The next lesson covers ClusterRoles and ClusterRoleBindings, which extend this model to resources that span the entire cluster or live outside any namespace.
