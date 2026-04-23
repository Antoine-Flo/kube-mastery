---
seoTitle: Kubernetes Multi-Namespace, Teams, Quotas, Network Isolation
seoDescription: Explore when to use multiple Kubernetes namespaces for environment separation, team isolation, ResourceQuotas, and NetworkPolicies, and when not to.
---

# When to Use Multiple Namespaces

Now that you know how to create and navigate namespaces, the real question is: when do you actually need them? A single `default` namespace is tempting for its simplicity. On a shared cluster or in a team environment, it quickly becomes unmanageable. This lesson covers three common patterns and when a single namespace is the right call.

@@@
graph TD
A["Pattern 1\nPer team\nfrontend / backend / data"]
B["Pattern 2\nPer environment\ndev / staging / production"]
C["Pattern 3\nPer application\none namespace per app"]
CAUTION["Not a substitute\nfor network security\nor full cluster isolation"]
A --> CAUTION
B --> CAUTION
C --> CAUTION
@@@

## Pattern 1: Per Team

Each team gets its own namespace. The frontend team cannot accidentally delete a backend Deployment when running `kubectl delete deployment --all`. RBAC (Role-Based Access Control) is applied at the namespace level, so team A has write access only to its own namespace and read-only or no access elsewhere.

Create the namespaces:

```bash
kubectl create namespace frontend
kubectl create namespace backend
```

```bash
kubectl create deployment web --image=nginx:1.28 -n frontend
kubectl create deployment api --image=nginx:1.28 -n backend
kubectl get pods -A
```

Each team runs `kubectl get pods -n frontend` and sees only their own Pods. The cluster feels private even though it is shared.

:::quiz What is the main benefit of the per-team namespace pattern?
**Answer:** It limits blast radius. A `kubectl delete` scoped to one namespace cannot affect another team's resources. Combined with RBAC, it gives each team an isolated operational view of the cluster.
:::

## Pattern 2: Per Environment

Running `dev`, `staging`, and `production` in the same cluster using namespaces to separate them is common in smaller setups or learning environments. It reduces infrastructure cost while providing some separation.

:::warning
For real production workloads, separating environments into different clusters is the safest practice. Namespaces isolate names and RBAC, but they share the same control plane, the same etcd, the same nodes, and the same network. A poorly configured application can starve other namespaces of CPU or memory if no ResourceQuotas are set. A bug in the cluster control plane affects all environments at once.
:::

If you do use the per-environment pattern in the simulator, the setup looks like this:

```bash
kubectl create namespace dev
kubectl create namespace staging
kubectl get namespaces
```

## Pattern 3: Per Application

Each application running on the cluster gets its own namespace. This is the standard pattern for multi-tenant platforms where independent applications share infrastructure. It makes it easy to apply per-application resource limits, monitor resource usage per application, and clean up an entire application by deleting its namespace.

ResourceQuotas enforce limits at the namespace level:

```yaml
# illustrative only
apiVersion: v1
kind: ResourceQuota
metadata:
  name: app-quota
  namespace: my-app
spec:
  hard:
    pods: '20'
    requests.cpu: '4'
    requests.memory: 8Gi
```

Without a ResourceQuota, a namespace has no ceiling. One team or one application can consume all available CPU and memory in the cluster, degrading or starving every other workload.

:::quiz What happens if no ResourceQuota is applied to a team's namespace?

- Deployments in that namespace are limited to 10 Pods by default
- The team can consume all available cluster resources, impacting other teams
- Kubernetes refuses to create resources in a namespace without a quota
  **Answer:** The team can consume all available resources. Without a ResourceQuota, there is no per-namespace ceiling. A traffic spike or a misconfigured application can monopolize all CPU and memory across the cluster.
  :::

## When a Single Namespace Is Enough

If you are working alone on a personal cluster, learning Kubernetes, or running a single application, adding namespaces is extra complexity with little benefit. A single `default` namespace is perfectly valid in those cases.

Namespaces add value when at least one of these is true: multiple teams share the cluster, multiple environments coexist, or different applications need independent resource limits and access controls.

## Practice

Try this on your own: create a namespace called `my-app`, deploy an nginx Deployment with one replica into it, then confirm it is running by listing all Pods across all namespaces.

```
kubectl create namespace my-app
kubectl get pods -A
```

:::quiz Why do namespaces not fully replace separate clusters for environment isolation?
**Answer:** Namespaces share the same control plane, the same etcd database, the same physical nodes, and the same network fabric. A failure or misconfiguration at the cluster level affects all namespaces. Separate clusters provide complete isolation at the infrastructure level, which namespaces cannot offer.
:::

Namespaces are an organizational tool, not a complete security boundary. They keep names from colliding, scope RBAC permissions, and allow resource quotas per team or application. The next lessons introduce labels and annotations, which let you organize resources within a namespace with finer granularity than namespace boundaries alone can provide.
