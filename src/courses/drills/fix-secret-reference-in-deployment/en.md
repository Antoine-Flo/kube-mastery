---
title: Repair Deployment Env From Secret
isDraft: true
description: Fix failed startup caused by wrong `secretKeyRef` mapping in deployment env vars.
tag: troubleshooting
environment: minimal
ckaTargetMinutes: 7
---

## Identify failing pods for deployment `api`

### Solution

```bash
kubectl get pods -n app -l app=api
```

Begin by locating pods that are not healthy.

## Describe a failing pod to find secret-related errors

### Solution

```bash
kubectl describe pod <pod-name> -n app
```

Events commonly show `secret not found` or `couldn't find key` messages.

## Inspect available secrets and print decoded key names

### Solution

```bash
kubectl get secrets -n app
kubectl get secret app-secret -n app -o jsonpath='{.data}'
```

Compare existing secret payload keys with what deployment env expects.

## Patch deployment env references to correct secret name or key

### Solution

```bash
kubectl edit deployment api -n app
```

Fix `valueFrom.secretKeyRef` fields to match existing Secret data.

## Wait for rollout and verify recovery

### Solution

```bash
kubectl rollout status deployment/api -n app
kubectl get pods -n app -l app=api
```

Deployment should roll to healthy pods once secret reference is corrected.
