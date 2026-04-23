---
seoTitle: 'Kubernetes ServiceAccount, Pod Identity, API Authentication'
seoDescription: 'Learn what a ServiceAccount is in Kubernetes, how Pods use it to authenticate to the API server, and why every namespace ships with a default ServiceAccount.'
---

# What Is a ServiceAccount

Your application is running in a Pod. It needs to list other Pods in the same namespace, so it calls the Kubernetes API. But who is making that call? Kubernetes needs to know the identity of the caller before it can decide whether to allow the request. That identity is a **ServiceAccount**.

## Pods have an identity

Unlike human users, who are managed outside Kubernetes through certificates or external providers, workloads running inside Pods have an identity managed directly by Kubernetes. That identity is a **ServiceAccount** object. It lives in a namespace, just like Pods, ConfigMaps, and Services.

@@@
graph LR
  P["Pod\n(app container)"]
  SA["ServiceAccount\n(my-app)"]
  API["API Server"]
  RBAC["RBAC check\n(allowed?)"]
  RES["Response"]
  P --> SA
  SA --> API
  API --> RBAC
  RBAC --> RES
@@@

The flow is straightforward. The Pod carries a token that identifies it as a particular ServiceAccount. When the Pod makes an API request, the API server reads that token, resolves the identity, and passes it to the authorization layer. RBAC then decides whether that identity has permission to perform the requested action. If yes, the response comes back. If not, a 403 error is returned.

:::quiz
What does a ServiceAccount represent in Kubernetes?

- A human user account that developers use to access the cluster
- The identity of a workload running inside a Pod
- A role that grants permissions to a namespace

**Answer:** The identity of a workload running inside a Pod. Human users have no corresponding Kubernetes object. A ServiceAccount is specifically the mechanism for Pod-level identity, not human access or permission rules.
:::

## Every namespace has a default ServiceAccount

When Kubernetes creates a namespace, it automatically creates a ServiceAccount named `default` inside it. Inspect the simulated cluster now to see it.

```bash
kubectl get serviceaccounts -n default
```

You will see one entry: `default`. Every Pod that does not explicitly declare a ServiceAccount is assigned this one automatically. That is a reasonable starting point, but it has consequences explored in the next lesson.

Describe it to see what it looks like at the API level.

```bash
kubectl describe serviceaccount default -n default
```

The output shows the name, namespace, and any associated tokens. In clusters using projected tokens (Kubernetes 1.21+), no long-lived Secret token is listed here because tokens are issued on demand. Lesson 05 covers that mechanism in detail.

:::quiz
You create a new namespace called `staging`. Without any additional steps, how many ServiceAccounts exist in that namespace?

**Answer:** One. Kubernetes automatically creates the `default` ServiceAccount whenever a namespace is created. You do not need to create it manually.
:::

## ServiceAccounts are namespaced objects

A ServiceAccount named `my-app` in namespace `staging` and one named `my-app` in namespace `production` are two entirely separate objects with independent permissions. This namespacing is by design: it lets teams control workload identities without interfering with each other.

:::info
ServiceAccounts are namespaced. RBAC permissions bound to a ServiceAccount in one namespace do not automatically apply in another. This is a useful isolation boundary for multi-team clusters.
:::

Now run the `get serviceaccounts` command across all namespaces to see that the `default` SA exists everywhere.

```bash
kubectl get serviceaccounts -A
```

Every namespace in the output has its own `default` entry, created automatically at namespace creation time.

:::warning
If you grant permissions to the `default` ServiceAccount in a namespace, every Pod in that namespace that does not specify an explicit ServiceAccount inherits those permissions. A developer who adds a permissive RBAC binding to `default` may inadvertently expose all unnamed workloads. This is one of the main reasons to always assign a dedicated ServiceAccount per application rather than relying on `default`.
:::

:::quiz
Why is it risky to add permissions directly to the `default` ServiceAccount?

**Answer:** Because all Pods in the namespace that do not declare an explicit `serviceAccountName` automatically use `default`. Any permission granted to `default` is inherited by all of those Pods, including ones that have no reason to call the API. One misconfigured binding can expose an entire namespace.
:::

You now know what a ServiceAccount is, how Pods acquire one, and why the `default` ServiceAccount exists in every namespace. The next lesson shows how to create a dedicated ServiceAccount for an application and assign it explicitly in the Pod spec, instead of relying on the shared `default`.
