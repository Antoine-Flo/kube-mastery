---
seoTitle: 'Kubernetes Internal DNS, CoreDNS, Service Discovery by Name'
seoDescription: 'Learn how CoreDNS enables Pods to discover Services by name instead of IP, and understand the DNS record patterns Kubernetes creates for Services and Pods.'
---

# Internal DNS

In the previous lessons you connected to Services using their ClusterIP. But hardcoding an IP address, even a stable virtual one, is something you should never do. IPs can change when a Service is recreated or when the cluster is rebuilt. There is a better way, and Kubernetes provides it out of the box.

Every cluster runs **CoreDNS**, a DNS server that assigns a stable hostname to every Service. A Pod that wants to reach a Service never needs to look up its IP manually. It just uses the Service name as a hostname and DNS resolves it automatically.

## The DNS Name Format

When you create a Service named `backend` in the `default` namespace, CoreDNS immediately creates a DNS record for it:

```
backend.default.svc.cluster.local
```

This follows a fixed pattern:

```
<service-name>.<namespace>.svc.cluster.local
```

`svc` is a fixed segment that identifies this as a Service record. `cluster.local` is the cluster domain, configurable but almost always left at the default.

@@@
graph LR
    POD["Pod: frontend"]
    DNS["CoreDNS"]
    SVC["Service: backend<br/>ClusterIP: 10.96.4.2"]

    POD -->|"DNS query: backend.default.svc.cluster.local"| DNS
    DNS -->|"A record: 10.96.4.2"| POD
    POD -->|"TCP :80 to 10.96.4.2"| SVC
@@@

The important thing is that you almost never need to write the full name. Kubernetes configures every Pod's `/etc/resolv.conf` with search domains that allow short names to work. A Pod in the `default` namespace can reach `backend.default.svc.cluster.local` by simply writing `backend`. A Pod in a different namespace can use `backend.default`.

## Seeing It in Action

Deploy a backend Service:

```bash
kubectl create deployment backend --image=nginx:1.28
kubectl expose deployment backend --port=80
```

Now run a temporary Pod with a shell to test DNS from inside the cluster:

```bash
kubectl run dns-test --image=busybox:1.36 --restart=Never -it --rm -- /bin/sh
```

This creates a one-shot Pod, drops you into its shell, and deletes it automatically when you exit. From inside, resolve the Service name:

```sh
nslookup backend
```

You should see the ClusterIP returned as the answer. Try the full name:

```sh
nslookup backend.default.svc.cluster.local
```

Same result. Now try reaching it over HTTP:

```sh
wget -qO- http://backend
```

You should see the nginx welcome page. The name `backend` resolved to the ClusterIP, which forwarded the request to one of the backend Pods.

Exit the shell:

```sh
exit
```

:::quiz
A Pod in the `payments` namespace wants to reach a Service named `auth` in the `platform` namespace. Which hostname should it use?

**Try it:** Open a shell in a Pod in a non-default namespace and run `nslookup auth.platform`

**Answer:** `auth.platform` (short form) or the full `auth.platform.svc.cluster.local`. The short name `auth` alone would not work because DNS search domains only auto-expand within the same namespace. Cross-namespace access always requires at least `<service>.<namespace>`.
:::

## Why DNS Over IP

Hostname-based addressing has a concrete operational advantage. When you write `http://backend` in your application code, that name is resolved fresh at runtime, not baked in at build time. If you delete and recreate the backend Service, it gets a new ClusterIP, but DNS still resolves `backend` to whatever the current ClusterIP is. Your frontend code never changes.

Why does Kubernetes use DNS records that point to ClusterIPs rather than directly to Pod IPs? Because the Service layer provides load balancing and health filtering. A DNS record pointing directly to a Pod IP would bypass all of that and return an IP that might be gone in the next minute.

:::quiz
You delete and recreate a Service named `backend`. The new Service gets a different ClusterIP. Your frontend application uses `http://backend` as the URL. Does it break?

**Answer:** No. DNS resolves `backend` to whatever ClusterIP currently exists for a Service with that name in the same namespace. As long as the Service name stays the same, the application does not need to change. This is why hostname-based addressing is so much more resilient than IP-based addressing.
:::

## Debugging DNS Failures

If a Pod cannot resolve a Service name, the problem is almost always one of three things.

First, the Service may not exist or may be in a different namespace than expected. Check with `kubectl get service -A`.

Second, the Pod's DNS configuration may be broken. Inspect `/etc/resolv.conf` from inside the Pod:

```bash
kubectl exec <POD-NAME> -- cat /etc/resolv.conf
```

You should see a `search` line listing `default.svc.cluster.local svc.cluster.local cluster.local` (or the equivalent for the Pod's namespace). If this file is missing or empty, the Pod was started with a broken DNS configuration.

Third, CoreDNS itself may be unhealthy. Check its Pods:

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
```

:::warning
A common mistake is trying to reach a Service from a Pod using `localhost` or a bare hostname that matches a container name. Neither works. `localhost` inside a container refers to the container itself. Container names are not DNS entries. Only Service names are registered in CoreDNS. If you want inter-container communication, the correct address is always the Service name.
:::

Clean up:

```bash
kubectl delete deployment backend
kubectl delete service backend
```

CoreDNS turns every Service name into a stable, resolvable hostname. You write `http://backend`, DNS does the rest. This is the final piece of the networking model: ephemeral Pod IPs are hidden behind Services, Services are reachable by stable name through DNS, and the entire system adapts automatically as Pods come and go beneath the surface.
