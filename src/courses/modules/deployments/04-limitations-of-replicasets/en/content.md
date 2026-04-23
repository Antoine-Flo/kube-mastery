---
seoTitle: 'Kubernetes ReplicaSet Limitations and Why Deployments Exist'
seoDescription: 'Learn why updating a Kubernetes ReplicaSet does not restart Pods and how Deployments solve rolling updates, rollback, and zero-downtime deploys.'
---

# Limitations of ReplicaSets

Your application is running on 2 Pods managed by a ReplicaSet. A new version is ready. You update the image in the ReplicaSet manifest and apply it. Then you check the running Pods. Nothing changed. The new image is in the spec. The Pods are still on the old image. You have to delete all Pods manually to trigger a recreation. During that window, zero Pods are running.

That is not a bug. It is a deliberate design decision, and this lesson explains why it exists and what the right tool for the job is.

## Observe the Limitation

Create the ReplicaSet:

```bash
nano rs-demo.yaml
```

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: rs-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo
  template:
    metadata:
      labels:
        app: demo
    spec:
      containers:
        - name: web
          image: nginx:1.27
```

```bash
kubectl apply -f rs-demo.yaml
kubectl get pods -l app=demo -o jsonpath='{.items[0].spec.containers[0].image}'
```

The output is `nginx:1.27`. Good. Now update the image in the manifest:

```bash
nano rs-demo.yaml
```

Change the image line to `nginx:1.28`, then apply:

```bash
kubectl apply -f rs-demo.yaml
kubectl get pods -l app=demo -o jsonpath='{.items[0].spec.containers[0].image}'
```

Still `nginx:1.27`. The ReplicaSet spec was updated. The running Pods were not.

@@@
graph LR
RS["ReplicaSet\ntemplate: nginx:1.28"]
P1["Pod 1\nnginx:1.27\n(still running)"]
P2["Pod 2\nnginx:1.27\n(still running)"]
RS -->|"owns but does not replace"| P1
RS -->|"owns but does not replace"| P2
NOTE["New Pods would use nginx:1.28\nbut existing Pods are not recreated"]
@@@

Why does the controller not replace the running Pods? Because the ReplicaSet was designed to manage count, not version. It creates Pods when there are too few and deletes them when there are too many. It never touches a running Pod that it already owns. Separating these concerns, count in the ReplicaSet, version transitions in a Deployment, keeps each component responsible for exactly one thing.

:::quiz
You update the container image in a ReplicaSet manifest and apply it. The running Pods are still on the old image. What must you do to apply the new image to existing Pods?

- Run `kubectl rollout restart replicaset rs-demo`
- Delete the running Pods manually and let the ReplicaSet recreate them from the new template
- Use `kubectl set image replicaset/rs-demo web=nginx:1.28`

**Answer:** Delete the running Pods manually. `kubectl rollout restart` is a Deployment command, not supported on bare ReplicaSets. `kubectl set image` updates the spec but has the same limitation: it does not replace running Pods. Manual deletion is the only option, which is precisely why you should use Deployments for version-managed workloads.
:::

## The Cost of Manual Updates

The only way to force running Pods to pick up the new template is to delete them:

:::warning
This causes downtime. All Pods are deleted at once. The ReplicaSet recreates them from the updated template, but there is a window where zero Pods are running. The duration depends on how fast the new Pods become ready.
:::

```bash
kubectl delete pods -l app=demo
kubectl get pods -l app=demo -o jsonpath='{.items[0].spec.containers[0].image}'
```

The new Pods are on `nginx:1.28`. But for a moment there were no Pods at all. In production, that is a service outage.

## What Deployments Add

A Deployment wraps a ReplicaSet and adds three capabilities that bare ReplicaSets cannot provide.

@@@
graph TB
DEP["Deployment\nmanages updates, rollbacks, revision history"]
RS1["ReplicaSet v1\nnginx:1.27\nreplicas: 0"]
RS2["ReplicaSet v2\nnginx:1.28\nreplicas: 3"]
DEP --> RS1
DEP --> RS2
@@@

**Rolling updates.** When you update the image in a Deployment, it creates a new ReplicaSet for the new version and progressively scales it up while scaling down the old one. At no point are zero Pods running.

**Rollback.** Old ReplicaSets are kept at zero replicas, not deleted. Rolling back is a scale operation: bring the old one up, bring the new one down. No image to rebuild, no template to reconstruct.

**Revision history.** Each update creates a numbered revision. You can inspect, compare, and roll back to any prior revision.

:::quiz
Why do Deployments keep old ReplicaSets at zero replicas instead of deleting them?

**Answer:** Because rollback is just a scale operation. Scale the old ReplicaSet back up, scale the new one down. If the old ReplicaSet were deleted, rolling back would require recreating it from scratch, which is slower and error-prone. Zero-replica ReplicaSets are cheap to keep and essential when you need to roll back quickly.
:::

## Cleanup

```bash
kubectl delete replicaset rs-demo
```

ReplicaSets are the right primitive for "keep N Pods running." They handle self-healing and scaling reliably. But for real workloads where you need to ship new versions safely and roll back reliably, always use a Deployment. In practice, you will rarely write a ReplicaSet manifest directly. Deployments create them for you. Understanding how ReplicaSets work makes the Deployment layer transparent: when you see the Deployment managing two ReplicaSets during a rollout, you will know exactly what is happening and why.
