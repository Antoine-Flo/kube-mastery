---
seoTitle: Kubernetes Namespace Navigation, -n Flag, Context, DNS
seoDescription: Learn how to switch namespaces with -n, query all namespaces with -A, set a default namespace via kubectl config, and use cross-namespace DNS.
---

# Working Across Namespaces

You manage two teams on the same cluster. The backend team has a Service named `api` in the `backend` namespace. The frontend team wants to call that Service from the `frontend` namespace. How does the call get routed? And how do you monitor Pods across all namespaces at once without switching context for every command?

## Targeting a Specific Namespace with `-n`

Every kubectl command that reads or writes resources accepts a `-n` flag. It applies to `get`, `describe`, `create`, `apply`, `delete`, and `logs`, among others:

```
kubectl get pods -n kube-system
kubectl get services -n kube-system
kubectl describe pod kube-apiserver-minikube -n kube-system
```

The flag scopes the command to that namespace only. Resources in other namespaces are invisible to that command.

## Viewing All Namespaces at Once with `-A`

When you want a full picture of what is running across the entire cluster, use `--all-namespaces` or its shorthand `-A`:

```
kubectl get pods -A
kubectl get pods --all-namespaces
```

The output adds a `NAMESPACE` column as the first field. This is the fastest way to answer "what is running where" on a shared cluster.

:::quiz
List all Pods across all namespaces. Which namespace has the most Pods?

**Try it:** `kubectl get pods -A`

**Answer:** The `NAMESPACE` column shows where each Pod runs. `kube-system` typically has the most Pods because it holds all the cluster components: apiserver, scheduler, controller-manager, coredns, and kube-proxy.
:::

## Setting Up a Practice Environment

Create two namespaces and deploy a workload into each so you can practice cross-namespace operations:

```
kubectl create namespace team-a
kubectl create namespace team-b
kubectl create deployment app-a --image=nginx:1.28 -n team-a
kubectl create deployment app-b --image=nginx:1.28 -n team-b
kubectl get pods -A
```

The `-A` output now shows Pods from both `team-a` and `team-b` alongside the system Pods. Notice how the same command gives you the full cluster view without changing anything.


## Cross-Namespace DNS

@@@
graph LR
    POD_A["Pod in namespace: frontend\nwants to call 'api'"]
    DNS["CoreDNS\nresolves FQDN"]
    SVC["Service: api\nnamespace: backend"]
    POD_A -->|"api.backend.svc.cluster.local"| DNS
    DNS --> SVC
@@@

Within the same namespace, a Pod can call a Service by its short name. A Pod in `frontend` calling a Service named `web` that also lives in `frontend` just uses `web`. CoreDNS automatically resolves it.

Cross-namespace, the short name no longer works. CoreDNS resolves short names relative to the caller's namespace. If the Pod is in `frontend` and calls `api`, CoreDNS looks for a Service named `api` inside `frontend`. If that Service does not exist there, the lookup fails.

To call a Service in a different namespace, use its Fully Qualified Domain Name:

```
<service-name>.<namespace>.svc.cluster.local
```

For example, to reach a Service `api` in the `backend` namespace from anywhere in the cluster:

```
nslookup api.backend.svc.cluster.local
```

The FQDN forces CoreDNS to resolve the name absolutely, bypassing the relative search starting from the caller's namespace.

:::warning
A very common debugging mistake is calling a cross-namespace Service by its short name and wondering why the connection times out. If `curl api` fails from the `frontend` namespace, the root cause is almost always that CoreDNS is searching for `api` inside `frontend`, not `backend`. Switch to the full FQDN and the call will resolve correctly.
:::

:::quiz
A Pod in namespace `app` wants to call a Service named `db` in namespace `data`. Which URL should it use?

- `db` (short name in the current namespace)
- `db.data` (namespace only, no suffix)
- `db.data.svc.cluster.local` (full FQDN)

**Answer:** `db.data.svc.cluster.local` - The short name `db` resolves to the `app` namespace. `db.data` is a partial form that some CoreDNS configurations may resolve, but the full FQDN is always reliable and unambiguous.
:::

:::quiz
Why does the FQDN format include `.svc.cluster.local` and not just `.<namespace>`?

**Answer:** CoreDNS builds its search domains following the Kubernetes DNS specification. The `.svc.cluster.local` suffix identifies the resource type (a Service) and the cluster domain. This makes DNS names predictable and avoids collisions with external domain names.
:::

## Cleaning Up

Remove both namespaces when you are done. Deleting a namespace deletes all resources inside it:

```
kubectl delete namespace team-a
kubectl delete namespace team-b
```

Working across namespaces comes down to two tools: `-n` to scope a command, `-A` to see everything at once, and the FQDN pattern for cross-namespace Service calls. The next lesson steps back to the bigger picture and asks when you actually need multiple namespaces in the first place.
