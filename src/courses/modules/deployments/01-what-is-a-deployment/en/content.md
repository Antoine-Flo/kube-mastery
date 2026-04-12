---
seoTitle: 'What Is a Kubernetes Deployment, ReplicaSet, Pod Hierarchy'
seoDescription: 'Understand what a Kubernetes Deployment is, how it wraps a ReplicaSet to add rolling updates and rollback, and the three-tier Deployment to ReplicaSet to Pod hierarchy.'
---

# What Is a Deployment

You ran three Pods with a ReplicaSet. Kubernetes kept them alive when one crashed, and you could scale up or down with a single command. That part worked exactly as expected.

Then you needed to update the image. The only option was to delete all Pods at once, wait for the new ones to start, and accept the downtime. If something went wrong with the new image, there was no history to roll back to. You had to delete and recreate from scratch.

Production teams cannot operate this way. A Deployment solves both problems.

## What a Deployment adds

A Deployment wraps a ReplicaSet and adds an update management layer on top. When you change anything in the Pod template (the image, environment variables, resource limits), the Deployment does not modify the existing ReplicaSet. Instead, it creates a brand-new ReplicaSet for the new version, then gradually shifts Pods from the old ReplicaSet to the new one. Old Pods are terminated only after new ones are ready.

When the update finishes, the old ReplicaSet is not deleted. It stays at zero replicas, preserved in the cluster. That preserved ReplicaSet is your rollback point.

@@@
graph TB
DEP["Deployment: web-app"]
RS1["ReplicaSet v1\nreplicas: 0\n(kept for rollback)"]
RS2["ReplicaSet v2\nreplicas: 3\n(active)"]
P1["Pod"]
P2["Pod"]
P3["Pod"]
DEP --> RS1
DEP --> RS2
RS2 --> P1
RS2 --> P2
RS2 --> P3
@@@

The Deployment controller watches the desired state and delegates the Pod count to its active ReplicaSet. The ReplicaSet then creates and deletes Pods as needed. You interact only with the Deployment, and the rest of the hierarchy follows automatically.

## The three-tier hierarchy

The structure is always: Deployment manages ReplicaSets, ReplicaSets manage Pods. You never create a ReplicaSet directly when using Deployments.

This hierarchy shows up in Pod names. Every Pod owned by a Deployment carries two hashes: `<deploy-name>-<rs-hash>-<pod-hash>`. The first hash is a fingerprint of the Pod template used by that ReplicaSet. The second uniquely identifies the individual Pod within that ReplicaSet.

```bash
kubectl create deployment web --image=nginx:1.28 --replicas=2
```

After the Pods appear, run these commands to see the full hierarchy:

```bash
kubectl get deployment web
kubectl get replicaset -l app=web
kubectl get pods -l app=web
```

Look at the Pod names. The first hash after `web-` is shared by all Pods in this ReplicaSet. That hash changes when you update the image, because a new ReplicaSet is created with a new template fingerprint.

:::quiz
You update a Deployment's image. What happens to the old ReplicaSet once the rollout completes?

- Yes, the old ReplicaSet is deleted immediately after the rollout completes
- No, it is kept at zero replicas to enable instant rollback
- It depends on the `revisionHistoryLimit` setting; by default it is deleted

**Answer:** No, it is kept at zero replicas. `revisionHistoryLimit` controls how many old ReplicaSets are kept (default 10), but the most recent ones are always preserved. Deleting the old ReplicaSet would make rollback impossible.
:::

Why does Kubernetes keep the old ReplicaSet instead of just storing the template somewhere? Because rollback is then a scale operation: scale the old ReplicaSet back up, scale the new one back down. No images are re-pulled, no templates are re-read. It is fast and predictable.

:::quiz
Why does Kubernetes use two hashes in the Pod name instead of just one?

**Answer:** The first hash identifies which ReplicaSet created the Pod, and therefore which version of the Pod template was used. The second uniquely identifies the Pod within that ReplicaSet. Together they make the Pod's lineage fully traceable from its name alone, without looking up any extra objects.
:::

```bash
kubectl delete deployment web
```

A Deployment is the standard way to run stateless workloads in Kubernetes. It gives you update management and rollback on top of everything a ReplicaSet already provides. The next lesson covers how to write a Deployment manifest and apply it to the simulated cluster.
