---
seoTitle: 'Kubernetes ClusterIP Service, Stable VIP, Load Balancing, EndpointSlices'
seoDescription: 'Learn how a ClusterIP Service gives a group of Pods a stable virtual IP and DNS name inside the cluster, enabling reliable inter-service communication.'
---

# ClusterIP

The previous lesson showed that Pod IPs change whenever a Pod is replaced. A ClusterIP Service solves this by placing a stable virtual IP address in front of a group of Pods. The virtual IP never changes, even as the Pods behind it come and go. Every other service in the cluster talks to the virtual IP, not to any individual Pod.

This is the most common Service type and the default when you create one without specifying a type. It is internal only: the ClusterIP is routable within the cluster network, but not from outside.

## How a Service Finds Its Pods

A Service does not maintain a static list of Pod IPs. Instead, it uses a **label selector** to dynamically discover which Pods should receive traffic. kube-proxy on each node watches the API server and continuously updates routing rules to reflect the current set of Pods that match the selector.

@@@
graph LR
CLIENT["Pod: frontend"]
SVC["Service: backend<br/>ClusterIP: 10.96.10.5<br/>Port: 80"]
P1["Pod: backend-abc<br/>10.0.1.3:8080"]
P2["Pod: backend-def<br/>10.0.2.7:8080"]
P3["Pod: backend-ghi<br/>10.0.1.9:8080"]

    CLIENT -->|"TCP :80"| SVC
    SVC -->|"load balanced"| P1
    SVC -->|"load balanced"| P2
    SVC -->|"load balanced"| P3

@@@

The set of Pods a Service routes to is tracked by Kubernetes using **EndpointSlices**. An EndpointSlice is an API object that holds a list of `Pod-IP:port` pairs for a given Service. You can inspect them directly:

```bash
kubectl get endpointslices -l kubernetes.io/service-name=<SERVICE-NAME>
```

Kubernetes labels each EndpointSlice with `kubernetes.io/service-name` so you can filter by Service name. A single Service may have multiple slices when it has many Pods, but for typical workloads you will see just one.

Each entry in a slice is called an **endpoint**: a `Pod-IP:port` pair. When a Pod is deleted, its entry disappears from the slice within seconds. When a new Pod starts and becomes ready, its entry is added. The Service's ClusterIP never moves.

:::info
The older `Endpoints` API (singular, `kubectl get endpoints`) is deprecated as of Kubernetes 1.33. EndpointSlices have been the standard since Kubernetes 1.21 and scale better for large Services. Prefer `kubectl get endpointslices` in all new workflows.
:::

## Writing the Manifest

Create the Deployment first:

```bash
nano backend-deployment.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: api
          image: nginx:1.28
          ports:
            - containerPort: 80
```

```bash
kubectl apply -f backend-deployment.yaml
```

Now create the Service. Build the manifest field by field.

Start with kind and metadata:

```yaml
# illustrative only
apiVersion: v1
kind: Service
metadata:
  name: backend
```

Add `spec.selector` to match the Pods:

```yaml
# illustrative only
spec:
  selector:
    app: backend
```

Add `spec.ports` to define what traffic to accept and where to forward it:

```yaml
# illustrative only
spec:
  selector:
    app: backend
  ports:
    - port: 80
      targetPort: 80
```

`port` is what clients connect to on the Service. `targetPort` is the port on the container that receives the traffic. Here they are both 80, but they can differ. The full manifest:

```bash
nano backend-service.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    app: backend
  ports:
    - port: 80
      targetPort: 80
```

```bash
kubectl apply -f backend-service.yaml
```

## Inspecting the Service

List Services to find the assigned ClusterIP:

```bash
kubectl get service backend
```

The `CLUSTER-IP` column shows the virtual IP. The `PORT(S)` column shows `80/TCP`. Now inspect the EndpointSlice for this Service:

```bash
kubectl get endpointslices -l kubernetes.io/service-name=backend
```

You should see three `IP:80` entries, one per Pod, in the `ENDPOINTS` column. Cross-reference them with:

```bash
kubectl get pods -o wide -l app=backend
```

The IPs in the EndpointSlice match the Pod IPs exactly. Kubernetes built this slice automatically from the label selector.

:::quiz
You add a fourth Pod manually with the label `app: backend`. Does the Service start routing traffic to it?

**Try it:** `kubectl run extra --image=nginx:1.28 --labels=app=backend` then `kubectl get endpointslices -l kubernetes.io/service-name=backend`

**Answer:** Yes. The EndpointSlice for this Service is rebuilt dynamically from the label selector. Any Pod that gains the `app: backend` label and becomes Ready is automatically added to the slice and starts receiving traffic.
:::

## The targetPort and port Distinction

Why does the Service have both `port` and `targetPort`? Because they can be different.

The `port` is what clients use to address the Service. The `targetPort` is what the container actually listens on. A common pattern is to expose a Service on port 80 while the container listens on port 3000:

```yaml
# illustrative only
ports:
  - port: 80
    targetPort: 3000
```

This lets you keep a clean external interface (`port: 80`) without forcing your application to run as root or bind to a privileged port.

:::quiz
A frontend Pod sends a request to `http://backend:80`. The backend container listens on port 3000. The Service has `port: 80` and `targetPort: 3000`. Does the request reach the container?

**Answer:** Yes. The Service accepts traffic on port 80 and forwards it to port 3000 on each backend Pod. The frontend never needs to know what port the container uses internally.
:::

:::warning
If a Pod is running but not receiving traffic from its Service, the first thing to check is the EndpointSlice with `kubectl get endpointslices -l kubernetes.io/service-name=<name>`. An empty `ENDPOINTS` column means the selector matches no ready Pods. Common causes: the label on the Pod does not match the selector exactly (check for typos), or the Pod is not yet `Ready` (its readiness probe is failing).
:::

Now clean up:

```bash
kubectl delete deployment backend
kubectl delete service backend
```

A ClusterIP Service gives a group of Pods a single stable address and load balances traffic across all healthy instances automatically. It is the backbone of service-to-service communication inside a cluster. In the next lesson, you will expose a Service outside the cluster using NodePort and LoadBalancer.
