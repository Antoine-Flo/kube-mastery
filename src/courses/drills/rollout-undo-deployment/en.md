---
title: Roll Back a Broken Deployment
isDraft: true
description: Use rollout history and rollback commands to recover a failing deployment.
tag: troubleshooting
environment: minimal
ckaTargetMinutes: 7
---

## Capture current deployment availability before rollback

### Solution

```bash
kubectl get deployment api -n app -o jsonpath='{.status.readyReplicas}/{.status.replicas}'
```

This gives you a measurable baseline to compare after rollback.

## Wait for rollout status and capture the failure signal

### Solution

```bash
kubectl rollout status deployment/api -n app
```

Shows whether rollout is progressing or stuck due to image, probe, or config problems.

## Inspect deployment revision history

### Solution

```bash
kubectl rollout history deployment/api -n app
```

Use revision history to locate a known-good target before reverting.

## Identify newest ReplicaSet created by the failing rollout

### Solution

```bash
kubectl get rs -n app --sort-by=.metadata.creationTimestamp -o custom-columns=NAME:.metadata.name,DESIRED:.spec.replicas,READY:.status.readyReplicas
```

The newest ReplicaSet with low readiness usually corresponds to the bad revision.

## Inspect failing pod details before rollback

### Solution

```bash
kubectl describe pod <failing-pod> -n app
```

Read events to confirm root cause (for example invalid image tag or probe failure).

## Roll back to the previous revision

### Solution

```bash
kubectl rollout undo deployment/api -n app
```

Undo re-points the deployment to the previously stable ReplicaSet template.

## Validate successful recovery

### Solution

```bash
kubectl rollout status deployment/api -n app
kubectl get deployment api -n app -o jsonpath='{.status.readyReplicas}/{.status.replicas}'
```

Recovery is valid only if rollout succeeds and ready replicas match desired replicas.
