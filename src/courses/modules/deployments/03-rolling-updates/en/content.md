---
seoTitle: 'Kubernetes Rolling Updates, set image, maxSurge, maxUnavailable'
seoDescription: 'Learn how Kubernetes Deployments perform zero-downtime rolling updates by creating a new ReplicaSet, and how maxSurge and maxUnavailable control the rollout pace.'
---

# Rolling Updates

Your `web-app` Deployment has three Pods running `nginx:1.28`. You want to release `nginx:1.26`. With a ReplicaSet, you would delete all Pods and accept the downtime. With a Deployment, you change one line and Kubernetes handles the rest: new Pods replace old ones one at a time, always keeping the application running.

## Triggering an update

If `web-app` is not running from the previous lesson, recreate it first:

```bash
kubectl apply -f web-deployment.yaml
```


Then change the image:

```bash
kubectl set image deployment/web-app web=nginx:1.26
kubectl rollout status deployment/web-app
```

Watch `rollout status` report each step as new Pods become ready and old ones terminate. When it exits cleanly, the update is complete.

## What happens internally

The Deployment controller does not modify the existing ReplicaSet. It creates a new one for `nginx:1.26`, then scales the two ReplicaSets in alternating steps until the old one reaches zero.

@@@
sequenceDiagram
    participant DEP as Deployment controller
    participant RS1 as ReplicaSet v1 (nginx:1.28)
    participant RS2 as ReplicaSet v2 (nginx:1.26)
    DEP->>RS2: create new ReplicaSet
    RS2->>RS2: +1 Pod, wait Ready
    RS1->>RS1: -1 Pod
    RS2->>RS2: +1 Pod, wait Ready
    RS1->>RS1: -1 Pod
    RS2->>RS2: +1 Pod, wait Ready
    RS1->>RS1: -1 Pod
    Note over RS1: replicas: 0 (kept for rollback)
    Note over RS2: replicas: 3 (active)
@@@

At each step, a new Pod becomes Ready before an old one is terminated. Traffic is always served by healthy Pods. This is what "zero-downtime" means in practice: the application never fully stops.

After the rollout, check the ReplicaSets:

```bash
kubectl get replicaset -l app=web
```

Two ReplicaSets: one at 3 replicas (active), one at 0 (preserved for rollback). Their hashes differ because they represent different Pod templates.

:::quiz
Why does Kubernetes create a new ReplicaSet instead of modifying Pods in place?

**Answer:** Because modifying a running Pod in place is not possible for most spec fields, they are immutable after creation. And even if it were possible, it would not give you rollback capability. A separate ReplicaSet for each version means you can always scale an old version back up without rebuilding anything.
:::

## Updating via the manifest

`kubectl set image` is quick but it changes the cluster without touching your file. A better approach is to edit the manifest and re-apply:

```bash
nano web-deployment.yaml
```

Change the image to `nginx:1.25`, then:

```bash
kubectl apply -f web-deployment.yaml
kubectl rollout status deployment/web-app
```

The file now reflects what is running. In a team setting, the manifest is the source of truth, not the cluster state.

:::warning
`kubectl set image` is imperative and does not update your YAML file. After running it, `web-deployment.yaml` is out of sync with the cluster. In a team setting this leads to confusion and accidental overwrites. Prefer editing the file and re-applying.
:::

## Controlling the pace with `maxSurge` and `maxUnavailable`

These two fields in the rolling update strategy control how fast and how safely the update proceeds.

```yaml
# illustrative only
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

`maxUnavailable` sets how many Pods can be unavailable at once during the update. A lower value means slower but safer: fewer Pods are out of rotation at any given moment.

`maxSurge` sets how many extra Pods (above `replicas`) can exist during the update. A lower value means less capacity used, which is useful on resource-constrained clusters.

Both default to 25% of `replicas`, rounded down for `maxUnavailable` and up for `maxSurge`.

:::quiz
During a rolling update with `replicas: 4`, `maxUnavailable: 1`, `maxSurge: 1`, what is the maximum number of Pods that can exist simultaneously?

- 4: the desired count is never exceeded during a rolling update
- 5: maxSurge allows one extra Pod above the desired count
- 6: both maxSurge and maxUnavailable add to the total Pod count

**Answer:** 5. `maxSurge` adds one extra above the desired count (4 + 1 = 5). `maxUnavailable` controls the availability floor (at least 3 must be Ready), not the total Pod count.
:::

Leave `web-app` running. The next lesson uses it to demonstrate rollback.
