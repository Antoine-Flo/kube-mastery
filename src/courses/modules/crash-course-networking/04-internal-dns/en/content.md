# Internal DNS

Even with a stable ClusterIP Service, connecting two applications still requires knowing the Service's IP address. Hardcoding an IP into an environment variable is fragile: if the Service is ever deleted and recreated, it gets a new ClusterIP, and every place that referenced the old one breaks. More fundamentally, it's the kind of coupling that makes systems hard to operate. Kubernetes solves this with a built-in DNS server that gives every Service a predictable, human-readable name that never changes.

:::info
Every Service in Kubernetes automatically receives a DNS name. Pods can reach any Service by name, without knowing its IP address or caring whether it has changed.
:::

## CoreDNS

The DNS service in a Kubernetes cluster is called **CoreDNS**. It runs as a Deployment in the `kube-system` namespace and is itself exposed through a Service - the one you see listed as `kube-dns` when you run `kubectl get services -n kube-system`. Every Pod in the cluster is automatically configured to use CoreDNS as its DNS resolver. When a Pod looks up a hostname, the query goes to CoreDNS, which knows about every Service in the cluster and responds with the corresponding ClusterIP.

## The DNS Name Format

Every Service gets a fully qualified domain name following a predictable pattern:

```
<service-name>.<namespace>.svc.cluster.local
```

For a Service named `backend-service` in the `default` namespace, the full DNS name is `backend-service.default.svc.cluster.local`. That's a mouthful, but in practice you rarely need to type it. Kubernetes configures the DNS resolver inside each Pod with a set of search domains, so that within the same namespace, you can reach the Service with just its name: `backend-service`. From a different namespace, you need at minimum `backend-service.default`.

This is how microservices communicate in Kubernetes. Your application configuration contains names like `http://auth-service`, `postgres://database:5432`, or `redis://cache`. Those names are stable across deployments, across environments (as long as the Service names are consistent), and across Pod replacements. You write them once and they keep working.

## How Pods Know Where to Look

When Kubernetes creates a Pod, it writes a `/etc/resolv.conf` file inside each container that points at CoreDNS:

```
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

The `search` field is what makes short names work. When your application calls `http://backend-service`, the DNS resolver tries `backend-service.default.svc.cluster.local` before trying `backend-service` as a bare hostname, because `default.svc.cluster.local` is listed in the search path. The resolution succeeds, and your application gets the ClusterIP without ever needing to know the full qualified name.

The `ndots:5` option means that any name with fewer than 5 dots is searched against the search domains before being treated as an absolute hostname. This is why short names work seamlessly inside the cluster.

## Hands-On Practice

**1. Create a backend Service:**

```yaml
# backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: nginx:1.28
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: backend
  ports:
    - port: 80
      targetPort: 80
```

```bash
kubectl apply -f backend.yaml
kubectl rollout status deployment/backend
```

**2. Resolve the Service by its short name:**

```bash
kubectl run dns-test --image=busybox:1.36 --rm -it --restart=Never -- \
  nslookup backend-service
```

You'll see the short name resolve to the Service's ClusterIP, and the full qualified name listed in the answer. Notice the resolved address matches what `kubectl get service backend-service` shows.

**3. Resolve it using the full qualified domain name:**

```bash
kubectl run dns-test2 --image=busybox:1.36 --rm -it --restart=Never -- \
  nslookup backend-service.default.svc.cluster.local
```

Same result - both names resolve to the same ClusterIP. The short name just relies on the search domains configured in `/etc/resolv.conf`.

**4. Make an HTTP request using only the DNS name:**

```bash
kubectl run curl-test --image=curlimages/curl:8.6.0 --rm -it --restart=Never -- \
  curl -s http://backend-service
```

The request succeeds - the Pod resolved `backend-service` to the ClusterIP, the ClusterIP forwarded the request to one of the backend Pods, and you received the nginx default page. No IP address anywhere in that interaction.

**5. Read the DNS configuration from inside a Pod:**

```bash
kubectl get pods -l app=backend
# Copy one pod NAME, then:
kubectl exec <POD-NAME> -- cat /etc/resolv.conf
```

You'll see the `nameserver` pointing at the CoreDNS Service, and the `search` domains that make short names work.

**6. Clean up:**

```bash
kubectl delete deployment backend
kubectl delete service backend-service
```
