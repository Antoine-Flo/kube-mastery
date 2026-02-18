# Scaling a Deployment

Your application is running, and three Pods are humming along. But what happens when a marketing campaign drives a traffic spike? Or when it is 3 AM and your service barely sees any requests? This is where **scaling** comes in — adjusting the number of replicas to match demand, like turning a volume knob up or down.

Scaling a Deployment is one of the simplest yet most impactful operations in Kubernetes. You change a number, and the cluster adapts.

## How Scaling Works Under the Hood

When you scale a Deployment, the Deployment controller updates the replica count on the underlying ReplicaSet. The ReplicaSet controller then creates or terminates Pods to match the new desired count.

- **Scaling up**: new Pods are created from the existing Pod template and scheduled onto available nodes.
- **Scaling down**: excess Pods are selected for termination. Kubernetes respects graceful shutdown periods, giving containers time to finish in-flight work before stopping them.

An important detail: **scaling does not trigger a rollout**. No new ReplicaSet is created. The existing ReplicaSet simply adjusts its Pod count. This means scaling is fast, safe, and carries no risk of a version change.

## Manual Scaling with kubectl

The most direct way to scale is with `kubectl scale`. You specify the Deployment name and the desired replica count. The Deployment controller immediately begins creating or terminating Pods to match. The `READY` column in `kubectl get deployment` updates once all new Pods pass their readiness checks.

## Scaling Through the Manifest

Alternatively, you can edit the `spec.replicas` field in your YAML file and reapply, or use `kubectl edit` to modify the live object directly:

```yaml
spec:
  replicas: 5
```

Both approaches produce the same result. The difference is workflow preference — manifest-driven changes are easier to track in version control, while `kubectl scale` is convenient for quick adjustments during development or incidents.

:::warning
Be careful when mixing `kubectl scale` with `kubectl apply`. If you scale to 5 replicas with `kubectl scale` but your manifest still says `replicas: 3`, the next `kubectl apply` will scale you back down to 3. To avoid surprises, choose one management method and stick with it — ideally the manifest-driven approach for production environments.
:::

## Verifying the Scale Operation

After scaling, confirm that the actual Pod count matches your desired count. Use `kubectl get pods -l app=nginx` to see the Pods and `kubectl get deployment` to check the Deployment status. If some Pods remain in `Pending` state, the cluster may not have enough resources to schedule them — run `kubectl describe pod <pod-name>` and check the Events section for messages about insufficient CPU or memory. You can also query the desired replica count programmatically with `kubectl get deployment -o jsonpath`.

## Automatic Scaling with HPA

Manual scaling works well for predictable workloads, but what about traffic that fluctuates throughout the day? The <a target="_blank" href="https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/">Horizontal Pod Autoscaler (HPA)</a> watches metrics like CPU utilization or custom application metrics and adjusts the replica count automatically. When traffic rises, the HPA scales up. When it falls, the HPA scales down.

Think of the HPA as cruise control for your Deployment — you set the target speed (e.g., 50% average CPU utilization) and the system adjusts the throttle (replicas) to maintain it.

:::info
When using an HPA, do not set `spec.replicas` in your Deployment manifest. Let the autoscaler manage the replica count. If both the HPA and the manifest specify replicas, they will conflict, causing unexpected scaling behavior.
:::

Setting up HPA is beyond the scope of this lesson, but keep this concept in mind — it is a natural next step once your application is in production.

---

## Hands-On Practice

### Step 1: Create a deployment

Create `deploy.yaml` with a 3-replica nginx Deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx
          ports:
            - containerPort: 80
```

```bash
nano deploy.yaml
# Paste the YAML above, save and exit
kubectl apply -f deploy.yaml
```

**Observation:** Three nginx Pods are created and scheduled across your cluster.

### Step 2: Scale up with kubectl scale

```bash
kubectl scale deployment/nginx-deployment --replicas=5
```

**Observation:** The Deployment controller immediately begins creating two additional Pods.

### Step 3: Verify the scale-up

```bash
kubectl get deployment nginx-deployment
kubectl get pods -l app=nginx
```

**Observation:** The `READY` column shows `5/5` once all new Pods pass readiness checks. You should see five nginx Pods.

### Step 4: Scale down

```bash
kubectl scale deployment/nginx-deployment --replicas=2
```

**Observation:** Kubernetes selects excess Pods for termination and gracefully shuts them down.

### Step 5: Verify the scale-down

```bash
kubectl get deployment nginx-deployment
kubectl get pods -l app=nginx
```

**Observation:** Only two Pods remain. The `READY` column reflects `2/2`.

### Step 6: Check the replica count programmatically

```bash
kubectl get deployment nginx-deployment -o jsonpath='{.spec.replicas}'
```

**Observation:** The output shows `2` — the current desired replica count.

### Step 7: Clean up

```bash
kubectl delete deployment nginx-deployment
```

**Observation:** The Deployment and all its Pods are removed from the cluster.

---

## Wrapping Up

Scaling adjusts the number of Pods without triggering a rollout or changing your application version. You can scale manually with `kubectl scale`, by editing the manifest, or automatically using the Horizontal Pod Autoscaler. The key pitfall to avoid is mixing imperative commands (`kubectl scale`) with declarative manifests (`kubectl apply`) — pick one approach to prevent accidental overrides. With scaling covered, you are ready to explore one of the most powerful features of Deployments: rolling updates.
