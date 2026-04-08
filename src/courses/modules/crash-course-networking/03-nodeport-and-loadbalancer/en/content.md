---
seoTitle: 'Kubernetes NodePort and LoadBalancer Services, External Traffic Exposure'
seoDescription: 'Learn how NodePort and LoadBalancer Services expose your applications to traffic from outside the cluster, and when to use each type.'
---

# NodePort and LoadBalancer

A ClusterIP Service is only reachable from inside the cluster. That is exactly what you want for database connections and internal APIs. But a user-facing application needs to accept traffic from a browser or a mobile client, which are outside the cluster network entirely.

Kubernetes provides two Service types for this: **NodePort**, which opens a port on every cluster node, and **LoadBalancer**, which provisions an external load balancer in front of the cluster. Both build on top of ClusterIP.

## NodePort

A NodePort Service works by reserving a port in the range `30000-32767` on every node in the cluster. Any traffic arriving at `<any-node-IP>:<nodePort>` is forwarded into the Service and then load balanced across the matching Pods, exactly like a ClusterIP Service.

@@@
graph LR
    EXT["External client"]
    N1["Node 1<br/>:30080"]
    N2["Node 2<br/>:30080"]
    SVC["Service<br/>ClusterIP: 10.96.4.2<br/>Port: 80"]
    P1["Pod A"]
    P2["Pod B"]

    EXT -->|"HTTP :30080"| N1
    EXT -->|"HTTP :30080"| N2
    N1 --> SVC
    N2 --> SVC
    SVC --> P1
    SVC --> P2
@@@

The port is the same on every node. A client can hit any node and reach any Pod, regardless of which node the Pod is actually running on. kube-proxy handles the forwarding across nodes internally.

Create a Deployment and expose it with a NodePort Service:

```bash
nano web-deployment.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.28
          ports:
            - containerPort: 80
```

```bash
kubectl apply -f web-deployment.yaml
```

Now the Service:

```bash
nano web-service.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  type: NodePort
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
```

```bash
kubectl apply -f web-service.yaml
```

Inspect the result:

```bash
kubectl get service web
```

The `PORT(S)` column shows `80:30080/TCP`. The first number is the ClusterIP port, the second is the NodePort. Get the node's IP:

```bash
kubectl get nodes -o wide
```

You can now reach the application at `http://<node-IP>:30080` from outside the cluster.

:::quiz
A NodePort Service has `nodePort: 30080`. A client sends a request to node 2 on port 30080, but the Pod it should reach is running on node 1. Does the request succeed?

**Answer:** Yes. kube-proxy on node 2 forwards the request across the cluster network to the Pod on node 1. The client does not need to know which node the Pod is on. The NodePort is consistent across all nodes for exactly this reason.
:::

:::warning
Choosing a `nodePort` value is optional. If you omit it, Kubernetes assigns one randomly from the `30000-32767` range. Setting it explicitly is useful for predictable firewall rules, but it creates a risk: if two Services try to claim the same nodePort, the second one will fail to create. In practice, NodePort is mostly used for development and testing. Do not expose dozens of production services through NodePorts, you will run out of ports and the approach does not scale.
:::

## LoadBalancer

In a cloud environment (AWS, GCP, Azure), the LoadBalancer type extends NodePort by also asking the cloud provider to provision an external load balancer. The load balancer gets a public IP and distributes traffic to the NodePorts on your cluster nodes.

```bash
nano web-lb-service.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-lb
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
```

```bash
kubectl apply -f web-lb-service.yaml
```

```bash
kubectl get service web-lb
```

In a cloud cluster, the `EXTERNAL-IP` column fills in once the cloud provider has provisioned the load balancer, which usually takes 30-60 seconds. In this simulator and in bare-metal clusters without a cloud provider, the external IP stays `<pending>` because there is no cloud API to call.

@@@
graph LR
    INT["Internet"]
    LB["Cloud Load Balancer<br/>Public IP: 34.90.1.5"]
    N1["Node 1<br/>:31234"]
    N2["Node 2<br/>:31234"]
    SVC["Service ClusterIP"]
    P1["Pod"]
    P2["Pod"]

    INT --> LB
    LB --> N1
    LB --> N2
    N1 --> SVC
    N2 --> SVC
    SVC --> P1
    SVC --> P2
@@@

## Choosing the Right Type

The three Service types form a hierarchy. Each type includes the behavior of the one before it.

`ClusterIP` is the default. Internal traffic only. Use it for any service that should not be reachable from outside the cluster: databases, internal APIs, message queues.

`NodePort` extends ClusterIP by also opening a port on each node. Use it for development, local testing with kind or minikube, or when you control the external routing layer yourself.

`LoadBalancer` extends NodePort by also provisioning a cloud load balancer. Use it in production cloud deployments for services that need a stable public IP.

:::quiz
You are running a PostgreSQL database inside your cluster. Which Service type should you use?

- ClusterIP, because the database should only be reachable from inside the cluster
- NodePort, because you might need to connect to it from your laptop for debugging
- LoadBalancer, because it gives the database a stable address

**Answer:** ClusterIP. Databases must never be exposed outside the cluster. If you need to connect from your laptop for debugging, use `kubectl port-forward` instead: it creates a temporary tunnel without changing the Service type or opening any port on the nodes.
:::

Clean up:

```bash
kubectl delete deployment web
kubectl delete service web
kubectl delete service web-lb
```

NodePort and LoadBalancer give you a path from the outside world into your cluster. NodePort is simple and works everywhere. LoadBalancer is the production choice in cloud environments, delegating the external routing to the infrastructure layer. In the next lesson, you will see how Pods find Services by name rather than by IP, using the cluster's internal DNS.
