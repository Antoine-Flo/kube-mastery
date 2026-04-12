---
title: Fix Pod Creation Blocked by ResourceQuota
isDraft: true
description: Diagnose a forbidden pod admission caused by namespace quota constraints.
tag: troubleshooting
environment: minimal
ckaTargetMinutes: 7
---

## Try to create the workload and capture the error

### Solution

```bash
kubectl apply -f app-pod.yaml -n prod
```

In this scenario the pod creation is expected to fail with a quota-related forbidden message.

## Inspect namespace ResourceQuota

### Solution

```bash
kubectl describe resourcequota -n prod
```

Shows hard limits and current usage that explain the rejection.

## Inspect LimitRange constraints if present

### Solution

```bash
kubectl describe limitrange -n prod
```

LimitRange may enforce min, max, default requests and limits that interact with quota.

## Adjust pod resource requests or limits to fit namespace policy

### Solution

```bash
kubectl edit -f app-pod.yaml
```

Adjust only the fields violating quota or limit range, avoid unrelated spec changes.

## Re-apply workload with corrected resources

### Solution

```bash
kubectl apply -f app-pod.yaml -n prod
```

After adjustment, admission should succeed.

## Verify pod is admitted and starts

### Solution

```bash
kubectl get pods -n prod
```

Final validation confirms quota-compliant scheduling.
