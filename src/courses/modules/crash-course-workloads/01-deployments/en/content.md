---
seoTitle: 'Kubernetes Deployments, ReplicaSets, Updates, Rollbacks'
seoDescription: 'Learn how Kubernetes Deployments manage Pod lifecycle using ReplicaSets, enabling zero-downtime rolling updates and instant rollbacks to previous versions.'
---

# Deployments

You created a bare Pod in the previous module and deleted it. It stayed gone. No process noticed, nothing restarted it, and if the node it ran on had gone offline, the Pod would have disappeared silently with it. That is fine for exploration, but it is not how real applications survive in production.

Imagine your web server crashes at 3am. With a bare Pod, you get paged, you log in, you manually recreate it. A Deployment makes that problem disappear: it continuously watches a group of Pods and ensures the actual count always matches the count you declared. Pod crashes, node failures, and manual deletions all trigger the same response, automatic replacement with no human in the loop.

## The Three-Tier Hierarchy

Before applying anything, look at the structure a Deployment creates:

@@@
graph TB
    DEP["Deployment<br>web-app"]
    RS1["ReplicaSet v1<br>(replicas: 0, kept for rollback)"]
    RS2["ReplicaSet v2<br>(replicas: 3, active)"]
    P1["Pod"]
    P2["Pod"]
    P3["Pod"]

    DEP --> RS1
    DEP --> RS2
    RS2 --> P1
    RS2 --> P2
    RS2 --> P3
@@@

A Deployment does not create Pods directly. It manages **ReplicaSets**, and ReplicaSets manage Pods. The Deployment controller watches your desired state and delegates the actual Pod count to the ReplicaSet beneath it.

Why the extra layer? Rolling updates. When you change the Pod template in a Deployment, Kubernetes creates a **new** ReplicaSet for the new version and scales down the old one gradually. The old ReplicaSet is kept at zero replicas rather than deleted. That is what makes rollbacks instant: there is nothing to rebuild, just a matter of scaling the old ReplicaSet back up.

In day-to-day work, you almost never interact with ReplicaSets directly. But knowing they exist explains the Pod naming pattern you will see: each Pod name contains two hashes, the first identifying its ReplicaSet, the second unique to the Pod itself.

:::quiz
Why does Kubernetes keep the old ReplicaSet at zero replicas after a rolling update instead of deleting it?

**Answer:** Because rollbacks are just a scale operation: scale the old ReplicaSet back up, scale the new one down. No images to rebuild, no templates to reconstruct. Deleting the old ReplicaSet would make rollback as expensive as a full redeployment.
:::

## The Manifest

The Deployment manifest has three fields under `spec` that don't exist on a bare Pod. Build it up field by field.

First, declare how many Pods you want:

```yaml
# illustrative only
spec:
  replicas: 3
```

Then add `selector`, which tells the Deployment which Pods it owns. It uses label selectors, the same mechanism you learned in the Pods module:

```yaml
# illustrative only
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
```

Finally, add `template`, the Pod blueprint. Everything inside it is a standard Pod spec:

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
```

:::warning
The `selector.matchLabels` and the labels inside `spec.template.metadata.labels` must match exactly. If they don't, Kubernetes rejects the Deployment at creation time with a validation error. This is a common mistake when writing manifests by hand.
:::

Here is the complete manifest. Create the file:

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

Apply it and watch the rollout complete:

```bash
kubectl apply -f web-deployment.yaml
kubectl rollout status deployment/web-app
```

The `rollout status` command blocks and prints progress as each replica becomes available. Once it exits, you have three Pods running.


Now observe the naming hierarchy in action:

```bash
kubectl get deployment web-app
kubectl get replicaset -l app=web
kubectl get pods -l app=web
```

:::quiz
Look at the Pod names in the output. How many hash suffixes does each Pod name have, and what does each one represent?

**Try it:** `kubectl get pods -l app=web`

**Answer:** Two suffixes. The first identifies which ReplicaSet owns the Pod. The second is unique to the Pod itself. Together they form a stable, traceable lineage from Deployment to ReplicaSet to Pod.
:::

## What the Controller Does

When you applied the manifest, the API server stored the Deployment object. The Deployment controller, running inside `kube-controller-manager`, detected the new object and created a ReplicaSet. The ReplicaSet controller detected the new ReplicaSet and created three Pods. The scheduler assigned each Pod to a node. The kubelet on each node started the containers. This entire chain completed in seconds with no further input from you.

From that point on, the Deployment controller keeps watching. If one Pod dies, regardless of whether it was a crash, a node reboot, or a manual deletion, the controller sees the count drop and immediately creates a replacement.

Why is the controller watching rather than reacting to events only? Because controllers in Kubernetes are built on a reconciliation loop, not an event queue. The controller continuously compares actual state to desired state and acts to close any gap. This makes it robust to missed events and network partitions.

Now prove it. Copy one Pod name from the previous command, delete it, and immediately watch what the controller does:

```bash
kubectl delete pod <POD-NAME>
kubectl get pods -l app=web --watch
```

You will see the deleted Pod terminate and a new one appear within seconds. Press Ctrl+C once the count is back at three.


:::quiz
A Pod belonging to a Deployment is accidentally deleted. What happens?

- It stays deleted until you recreate it manually
- The Deployment controller creates a replacement automatically
- The ReplicaSet is recreated from scratch

**Answer:** The Deployment controller creates a replacement automatically - The ReplicaSet saw the count drop from 3 to 2 and immediately reconciled to reach 3 again. Manual intervention is never needed as long as the Deployment object exists.
:::

You can verify the Deployment's view of the situation:

```bash
kubectl describe deployment web-app
```

Find the `Replicas` line: it should show `3 desired / 3 updated / 3 total / 3 available`. The `Events` section at the bottom shows when the ReplicaSet was created.

Now clean up:

```bash
kubectl delete deployment web-app
```

This single command deletes the Deployment, its ReplicaSet, and all three Pods. The entire hierarchy, gone in one operation. That is what owning the resource tree means.

Deployments give you durable, self-healing workloads at no operational cost. The next lesson covers the two most common day-two operations: scaling the replica count and releasing a new version of your application.
