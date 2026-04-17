---
seoTitle: 'Kubernetes Authorization, RBAC, ABAC, Node, Webhook Modes'
seoDescription: 'Understand how Kubernetes authorizes requests, why RBAC is the standard, and how the subject-verb-resource mental model controls access to cluster resources.'
---

# Authorization in Kubernetes

Authentication answers "who are you?" But that is only half the picture. Once Kubernetes knows your identity, it still needs to decide what you are allowed to do. That decision belongs to **authorization**. A request that passes authentication can still be rejected if the caller lacks permission to perform the requested action.

Start by observing the full list of resource types in your simulated cluster:

```bash
kubectl api-resources --verbs=list
```

Each row in that output is a resource type. Authorization determines which subjects can apply which verbs to which resources.

## The four authorization modes

@@@
graph LR
    REQ["Incoming request\n(identity known)"] --> AUTH["Authorization layer"]
    AUTH --> RBAC["RBAC"]
    AUTH --> ABAC["ABAC"]
    AUTH --> NODE["Node"]
    AUTH --> WEBHOOK["Webhook"]
    RBAC --> RESULT["Allow / Deny"]
    ABAC --> RESULT
    NODE --> RESULT
    WEBHOOK --> RESULT
@@@

Kubernetes supports four authorization modes that run in sequence. If any mode allows the request, it proceeds. If all modes deny it, the request is rejected with a `403 Forbidden`.

**RBAC** (Role-Based Access Control) is the standard today. Access is granted by attaching roles to subjects. You change permissions by creating or deleting Kubernetes objects. No restart required, changes take effect immediately.

**ABAC** (Attribute-Based Access Control) evaluates policies written in a flat file on the API server node. The fundamental problem: every policy change requires you to restart the API server. That is a disqualifying constraint in production, which is why ABAC has been effectively replaced by RBAC.

**Node authorization** is a specialized mode for the kubelet agent running on each node. It allows kubelets to read the Pods, Secrets, and ConfigMaps that belong to their own node, and nothing more. You do not configure this mode; it operates transparently in the background.

**Webhook authorization** delegates the allow/deny decision to an external HTTP service. The API server calls that service with the request details and waits for a response. This is used for advanced scenarios like open-source policy engines, but it is out of scope for the CKA exam.

:::info
The CKA exam tests RBAC almost exclusively. You need a deep working understanding of RBAC objects and the `kubectl auth can-i` command. The other modes are worth knowing by name and purpose.
:::

## The RBAC mental model

@@@
graph LR
    SUBJECT["Subject\n(User / Group / ServiceAccount)"] --> BINDING["Binding\n(RoleBinding / ClusterRoleBinding)"]
    BINDING --> ROLE["Role / ClusterRole\n(verb + resource + apiGroup)"]
    ROLE --> DECISION["API Server decision\nAllow or Deny"]
@@@

RBAC reduces to three elements: subjects, verbs, and resources.

A **subject** is the identity making the request. It can be a user (identified by the `CN` field in a client certificate), a group (from the `O` field), or a ServiceAccount.

A **verb** is the HTTP method translated into a Kubernetes action: `get`, `list`, `watch`, `create`, `update`, `patch`, `delete`, `deletecollection`. These map directly to what the API server allows the subject to do with a resource type.

A **resource** is the API object type being acted on: `pods`, `deployments`, `secrets`, `configmaps`, and so on. Resources also carry an `apiGroup`. Core resources like Pods and Services belong to the empty group `""`. Resources like Deployments belong to `apps`.

Put together, an RBAC policy reads like a sentence: "ServiceAccount `my-app` can `get` and `list` `pods` in namespace `default`." That sentence is what you express as Kubernetes objects.

:::quiz
Which authorization mode requires an API server restart to update its policies?

- RBAC
- ABAC
- Node

**Answer:** ABAC. Its policies live in a file on the API server node, and the API server must be restarted to reload them. RBAC is dynamic: creating or deleting a Role or Binding takes effect immediately without any restart.
:::

## Quick permission check

Before building any RBAC objects, check your own permissions in the simulated cluster:

```bash
kubectl auth can-i get pods
```

You should see `yes`. Now check something you likely cannot do:

```bash
kubectl auth can-i delete nodes
```

:::warning
If `kubectl auth can-i` returns `no` for an action you expected to be allowed, the subject running the command does not have the required Role or ClusterRole bound to it. The request will be rejected with `403 Forbidden` when actually attempted. Catching this early with `can-i` is the right workflow, especially before deploying application ServiceAccounts.
:::

The next lesson dives into the two core RBAC objects that make all of this concrete: Roles, which define what is allowed, and RoleBindings, which connect those permissions to a subject.
