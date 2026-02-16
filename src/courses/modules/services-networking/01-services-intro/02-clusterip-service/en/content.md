# ClusterIP Service

When you create a Service without specifying a type, Kubernetes defaults to **ClusterIP** — and for good reason. It's the most common Service type, designed for internal communication between Pods within the cluster.

Think of ClusterIP as an internal phone extension. It works within the building (your cluster), but external callers can't dial it directly. Every internal team can reach it, and it never changes even when people (Pods) move desks.

## How ClusterIP Works

When you create a ClusterIP Service, Kubernetes:

1. Assigns a **virtual IP** from a reserved pool (the "cluster IP")
2. Makes this IP reachable **only from within the cluster**
3. Configures `kube-proxy` on each node to redirect traffic from this IP to the backend Pods

The cluster IP is stable — it doesn't change when Pods are created or destroyed. Traffic sent to this IP is automatically load-balanced across all matching Pods.

```mermaid
flowchart LR
  App["Frontend Pod"] -->|port 80| SVC["ClusterIP Service (10.96.0.15)"]
  SVC -->|port 9376| Pod1["Backend Pod 1"]
  SVC -->|port 9376| Pod2["Backend Pod 2"]
  SVC -->|port 9376| Pod3["Backend Pod 3"]
```

## Creating a ClusterIP Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app.kubernetes.io/name: MyApp
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 9376
```

Since no `type` is specified, this defaults to ClusterIP. The Service:
- Listens on port **80** (what clients connect to)
- Forwards to port **9376** on matching Pods (where the app listens)
- Only works within the cluster — no external access

:::info
If you omit `targetPort`, it defaults to the same value as `port`. So `port: 80` without a `targetPort` means traffic is forwarded to port 80 on the Pods.
:::

## Port vs TargetPort

This is a common source of confusion. Here's the distinction:

- **port** — The port the Service listens on. Clients connect to this port.
- **targetPort** — The port on the Pod where your application actually listens.

They can be different! Your Service can listen on port 80 (standard HTTP) while your app listens on port 9376. The Service translates between them.

## Verifying Your ClusterIP Service

```bash
# See the assigned cluster IP
kubectl describe service my-service

# Check endpoints — which Pods are receiving traffic?
kubectl get endpoints my-service

# Modern alternative: EndpointSlices
kubectl get endpointslices -l kubernetes.io/service-name=my-service
```

The **endpoints** list should contain the IPs of all Pods matching the selector. If it's empty, your selector doesn't match any Pods.

## Headless Services

There's a special variant: setting `clusterIP: None` creates a **headless Service**. It doesn't get a virtual IP and doesn't load-balance. Instead, DNS queries return the individual Pod IPs directly.

Headless Services are used with **StatefulSets**, where you need to address specific Pods by name (like `db-0.mysql.default.svc.cluster.local`).

:::warning
Don't set `clusterIP: None` unless you specifically need direct Pod resolution. Without a virtual IP, there's no load balancing — clients connect directly to individual Pods.
:::

## Wrapping Up

ClusterIP is the default and most common Service type — perfect for internal communication between Pods. It provides a stable virtual IP with automatic load balancing, reachable only from within the cluster. If you need external access, you'll need NodePort, LoadBalancer, or Ingress — which we'll cover in the next chapters. Up next: Service selectors and how they connect Services to the right Pods.
