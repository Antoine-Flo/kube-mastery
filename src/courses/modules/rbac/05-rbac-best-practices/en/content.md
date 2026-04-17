---
seoTitle: 'Kubernetes RBAC Best Practices, Least Privilege, Audit Permissions'
seoDescription: 'Learn the key RBAC best practices for Kubernetes: least privilege, namespace isolation, avoiding cluster-admin for apps, one ServiceAccount per workload, and auditing.'
---

# RBAC Best Practices

RBAC is not just about making things work. It is about making things work with the minimum necessary permissions. A misconfigured RBAC policy is a security hole that may stay invisible for months, then surface in the worst possible moment. The principles in this lesson are not theoretical: they address the most common real-world mistakes.

Start by auditing what bindings already exist in your simulated cluster:

```bash
kubectl get rolebindings -A
```

```bash
kubectl get clusterrolebindings | grep -v system
```

These two commands give you a full inventory of who has been granted what. Run them whenever you join a new cluster or want to understand its permission landscape.

## Least privilege

Grant only the verbs and resources a subject actually needs. Start with nothing and add permissions when a concrete need arises. The question to ask before every new rule is: "what is the minimum access this workload requires to do its job?"

A useful pattern: deploy the application first with no RBAC at all. Check the logs for `403 Forbidden` errors. Each error tells you exactly what verb and resource are missing. Add precisely those rules and nothing more.

:::quiz
Why is it better to start with no permissions and add them incrementally, rather than starting broad and restricting later?

**Answer:** Restricting permissions that are already in use causes outages: the workload breaks the moment a permission is removed. Starting with nothing means the worst outcome is a `403` that you fix by adding a rule. There is no risk of accidentally leaving excess permissions in place, because you only ever add what is needed.
:::

## Prefer namespaced Roles over ClusterRoles

If a subject only operates in one namespace, give it a Role in that namespace and a RoleBinding. Do not reach for a ClusterRole unless you have a genuine cross-namespace or cluster-scoped need.

Why does this matter? A ClusterRole bound with a ClusterRoleBinding applies everywhere. If the subject is compromised, the blast radius is the entire cluster. A namespaced Role limits the damage to a single namespace.

```bash
kubectl describe clusterrolebinding cluster-admin
```

Inspect who is bound to `cluster-admin`. In a well-run cluster, this list should be very short: typically the `kube-system` ServiceAccounts that genuinely need it. If you see application ServiceAccounts in that list, that is a critical finding.

:::warning
**Bad pattern:** ServiceAccount `my-app` in namespace `default` has a ClusterRoleBinding to `cluster-admin`. This gives `my-app` unrestricted access to every resource in the cluster, including Secrets in all namespaces, Node objects, and the ability to modify RBAC policies themselves.

**Good pattern:** ServiceAccount `my-app` has a Role in namespace `default` with `get` and `list` on `pods` only. It can read the Pods it needs to operate and nothing else.
:::

## One ServiceAccount per application

Never share a ServiceAccount between two workloads that have different permission requirements. If `service-a` needs `get secrets` and `service-b` needs `list pods`, give each its own ServiceAccount and bind each Role independently.

Why? If you share one ServiceAccount across both, both workloads inherit the union of all permissions. When you later restrict permissions for one workload, you inadvertently restrict the other. Worse, if one workload is compromised, the attacker gains the permissions of both.

## Avoid wildcards

`verbs: ["*"]` and `resources: ["*"]` are almost always too broad. Even if you scope resources to `pods`, a wildcard on verbs grants `delete`, `patch`, `exec`, and `escalate`.

:::quiz
Why is `verbs: ["*"]` on a Role dangerous even if `resources` is scoped to `["pods"]`?

**Answer:** The wildcard includes `exec` (which opens a shell into a running container) and `escalate` (which allows binding higher-privilege roles). A subject that can exec into Pods can potentially escape to the underlying node or read mounted Secrets from the container's environment. Scoping resources does not protect against the privilege escalation paths that wildcard verbs enable.
:::

## Audit regularly

RBAC policies accumulate over time. A binding created for a one-off task may never be cleaned up. Build a habit of reviewing what exists:

```bash
kubectl get clusterrolebindings | grep -v system
```

```bash
kubectl get rolebindings -A
```

For any binding you cannot immediately explain, describe it to see who it grants access to and what ClusterRole or Role it references:

```bash
kubectl describe clusterrolebinding cluster-admin
```

@@@
graph LR
    AUDIT["Regular audit\nkubectl get rolebindings -A"] --> REVIEW["Review each binding:\nwho, what, why"]
    REVIEW --> REMOVE["Remove stale or\noverly broad bindings"]
    REMOVE --> VERIFY["Verify with\nkubectl auth can-i --list"]
    VERIFY --> AUDIT
@@@

The audit loop above, run periodically, keeps RBAC policy from drifting into an unmaintainable state. Stale bindings are a quiet risk: the subject they were created for may no longer exist, but the binding remains and can be exploited if the subject name is reused.

You have now covered the full RBAC toolkit: authorization modes, Roles and RoleBindings, ClusterRoles and ClusterRoleBindings, permission testing with `kubectl auth can-i`, and the principles that keep policies safe over time. These concepts appear directly in CKA exam scenarios, so the best next step is to apply them in the simulator drills for this module.
