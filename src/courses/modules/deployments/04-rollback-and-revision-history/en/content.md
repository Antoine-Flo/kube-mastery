---
seoTitle: 'Kubernetes Deployment Rollback, rollout undo, Revision History'
seoDescription: 'Learn how to roll back a Kubernetes Deployment with kubectl rollout undo, inspect revision history, and understand how revisionHistoryLimit controls cleanup.'
---

# Rollback and Revision History

Your rolling update is halfway done when you notice error rates spiking. The new image has a bug. You need to revert immediately, before all old Pods are replaced. With a Deployment, one command is all it takes.

## Simulating a bad update

Make sure `web-app` is running from the previous lesson. Then push a broken image:

```bash
kubectl set image deployment/web-app web=nginx:1.99
kubectl rollout status deployment/web-app
```

`nginx:1.99` does not exist. The new Pods stay in `ErrImagePull`. Watch what does not happen: the old Pods are not terminated. Traffic is still being served.

:::warning
This is exactly what a rolling update protects against. When new Pods fail to start or fail their readiness checks, Kubernetes stops replacing old Pods. The Deployment is stuck in a partial state but never fully broken. `maxUnavailable` guarantees a minimum number of old Pods always stay up.
:::

## Rolling back immediately

```bash
kubectl rollout undo deployment/web-app
kubectl rollout status deployment/web-app
```

The bad Pods disappear and the healthy Pods return. What happened under the hood: the old ReplicaSet scaled back up to 3, and the broken ReplicaSet scaled back to 0. The same rolling mechanism used for updates ran in reverse. Nothing was rebuilt.

:::quiz
After rolling back, what are the replica counts of the two ReplicaSets?

**Try it:** `kubectl get replicaset -l app=web`

**Answer:** The counts are swapped: the original ReplicaSet is back at 3, the bad one is at 0. No images were rebuilt. The rollback cost was a scale operation.
:::

## Inspecting revision history

```bash
kubectl rollout history deployment/web-app
```

Each line is a revision, numbered in order. Each revision corresponds to a ReplicaSet stored in the cluster. To see what a specific revision contained:

```bash
kubectl rollout history deployment/web-app --revision=1
```

This prints the Pod template for that revision: the image, labels, environment variables, resource limits. You can inspect any stored revision before deciding where to roll back to.

To roll back to a specific revision rather than just the previous one:

```bash
kubectl rollout undo deployment/web-app --to-revision=1
```

## Controlling how many revisions are kept

The `revisionHistoryLimit` field controls how many old ReplicaSets the Deployment keeps. The default is 10.

```yaml
# illustrative only
spec:
  revisionHistoryLimit: 5
```

Setting it to 0 deletes old ReplicaSets immediately after each update, which disables rollback entirely. Think of it like a version control history: more history means more rollback options, but also more objects stored in the cluster.

Why keep old ReplicaSets at all instead of just saving the template somewhere? Because a ReplicaSet already contains everything needed to recreate the Pods. Rolling back is then purely a scale operation. There is no template to reconstruct, no image to re-specify. The Deployment controller already knows exactly what to do.

:::quiz
Why does rolling back feel instant even for large Deployments?

**Answer:** Because the old ReplicaSet was already running at zero replicas, not deleted. Its Pod template is stored in the cluster. Kubernetes simply scales the old ReplicaSet up and the new one down using the same rolling mechanism. There is nothing to reconstruct.
:::

```bash
kubectl delete deployment web-app
```

Rollback is not a special recovery mode. It is the same update mechanism running in the opposite direction, made possible by the fact that old ReplicaSets are preserved. The next lesson covers the two update strategies and when to choose between them.
