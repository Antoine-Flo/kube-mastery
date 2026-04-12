---
seoTitle: 'Kubernetes Named Ports, Decouple Port Numbers in Manifests'
seoDescription: 'Learn how Kubernetes named ports decouple port numbers from manifests, allowing Services, probes, and policies to reference ports by name.'
---

# Named Ports

Suppose your web container listens on port 8080. You decide to change it to port 8443. You update the Deployment, then realize your `web-svc` Service has `targetPort: 8080` and needs updating too. Then you remember a second Service also points to that container. And a readiness probe. By the time you are done, three or four files have changed, and any one of them could have a typo. Named ports eliminate that problem.

Instead of referencing a port by its number, you give the port a name in the container spec and reference that name everywhere else. If the number changes, you update only the container spec. Everything else stays correct automatically.

Build the idea in two steps.

Step 1: naming the port in the container spec. Add a `name` field to the `ports` list in your Pod template:

```yaml
# illustrative only
spec:
  containers:
    - name: web
      image: nginx:1.28
      ports:
        - name: http
          containerPort: 80
```

The `name: http` field assigns a stable label to that port. The name `http` is now a valid reference anywhere that accepts a port value.

Step 2: using the name in the Service instead of the number:

```yaml
# illustrative only
spec:
  ports:
    - port: 80
      targetPort: http # resolves to whatever port is named "http" in the container
```

@@@
graph LR
SVC["Service\ntargetPort: http"]
CONT["Container\nports:\n - name: http\n containerPort: 80"]
SVC -->|"resolves 'http' to 80"| CONT
@@@

The Service no longer stores the number 80. It stores the name `http`. The resolution from name to number happens at runtime, based on whatever `containerPort` the container currently declares under that name.

Now build the full applicable example. Start with the Deployment:

```bash
nano named-deployment.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: named-web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: named-web
  template:
    metadata:
      labels:
        app: named-web
    spec:
      containers:
        - name: web
          image: nginx:1.28
          ports:
            - name: http
              containerPort: 80
```

```bash
kubectl apply -f named-deployment.yaml
```

Now create the Service that references the port by name:

```bash
nano named-svc.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: named-svc
spec:
  selector:
    app: named-web
  ports:
    - port: 80
      targetPort: http
```

```bash
kubectl apply -f named-svc.yaml
kubectl describe service named-svc
```

In the `describe` output, look at the `Endpoints:` field. If it is populated, the Service resolved `targetPort: http` successfully and matched the Pods. The port number 80 appears in the Endpoints, even though the Service manifest never mentioned 80 directly.

:::quiz
Where do you see confirmation that `targetPort: http` was resolved to a real port number?

**Try it:** `kubectl describe service named-svc`

**Answer:** Look at the `Endpoints:` field. It shows `<pod-ip>:80`, meaning the name `http` was resolved to containerPort 80. The `TargetPort:` line also shows `http/TCP`, confirming the name reference is intact rather than replaced by a number.
:::

Now consider what happens when the port number changes. Suppose you update `containerPort: 80` to `containerPort: 8080` in the Deployment and keep the `name: http`. The Service manifest stays exactly as written. After the rollout completes, running `kubectl describe service named-svc` again will show Endpoints at port 8080, because the name `http` now resolves to 8080. One file changed; the Service stayed correct automatically.

:::info
Named ports also work in readiness and liveness probes. Instead of `port: 80` in a probe spec, you write `port: http`. The probe port follows the container port number automatically whenever the name is preserved.
:::

:::warning
Port names must be lowercase alphanumeric and may contain hyphens, but not underscores or uppercase letters. `http` is valid. `http-port` is valid. `http_port` is not valid. Names must also be unique within a container's port list. Kubernetes rejects the Pod spec at admission time if two ports share a name or if the name contains invalid characters.
:::

:::quiz
You change a container's `containerPort` from 80 to 8080 but keep `name: http`. The Service uses `targetPort: http`. What happens?

- The Service breaks because it still resolves `http` to 80
- The Service continues to work: `targetPort: http` resolves to the current port named `http`
- You need to delete and recreate the Service for it to pick up the new port

**Answer:** The Service continues to work - `targetPort: http` is resolved dynamically at runtime to whatever `containerPort` is currently named `http` in the container spec. The Service manifest does not store the number, so it does not need to change.
:::

When does using named ports actually matter in practice? It matters most in larger codebases where a container is targeted by multiple Services, Ingress rules, and health probes. When the port number needs to change due to a security policy, a protocol upgrade, or a conflict, updating one field in one file is far less error-prone than hunting down every reference across the repository. Manifests also become more readable: `targetPort: http` is immediately clear; `targetPort: 8080` requires checking the container spec to understand what that number represents.

Clean up all the resources created in this module:

```bash
kubectl delete deployment named-web
kubectl delete service named-svc
kubectl delete deployment web
kubectl delete service web-svc
```

Services are the networking foundation of Kubernetes: ClusterIP for internal communication, NodePort for direct node-level access, LoadBalancer for cloud-managed external exposure. Named ports make that foundation more resilient by binding Service configuration to a stable name rather than a number that can change. The next module covers DNS, which gives Services discoverable names throughout the cluster without hardcoding any IP address.
