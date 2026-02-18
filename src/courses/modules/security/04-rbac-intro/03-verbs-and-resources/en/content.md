# Verbs and Resources

You now know that Roles define permissions and RoleBindings assign them to subjects. But what exactly goes *inside* a Role? Every RBAC rule answers two questions: **what** can be accessed (resources) and **how** (verbs). Crafting precise rules is the foundation of least-privilege access — and it is easier than you might think.

Think of it like setting permissions on a shared document. You might give someone view access (read-only), comment access (read plus annotate), or edit access (full modification). RBAC verbs work the same way — they define the level of interaction allowed.

## The Common Verbs

Kubernetes defines a set of standard verbs that correspond to API operations:

| Verb                | What it allows                                   |
| ------------------- | ------------------------------------------------ |
| `get`               | Read a single resource by name                   |
| `list`              | List all resources of a type                     |
| `watch`             | Stream real-time changes (used by controllers)   |
| `create`            | Create a new resource                            |
| `update`            | Replace an existing resource entirely            |
| `patch`             | Modify specific fields of a resource             |
| `delete`            | Delete a single resource                         |
| `deletecollection`  | Delete multiple resources at once                |

For read-only access, `get`, `list`, and `watch` are typically sufficient. For full management, you would add `create`, `update`, `patch`, and `delete`. Use `deletecollection` with caution — it removes multiple resources in one call.

## Understanding Resources and API Groups

Resources are organized by **API groups**. Core resources like Pods, Services, and ConfigMaps belong to the empty group (`""`). Other resources belong to named groups:

- `""` (core) — Pods, Services, ConfigMaps, Secrets, Namespaces
- `apps` — Deployments, StatefulSets, DaemonSets, ReplicaSets
- `batch` — Jobs, CronJobs
- `rbac.authorization.k8s.io` — Roles, RoleBindings, ClusterRoles

You can discover all available resources and their groups with `kubectl api-resources`, which shows the resource name, short name, API group, whether it is namespaced, and its kind — very useful when writing RBAC rules.

## Subresources: The Often-Missed Detail

Some resources have **subresources** that must be listed explicitly. This catches many people by surprise. For example:

- `pods/log` — needed for `kubectl logs`
- `pods/exec` — needed for `kubectl exec`
- `pods/status` — needed to read or update the Pod's status
- `deployments/scale` — needed to scale a Deployment

If your Role only grants access to `pods`, a user with that Role **cannot** run `kubectl logs` or `kubectl exec`. You must include the subresources explicitly:

```yaml
resources: ["pods", "pods/log", "pods/exec"]
```

## Putting Rules Together

Here is a Role with two rules — read-only access to core resources, and full management of Deployments:

```yaml
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "create", "update", "delete"]
```

Each rule combines an API group, a set of resources, and the verbs allowed. You can have as many rules as needed in a single Role.

:::info
Start with the minimum verbs required. If a workload only needs to read Pods, grant `get` and `list` — not `create`, `update`, or `delete`. You can always add permissions later, but removing them after they have been relied upon is much harder.
:::

## Fine-Grained Access with resourceNames

For even tighter control, you can restrict a rule to specific **named resources**:

```yaml
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["app-config"]
    verbs: ["get", "update"]
```

This rule only allows `get` and `update` on the ConfigMap named `app-config` — no other ConfigMaps are accessible. This is useful for controllers or applications that only need to manage a specific configuration.

Always verify that your rules produce the expected results. The `kubectl auth can-i --list` flag is particularly helpful — it shows every permission the subject has in the given namespace, making it easy to spot overly broad or missing rules.

:::warning
Wildcards (`"*"` for verbs, resources, or API groups) grant blanket access and should be avoided in production Roles. They make it difficult to audit what is actually permitted and can lead to unintended privilege escalation.
:::

---

## Hands-On Practice

### Step 1: Test different verbs

```bash
kubectl auth can-i get pods -n default
kubectl auth can-i create pods -n default
kubectl auth can-i delete pods -n default
```

Each verb is a separate permission. You may have `get` but not `delete`, or vice versa, depending on your RBAC bindings.

### Step 2: List API resources

```bash
kubectl api-resources
```

Shows resource names (e.g. `pods`, `services`, `deployments`), API groups, and whether each resource is namespaced. Use this when writing RBAC rules to get the exact resource names.

### Step 3: List your effective permissions (optional)

```bash
kubectl auth can-i --list -n default
```

Shows every permission your current identity has in the default namespace. Helps you understand the cumulative effect of all your RoleBindings and ClusterRoleBindings.

## Wrapping Up

Verbs define the actions, resources define the targets, and API groups organize them. Together, they form the building blocks of every RBAC rule. By combining precise verbs, explicit subresources, and optional `resourceNames`, you can craft permissions that follow the principle of least privilege. In the next chapter, we will move on to Pod Security Standards — Kubernetes' built-in mechanism for restricting what Pods are allowed to do at the namespace level.
