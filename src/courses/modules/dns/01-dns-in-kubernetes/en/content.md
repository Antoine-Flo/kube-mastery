---
seoTitle: 'Kubernetes DNS, CoreDNS, Search Domains, Resolution Flow'
seoDescription: 'Understand how Kubernetes DNS works with CoreDNS, how Pods are configured via /etc/resolv.conf, and how search domains enable short-name service resolution.'
---

# DNS in Kubernetes

You deploy a Service called `web` in the `default` namespace. From another Pod, you run `curl http://web` and it works. Nobody configured a `/etc/hosts` entry, nobody passed an IP address. How did the Pod know where `web` lives?

The answer is CoreDNS, and understanding it changes how you think about every inter-service call in the simulated cluster.

## CoreDNS: the cluster's name server

CoreDNS is a DNS server that runs as a Deployment inside the `kube-system` namespace. When the cluster starts, it registers itself as the DNS resolver for every Pod. Every Pod is configured at creation time to point its DNS queries to the CoreDNS service IP.

Start by confirming CoreDNS is running in the simulated cluster:

```bash
kubectl get pods -n kube-system
```

You should see one or more Pods with `coredns` in their name in the `Running` state. These are the Pods answering every DNS query your workloads make.

:::quiz
Why is CoreDNS placed in `kube-system` rather than `default`?

**Answer:** `kube-system` is reserved for cluster-level infrastructure. Placing CoreDNS there separates it from user workloads, makes it easy to identify system components, and prevents accidental deletion by users working in `default`.
:::

## /etc/resolv.conf and the search domains

When Kubernetes creates a Pod, it writes a `/etc/resolv.conf` file inside the container. That file tells the operating system where to send DNS queries and which domain suffixes to try automatically when a short name is used.

@@@
graph LR
    Pod["Pod\n(runs nslookup web)"] --> Resolv["/etc/resolv.conf\nnameserver CoreDNS-IP\nsearch default.svc.cluster.local\n svc.cluster.local cluster.local"]
    Resolv --> CoreDNS["CoreDNS\n(kube-system)"]
    CoreDNS --> ClusterIP["ClusterIP\n10.96.x.x"]
@@@

The `nameserver` line points to the ClusterIP of the `kube-dns` Service, which routes to the CoreDNS Pods. The `search` line lists domain suffixes to try in order when a short name is resolved. When your Pod runs `curl web`, the OS first tries `web.default.svc.cluster.local`. CoreDNS recognizes that as a known Service and returns its ClusterIP.

Why does Kubernetes inject this file automatically rather than letting applications configure DNS themselves? Because the CoreDNS ClusterIP is assigned at cluster creation time and differs between clusters. Injecting the file at Pod creation means every workload finds DNS without any application-level configuration.

:::quiz
A Pod in namespace `default` resolves the short name `api`. In what order does the OS try the search domains?

- `api.cluster.local`, then `api.svc.cluster.local`, then `api.default.svc.cluster.local`
- `api.default.svc.cluster.local`, then `api.svc.cluster.local`, then `api.cluster.local`
- It only tries `api.default.svc.cluster.local`

**Answer:** `api.default.svc.cluster.local` first, then `api.svc.cluster.local`, then `api.cluster.local` - the search list is tried in the order it appears in `/etc/resolv.conf`, and the most specific suffix (with namespace) comes first.
:::

## The Full Qualified Domain Name

Every Kubernetes Service has a full name that follows this pattern:

```
<service-name>.<namespace>.svc.cluster.local
```

The `web` Service in the `default` namespace has the FQDN `web.default.svc.cluster.local`. You can use the short name `web` from the same namespace because `default.svc.cluster.local` is appended automatically by the search domain mechanism.

Test the resolution right now using the DNS tool available in the simulator:

```
nslookup kubernetes
```

The `kubernetes` Service is the API server Service that always exists in the `default` namespace. CoreDNS always knows it. The response shows the ClusterIP that `kubernetes.default.svc.cluster.local` resolves to.

Now try the FQDN directly to confirm both forms are equivalent:

```
nslookup kubernetes.default.svc.cluster.local
```

The returned IP is identical. The short name works as a convenience; the FQDN is always the canonical form.

:::quiz
What is the FQDN of a Service named `payments` in a namespace called `finance`?

- `payments.svc.cluster.local`
- `payments.finance.svc.cluster.local`
- `finance.payments.cluster.local`

**Answer:** `payments.finance.svc.cluster.local` - the pattern is always `<service>.<namespace>.svc.cluster.local`. The first option is missing the namespace segment; the third reverses the order of service and namespace.
:::

## Short names and cross-namespace pitfalls

The search domain list only includes the current namespace. If your Pod is in the `frontend` namespace and tries to reach a Service named `api` in the `backend` namespace, the short name `api` will fail. The OS expands it to `api.frontend.svc.cluster.local`, which does not exist.

:::warning
Short names only resolve within the same namespace. From a different namespace, always use the namespace-qualified name `api.backend` or the full FQDN `api.backend.svc.cluster.local`. This is one of the most frequent DNS mistakes in multi-namespace setups.
:::

Can you figure out what qualified name you would use to reach a Service called `db` from a namespace called `staging`, if `db` lives in `production`? Try resolving it:

```
nslookup db.production
```

CoreDNS expands `db.production` to `db.production.svc.cluster.local`, finds the Service, and returns its ClusterIP.

CoreDNS is what makes Kubernetes networking feel like a stable, named world rather than a sea of floating IPs. It runs as a system component, is configured automatically for every Pod through `/etc/resolv.conf`, and uses search domains to make short names feel natural within a namespace. The FQDN is always the safe fallback when a name must cross namespace boundaries.
