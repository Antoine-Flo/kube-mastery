---
seoTitle: 'Kubernetes Users vs ServiceAccounts, Human Identity vs Pod Identity'
seoDescription: 'Understand the conceptual difference between human users and ServiceAccounts in Kubernetes: why users have no Kubernetes object while ServiceAccounts do.'
---

# Users vs ServiceAccounts

Your application is running in a Pod. It needs to call the Kubernetes API. Your instinct might be to create a user for it. But that is not how Kubernetes works, and understanding why reveals something fundamental about how identity is modeled in the platform.

## Human users have no Kubernetes object

Start with the most direct test: how do you list all users in the cluster?

```bash
kubectl get users
```

That command fails. There is no `users` resource in Kubernetes. You cannot create a user, list users, or delete a user with `kubectl`. A "user" in Kubernetes is just a name extracted from a verified credential at request time. When the certificate or token expires, the user is gone. Kubernetes never stored it.

This is not an oversight. It is the design: human identity is managed externally. The API server verifies a certificate or token presented by the client, extracts the identity from it, and uses that identity for authorization. It does not persist users anywhere. There is no user database.

@@@
graph LR
    Human["Human user\n(developer, operator)"]
    SA["ServiceAccount\n(Pod, controller)"]
    Ext["External system\ncert / OIDC token"]
    K8s["Kubernetes object\n(namespaced, in etcd)"]

    Human -- "identity lives in" --> Ext
    SA -- "identity lives in" --> K8s
@@@

:::quiz
How do you create a Kubernetes user named `alice`?

- `kubectl create user alice`
- Issue a client certificate with CN=alice signed by the cluster CA
- `kubectl apply -f user.yaml`

**Answer:** Issue a client certificate with CN=alice signed by the cluster CA. Kubernetes has no User resource. The "user" only exists as an identity claim inside a valid credential. There is no YAML for a user, and `kubectl create user` does not exist.
:::

## ServiceAccounts are Kubernetes objects

For workloads running inside Pods, the model is different. Pods need a stable, auditable identity that Kubernetes itself manages, one that can be created, updated, and deleted declaratively. That is what a **ServiceAccount** is.

Unlike human users, ServiceAccounts are first-class Kubernetes objects. They live in a namespace, they are stored in etcd, and they can be listed:

```bash
kubectl get serviceaccounts -n default
```

You will see at least one entry: `default`. Kubernetes creates that ServiceAccount automatically in every namespace. It is always there, even before you deploy anything.

```bash
kubectl get serviceaccount default -o yaml
```

The output is a standard Kubernetes manifest: `apiVersion`, `kind: ServiceAccount`, `metadata`. A ServiceAccount is a real resource you can reference in Pod specs and RBAC rules, not an ephemeral identity extracted from a credential.

:::quiz
A developer says "I cannot find the user object for the `ci-bot` account." What is the most likely explanation?

**Answer:** There is no user object. If `ci-bot` authenticates via a client certificate, its identity is encoded in the certificate's CN field. Kubernetes extracted that name at request time but never stored a user object. If `ci-bot` is a Pod, its identity is a ServiceAccount, which is a real Kubernetes object you can find with `kubectl get serviceaccount`.
:::

## Why the distinction matters

The two identity types are designed for different lifecycles and different management models.

Human users change jobs, lose devices, and need credentials rotated. Those operations belong to an external system, a certificate authority, an OIDC provider, a corporate directory. Kubernetes staying out of that management makes it composable with existing infrastructure.

ServiceAccounts, by contrast, are part of the cluster itself. When you deploy an application, you create a ServiceAccount for it alongside the Deployment. When the application is removed, the ServiceAccount is removed too. The identity lifecycle is tied to the workload lifecycle.

The other key difference is scope. A ServiceAccount belongs to a namespace. Its identity, and the permissions bound to it, are explicit, auditable, and scoped. A human user can appear in any namespace, their permissions controlled by ClusterRoleBindings or multiple RoleBindings. The two models overlap at authorization time but are otherwise completely separate.

```bash
kubectl get serviceaccounts -A
```

Every namespace in the output has a `default` ServiceAccount, created automatically. Human users are nowhere in this list, because they have no objects to list.

:::quiz
What is the key structural difference between a Kubernetes user and a ServiceAccount?

**Answer:** A user has no Kubernetes object. It is a name inside a credential, verified at request time and then discarded. A ServiceAccount is a namespaced Kubernetes object stored in etcd. You can create, describe, delete, and reference it in manifests. One is ephemeral and external, the other is persistent and internal.
:::

You now understand the two identity models Kubernetes uses and why they are separate. The next module goes deep on ServiceAccounts: how tokens are projected into Pods, how automounting works, and how to design per-application identities with minimal permissions.
