---
seoTitle: 'Kubernetes Scaling and Rolling Updates, replicas, rollout'
seoDescription: 'Learn how to scale Kubernetes Deployments and perform controlled rolling updates, including maxSurge, maxUnavailable, and rollout monitoring.'
---

# Scaling and Rolling Updates

Traffic doubled overnight and your two replicas are struggling. Or the opposite: your team just pushed a new image and five minutes later users are hitting 500 errors. These are the two most common operational moments in the lifecycle of a Deployment: scaling up to meet demand, and recovering from a bad release. Kubernetes makes both safe and fast once you understand the mechanics.

Start with the Deployment from the previous lesson, or create it fresh:

```bash
nano web-deployment.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
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
```

```bash
kubectl apply -f web-deployment.yaml
kubectl rollout status deployment/web-app
```

## Scaling

The fastest way to change the replica count is `kubectl scale`:

```bash
kubectl scale deployment web-app --replicas=4
kubectl get pods -l app=web
```

You should now see four Pods, all running. The Deployment controller detected that the desired count changed from 2 to 4 and immediately told the ReplicaSet to create two more.

:::visualizer
Watch the cluster visualizer: two new Pods appear on the node as the ReplicaSet scales up.
:::

Scaling down works identically. Setting replicas to one terminates three Pods. The survivor is chosen without preference: there is no concept of a "primary" Pod in a Deployment.

Why prefer editing the manifest file over `kubectl scale`? Because if you scale imperatively and then later re-apply the manifest, the replica count in the file will override what you set. Your manifest becomes a lie. Keep the file as the source of truth and re-apply it when you want to change the count. That way your git history reflects what is actually running.

:::quiz
You run `kubectl scale deployment web-app --replicas=5`, then later run `kubectl apply -f web-deployment.yaml` where `replicas: 2`. What is the replica count after the apply?

- 5: the higher count wins
- 2: the manifest always overrides imperative changes
- An error is thrown because of the conflict

**Answer:** 2. The manifest always overrides imperative changes. `kubectl apply` sends the full desired state to the API server. The `replicas: 2` in the file replaces whatever value was set before.
:::

## Rolling Updates

Releasing a new version is triggered by changing the Pod template in the Deployment, most commonly the container image. You can do this imperatively:

```bash
kubectl set image deployment/web-app web=nginx:1.26
```

Or by editing the manifest and re-applying it, which is the better approach for production because it keeps your files synchronized with what is running.

Instead of taking down all Pods simultaneously and causing an outage, Kubernetes uses a rolling strategy. Here is what happens step by step:

@@@
sequenceDiagram
    participant RS1 as ReplicaSet v1<br/>(nginx:1.28)
    participant RS2 as ReplicaSet v2<br/>(nginx:1.26)

    Note over RS1: replicas: 4
    Note over RS2: replicas: 0

    RS2->>RS2: +1 Pod, wait Ready
    RS1->>RS1: -1 Pod
    Note over RS1,RS2: 3 old · 1 new

    RS2->>RS2: +1 Pod, wait Ready
    RS1->>RS1: -1 Pod
    Note over RS1,RS2: 2 old · 2 new

    RS2->>RS2: +1 Pod, wait Ready
    RS1->>RS1: -1 Pod
    Note over RS1,RS2: 1 old · 3 new

    RS2->>RS2: +1 Pod, wait Ready
    RS1->>RS1: -1 Pod
    Note over RS1: replicas: 0 (kept for rollback)
    Note over RS2: replicas: 4
@@@

A new ReplicaSet starts for the new version. At each step, Kubernetes waits for the new Pod to become Ready before terminating an old one. Traffic is always served by healthy Pods throughout the transition.

The pace of the rollout is controlled by two parameters under `spec.strategy.rollingUpdate`:

```yaml
# illustrative only
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

`maxUnavailable` is how many Pods are allowed to be not Ready at once during the update. `maxSurge` is how many extra Pods above the desired count are allowed to exist during the update. Both default to 25%.

Why does this distinction matter? `maxUnavailable` controls the floor on availability: lower it to reduce disruption. `maxSurge` controls the ceiling on extra capacity: lower it if your cluster is tight on resources. With four replicas, `maxUnavailable: 1` guarantees at least three Pods are serving traffic at all times during the update.

:::quiz
During a rolling update with `replicas: 4`, `maxUnavailable: 1`, and `maxSurge: 1`, what is the maximum total number of Pods that can exist at once?

- 4: the desired count is never exceeded
- 5: maxSurge allows one extra Pod above desired
- 6: maxSurge and maxUnavailable both add capacity

**Answer:** 5. maxSurge allows one extra Pod above the desired count (4 + 1 = 5). maxUnavailable controls availability, not capacity. They are independent levers.
:::

Trigger a rolling update now and watch it progress live:

```bash
kubectl set image deployment/web-app web=nginx:1.26
kubectl rollout status deployment/web-app
```

`rollout status` blocks and prints a message for each replica as it transitions.

:::visualizer
Watch the cluster visualizer: old Pods terminate one by one while new Pods start alongside them. The count never drops below three.
:::

After the rollout completes, inspect the ReplicaSets:

```bash
kubectl get replicasets -l app=web
```

You will see two ReplicaSets: the original at zero replicas and the new one at four. The old one was not deleted.

Now verify every Pod is on the new image. You have what you need from the earlier commands. Find the image for each Pod:

```bash
kubectl get pods -l app=web -o jsonpath='{range .items[*]}{.metadata.name}: {.spec.containers[0].image}{"\n"}{end}'
```

All four should show `nginx:1.26`.

## Rollbacks

:::warning
What happens when a rollout goes wrong? Suppose you update to a bad image that keeps crashing. The rollout stalls: new Pods fail their readiness checks, Kubernetes stops terminating old Pods, and `rollout status` hangs showing "Waiting for deployment to finish." Your old version keeps serving traffic, but you are stuck with broken new Pods alongside working old ones. The fix is a rollback.
:::

Rolling back is immediate:

```bash
kubectl rollout undo deployment/web-app
kubectl rollout status deployment/web-app
```

Under the hood, the old ReplicaSet simply scaled back up while the new one scaled down, using the same rolling strategy. The whole process takes the same time as the original update, not longer.

You can inspect the revision history and target a specific version:

```bash
kubectl rollout history deployment/web-app
kubectl rollout undo deployment/web-app --to-revision=1
```

:::quiz
After rolling back, what do the ReplicaSet replica counts look like?

**Try it:** `kubectl get replicasets -l app=web`

**Answer:** The counts are simply swapped: the original ReplicaSet is back at 4 (or whatever your desired count is), and the newer one is at 0. No images were rebuilt, no templates were recreated: the old ReplicaSet was waiting at zero the whole time.
:::

Clean up when done:

```bash
kubectl delete deployment web-app
```

Scaling and rolling updates are the two operations you will perform most often on running Deployments. Scaling changes the count, rolling updates swap the version with no downtime, and rollbacks are always one command away as long as the old ReplicaSet exists.
