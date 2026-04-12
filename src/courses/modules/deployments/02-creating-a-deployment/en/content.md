---
seoTitle: 'Create a Kubernetes Deployment, Manifest, kubectl apply, rollout'
seoDescription: 'Learn how to write a Kubernetes Deployment manifest with replicas, selector, and Pod template, apply it, monitor the rollout, and verify the running state.'
---

# Creating a Deployment

You know what a Deployment is and why it exists. Now write one.

The Deployment manifest structure is familiar from ReplicaSets: you declare `replicas`, a `selector`, and a Pod `template`. The difference is `kind: Deployment` and `apiVersion: apps/v1`. The Deployment controller reads those same fields and manages the ReplicaSet on your behalf.

## Building the manifest field by field

Start with `replicas`. This tells the Deployment how many Pods to maintain at all times.

```yaml
# illustrative only
spec:
  replicas: 3
```

Add the `selector`. The Deployment uses this label query to find the Pods it owns. It must match the labels you will put in the Pod template.

```yaml
# illustrative only
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
```

Add the `template`. This is the Pod blueprint: metadata with labels, and a spec listing the containers. The labels here must match the `selector` above exactly.

```yaml
# illustrative only
spec:
  replicas: 3
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
          resources:
            requests:
              cpu: '100m'
              memory: '64Mi'
            limits:
              cpu: '200m'
              memory: '128Mi'
```

Now write the full manifest to a file and apply it:

```bash
nano web-deployment.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
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
          resources:
            requests:
              cpu: '100m'
              memory: '64Mi'
            limits:
              cpu: '200m'
              memory: '128Mi'
```

```bash
kubectl apply -f web-deployment.yaml
```

Three Pods appear on the node. The Deployment created a ReplicaSet, and the ReplicaSet created the Pods. You only wrote the Deployment.

:::warning
If `selector.matchLabels` and `template.metadata.labels` do not match exactly, the API server rejects the Deployment immediately with a validation error. This is the most common mistake when writing Deployment manifests by hand.
:::

## Monitoring the rollout

```bash
kubectl rollout status deployment/web-app
```

This command blocks until all replicas are available. After `kubectl apply`, the Deployment object exists in the API server, but the Pods still need to be scheduled, images pulled, and readiness checks passed. `rollout status` waits for all of that before returning.

Why does this matter? In deployment scripts, you want a reliable signal that your application is actually serving traffic, not just that the API accepted your manifest. `rollout status` is that signal.

:::quiz
Why does `kubectl rollout status` block instead of returning immediately?

**Answer:** Because "applied" and "available" are different states. After `kubectl apply`, the Deployment object exists in the cluster. But the Pods still need to be scheduled, images pulled, and readiness checks passed. `rollout status` waits for all of that to complete, making it a reliable gate in deployment scripts.
:::

## Inspecting the result

```bash
kubectl get deployment web-app
kubectl get replicaset -l app=web
kubectl get pods -l app=web
```

The `kubectl get deployment` output shows four key columns. `READY` shows how many Pods have passed readiness. `UP-TO-DATE` shows how many match the current template. `AVAILABLE` shows how many are ready to serve traffic. After a clean rollout, all four numbers match `replicas`.

```bash
kubectl describe deployment web-app
```

Look at the `Replicas` line: `3 desired / 3 updated / 3 total / 3 available`. Then scroll to the `Events` section to see the sequence of steps the controller took to reach that state.

:::quiz
What is the name of the ReplicaSet that the Deployment created?

**Try it:** `kubectl get replicaset -l app=web`

**Answer:** The ReplicaSet name is `web-app-<hash>`. The hash is a fingerprint of the Pod template. If you change the template and the Deployment creates a new ReplicaSet, the new one gets a different hash reflecting the updated template.
:::

Leave `web-app` running. The next lesson uses it to demonstrate rolling updates.
