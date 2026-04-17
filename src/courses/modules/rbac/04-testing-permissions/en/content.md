---
seoTitle: 'kubectl auth can-i, Testing Kubernetes RBAC Permissions'
seoDescription: 'Learn how to verify Kubernetes RBAC permissions using kubectl auth can-i, including impersonation for users and ServiceAccounts, and listing all allowed actions.'
---

# Testing Permissions with kubectl auth can-i

You set up RBAC. Now how do you verify it actually works? You cannot always test by trying the forbidden action in production: a failed `kubectl delete` might succeed, a misconfigured binding might let through something it should block. Kubernetes provides a dry-run mechanism that does not touch any real resource: `kubectl auth can-i`.

Check your own permissions in the simulated cluster right away:

```bash
kubectl auth can-i get pods
```

The answer is either `yes` or `no`. No partial answers, no ambiguity. The API server evaluates your identity against all active RBAC policies and returns a binary result.

## Checking your own permissions

`kubectl auth can-i <verb> <resource>` checks whether your own identity is allowed to perform the action in the current namespace. You can also specify a namespace explicitly:

```bash
kubectl auth can-i create deployments --namespace production
```

To see everything you are allowed to do in the current namespace, use the `--list` flag:

```bash
kubectl auth can-i --list
```

The output lists every verb and resource combination your identity is permitted to use. This is useful when you have been granted permissions through multiple Roles or ClusterRoles and want a consolidated view.

:::quiz
How do you check what actions you are allowed to perform in the `kube-system` namespace?

**Try it:** `kubectl auth can-i --list --namespace kube-system`

**Answer:** The output lists all verb-resource combinations permitted for your identity in `kube-system`. If you see nothing listed (or only `selfsubjectaccessreviews`), your identity has no permissions in that namespace.
:::

## Impersonating another subject

`kubectl auth can-i` becomes genuinely powerful when you combine it with `--as`. This lets you check another subject's permissions without logging in as them.

```bash
kubectl auth can-i get pods --as system:serviceaccount:default:my-app
```

The `--as` value for a ServiceAccount follows the format `system:serviceaccount:<namespace>:<name>`. This is the exact identity string the API server uses internally when a ServiceAccount makes a request.

@@@
graph LR
    CLI["kubectl auth can-i\n--as system:serviceaccount:default:my-app"] --> APISERV["API Server\nadds Impersonate header"]
    APISERV --> RBAC["RBAC evaluator\nchecks SA identity"]
    RBAC --> RESULT["yes / no"]
@@@

Why does this work? The `--as` flag sends an `Impersonate-User` header with the request. The API server runs a full RBAC evaluation as if the request came from that subject. Your own identity is not used for the permission check. This requires that you have impersonation permission yourself (which admin users typically do).

```bash
kubectl auth can-i delete nodes --as system:serviceaccount:default:my-app
```

:::warning
When `kubectl auth can-i` returns `no`, that means the action will result in a `403 Forbidden` error if the subject actually attempts it. But `no` does not tell you which Role is missing or why. It only tells you the effective result. To understand why, you need to trace back through the RoleBindings and ClusterRoleBindings that apply to the subject. `kubectl auth can-i --list --as <subject>` is the fastest way to see the complete picture.
:::

:::quiz
You created a ClusterRoleBinding that gives ServiceAccount `monitor` in namespace `tools` the `view` ClusterRole. How do you verify that `monitor` can list Secrets in the `production` namespace?

**Try it:** `kubectl auth can-i list secrets --namespace production --as system:serviceaccount:tools:monitor`

**Answer:** The `view` ClusterRole does not include Secrets. The output should be `no`. The `view` built-in ClusterRole explicitly excludes Secrets to avoid accidentally granting broad secret access. To allow listing Secrets, you need a separate Role or ClusterRole that explicitly includes `secrets` in its rules.
:::

## Impersonating a user or group

The `--as` flag also works for users and groups. For a user named `alice`:

```bash
kubectl auth can-i get pods --as alice
```

For a group (as used in certificate `O` fields):

```bash
kubectl auth can-i get pods --as-group developers
```

This is useful when you want to verify that a certificate-based user, before they receive their credentials, will have the access they need.

The combination of `kubectl auth can-i --list` and impersonation gives you a complete testing toolkit. Before deploying any ServiceAccount-powered application, run a quick permission check. Before handing credentials to a new team member, verify their access profile. The next lesson wraps the RBAC module with the principles that keep permission policies maintainable and secure over time.
