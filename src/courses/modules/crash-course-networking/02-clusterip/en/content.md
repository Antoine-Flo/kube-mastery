# ClusterIP: Stable Internal Access

ClusterIP is the default Service type, and the foundation for all other types. It solves the problem you saw in the previous lesson: it provides a stable virtual IP address and DNS name in front of a dynamic group of Pods, so that clients inside the cluster always have a reliable way to reach them, regardless of how many times the Pods are replaced.

The address assigned to a ClusterIP Service is virtual - it doesn't belong to any real network interface on any machine. Instead, every node in the cluster runs `kube-proxy`, which programs the node's kernel networking rules so that traffic sent to the Service's virtual IP is forwarded to one of the healthy backend Pods. This happens transparently, below the level of your application.

:::info
A ClusterIP Service gives your workload a stable internal address. It's not reachable from outside the cluster - it's designed purely for service-to-service communication within the cluster.
:::

## Writing a Service Manifest

The Service manifest is straightforward, but the `selector` field is the piece that does the work:

```yaml
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
  type: ClusterIP
```

The `selector` tells the Service which Pods to route traffic to. Any Pod in the same namespace that has `app: backend` in its labels is automatically included as a backend. When a Pod with that label is created, it immediately starts receiving traffic through the Service. When it's deleted or fails its readiness probe, it's immediately removed from the rotation. You never configure the Service to know about specific Pods - you just tell it which label to match, and Kubernetes handles the rest.

The `port` field is the port the Service listens on. The `targetPort` is the port on the Pod that traffic is forwarded to. These don't have to be the same number, which lets you expose a Service on port 80 even if your container listens on port 3000.

## The Endpoints Object

Behind every Service is an **Endpoints** object that Kubernetes maintains automatically. It contains the current list of Pod IPs and ports that match the Service's selector. You can inspect it to see exactly which Pods are receiving traffic at any moment:

```bash
kubectl get endpoints backend-service
```

When a Pod is replaced and gets a new IP, Kubernetes updates the Endpoints object within seconds. The Service's virtual IP never changes - only the Endpoints behind it do.

## Hands-On Practice

**1. Create the backend Deployment:**

```yaml
# backend.yaml
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
        - name: backend
          image: nginx:1.28
          ports:
            - containerPort: 80
```

```bash
kubectl apply -f backend.yaml
kubectl rollout status deployment/backend
```

**2. Create the Service:**

```yaml
# backend-service.yaml
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
kubectl apply -f backend-service.yaml
kubectl get service backend-service
```

The `CLUSTER-IP` column shows the stable virtual IP assigned to this Service. Note it down - it will remain the same for the lifetime of this Service, regardless of what happens to the Pods.

**3. Inspect the Endpoints:**

```bash
kubectl get endpoints backend-service
```

You should see three IP:port pairs, one for each backend Pod.

**4. Replace a Pod and watch the Endpoints update:**

```bash
kubectl get pods -l app=backend
# Copy one pod NAME, then:
kubectl delete pod <POD-NAME>

sleep 5
kubectl get endpoints backend-service
```

The old Pod's IP has been removed and the replacement Pod's new IP has been added. The Service's `CLUSTER-IP` is unchanged.

**5. Send a request through the Service from inside the cluster:**

```bash
kubectl run curl-test --image=curlimages/curl:8.6.0 --rm -it --restart=Never -- \
  curl -s http://backend-service
```

The request goes to the Service's virtual IP, kube-proxy forwards it to one of the backend Pods, and you see the nginx default page. The client - the curl Pod - never needed to know which Pod it was actually talking to.

**6. Clean up:**

```bash
kubectl delete deployment backend
kubectl delete service backend-service
```
