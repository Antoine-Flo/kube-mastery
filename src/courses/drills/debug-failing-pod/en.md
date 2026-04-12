---
title: Recover a CrashLooping Workload
isDraft: true
description: Find why `api` is crashing and apply a concrete fix until pods are Ready.
tag: troubleshooting
environment: minimal
ckaTargetMinutes: 6
---

## Identify failing pods for deployment `api` in namespace `app`

### Solution

```bash
kubectl get pods -n app -l app=api
```

This narrows the scope to the workload you need to recover.

## Inspect events and crash reason on one failing pod

### Solution

```bash
kubectl describe pod <pod-name> -n app
```

Use Events to confirm the failure mechanism before changing the deployment.

## Read previous container logs to capture the startup error

### Solution

```bash
kubectl logs <pod-name> -n app --previous
```

In CrashLoopBackOff, previous logs are often the only reliable signal.

## Patch deployment image to a valid version

### Solution

```bash
kubectl set image deployment/api -n app api=nginx:1.27
```

This exercise expects a bad image or tag root cause, update only the failing container image.

## Wait for rollout completion

### Solution

```bash
kubectl rollout status deployment/api -n app
```

Do not stop at patching, wait until Kubernetes confirms a successful rollout.

## Prove workload recovery with Ready replicas

### Solution

```bash
kubectl get deployment api -n app -o jsonpath='{.status.readyReplicas}/{.status.replicas}'
```

A full ready or desired value confirms the fix is effective.

### Validation

```yaml
- type: clusterFieldsEqual
  kind: Deployment
  namespace: app
  name: api
  leftPath: '{.status.readyReplicas}'
  rightPath: '{.status.replicas}'
  onFail: "Le deployment `api` n'a pas toutes ses replicas prêtes."
```
