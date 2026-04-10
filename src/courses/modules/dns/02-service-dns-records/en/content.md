---
seoTitle: 'Kubernetes Service DNS Records, FQDN, Headless, ExternalName'
seoDescription: 'Learn how Kubernetes creates DNS A records for Services, resolve names across namespaces, and understand headless Services and ExternalName CNAME records.'
---

# Service DNS Records

Your `frontend` Pods need to reach an `api` Service living in the `backend` namespace. The `api` ClusterIP changes each time you recreate the Service. You could hardcode the IP in an environment variable, but then every Service recreation breaks all consumers. DNS solves this: the name stays constant even when the IP changes.

Kubernetes automatically registers a DNS A record for every Service the moment it is created. Let's explore what that means in practice.

## A records for ClusterIP Services

When you create a Service, CoreDNS adds an A record mapping the Service FQDN to its ClusterIP. The format is always:

```
<service-name>.<namespace>.svc.cluster.local  ->  ClusterIP
```

@@@
graph LR
    FrontendPod["Pod\n(frontend ns)\nnslookup api.backend"] --> CoreDNS["CoreDNS"]
    CoreDNS --> Record["A record\napi.backend.svc.cluster.local\n-> 10.100.x.x"]
    Record --> ApiSvc["Service api\n(backend ns)"]
@@@

The A record is created automatically. You do not write DNS zone files. You do not restart CoreDNS. Create the Service and the name is immediately resolvable.

Create a simple Service in the simulated cluster:

```bash
kubectl create service clusterip web-svc --tcp=80:80
```

Verify it was created and note its ClusterIP:

```bash
kubectl get service web-svc
```

CoreDNS now knows `web-svc.default.svc.cluster.local`. Resolve the short name:

```
nslookup web-svc
```

Because you are in the `default` namespace, the search domain appends `default.svc.cluster.local` automatically. Try the namespace-qualified form to confirm it is equivalent:

```
nslookup web-svc.default
```

Both return the same ClusterIP. The qualified form `web-svc.default` is the safe pattern when you need to reach this Service from a different namespace.

:::quiz
You create a Service named `cache` in the `infra` namespace. From a Pod in the `app` namespace, which name resolves correctly?

- `cache`
- `cache.infra`
- `cache.svc.cluster.local`

**Answer:** `cache.infra` - it expands to `cache.infra.svc.cluster.local`. The short name `cache` expands to `cache.app.svc.cluster.local`, which does not exist. The third option is missing the namespace segment and would expand to `cache.svc.cluster.local.app.svc.cluster.local`.
:::

## Headless Services

A regular Service has a ClusterIP. DNS resolves the Service name to that single virtual IP and `kube-proxy` handles load balancing from there. But sometimes you need DNS to return the actual Pod IPs directly, without a VIP in between. This is what a headless Service does.

You create a headless Service by setting `clusterIP: None`. CoreDNS then creates A records pointing the Service name to each individual Pod IP that matches the selector.

```yaml
# illustrative only
apiVersion: v1
kind: Service
metadata:
  name: db-headless
spec:
  clusterIP: None
  selector:
    app: db
  ports:
    - port: 5432
```

When your application resolves `db-headless`, it gets back multiple A records, one per matching Pod. This is the mechanism StatefulSets rely on for stable Pod addressing.

Why does Kubernetes offer this? Standard Services hide individual Pods behind a VIP. For stateful workloads like databases, you often need to connect to a specific instance rather than a random one. Headless Services expose all instance IPs through DNS.

:::warning
A headless Service does not perform load balancing. The DNS response returns multiple A records and the client chooses which IP to use. If your application picks the first IP in the list without cycling through the rest, it effectively sends all traffic to one Pod.
:::

:::quiz
What is the key difference between a regular ClusterIP Service and a headless Service in terms of DNS response?

**Answer:** A regular Service returns a single A record pointing to the ClusterIP VIP. A headless Service returns one A record per matching Pod IP. There is no VIP; the client receives Pod IPs directly and must handle selection itself.
:::

## ExternalName Services

The third type is ExternalName. Instead of an A record pointing to an IP, CoreDNS creates a CNAME record pointing to an external hostname you specify.

@@@
graph LR
    Pod["Pod\nnslookup external-api"] --> CoreDNS["CoreDNS"]
    CoreDNS --> CNAME["CNAME\nexternal-api.default.svc.cluster.local\n-> api.example.com"]
    CNAME --> ExternalDNS["External DNS\napi.example.com -> 1.2.3.4"]
@@@

```yaml
# illustrative only
apiVersion: v1
kind: Service
metadata:
  name: external-api
spec:
  type: ExternalName
  externalName: api.example.com
```

When a Pod resolves `external-api`, CoreDNS returns a CNAME to `api.example.com`. The Pod then resolves that external name through the node's upstream DNS. This pattern lets you reference external services by an in-cluster name, making it easy to swap between an internal and external backend without changing application configuration.

:::quiz
You have an ExternalName Service called `payments` that points to `payments.stripe.com`. A Pod resolves `payments`. What does CoreDNS return?

- An A record with a ClusterIP
- A CNAME record pointing to `payments.stripe.com`
- Nothing, because ExternalName Services have no DNS entry

**Answer:** A CNAME record pointing to `payments.stripe.com`. CoreDNS does not assign a ClusterIP to ExternalName Services. The Pod follows the CNAME and resolves the external name through the node's upstream DNS resolver.
:::

Kubernetes creates and removes DNS A records automatically as Services are created or deleted. Headless Services and ExternalName Services extend this model for scenarios where a VIP does not fit: direct Pod addressing for stateful workloads, and external service aliasing for integrations outside the cluster.
