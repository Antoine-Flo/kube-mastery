---
title: Work Within LimitRange and ResourceQuota
isDraft: true
description: Diagnose admission errors and make pod specs compliant with namespace policies.
tag: troubleshooting
environment: minimal
ckaTargetMinutes: 8
---

## Review namespace quotas and limits

### Solution

```bash
kubectl get resourcequota,limitrange -n team-a
kubectl describe resourcequota -n team-a
```

Start with a compact inventory, then inspect effective hard and used values.

## Try to apply the workload and observe rejection

### Solution

```bash
kubectl apply -f team-a-pod.yaml -n team-a
```

A rejected apply reveals the exact policy violation (requests, limits, or total quota).

## Edit pod resources to satisfy constraints

### Solution

```bash
kubectl edit -f team-a-pod.yaml
```

Reduce requests or limits or add missing fields so the pod is policy-compliant.

## Re-apply corrected manifest

### Solution

```bash
kubectl apply -f team-a-pod.yaml -n team-a
```

Admission should succeed once resource values match namespace policies.

## Validate running state and quota usage impact

### Solution

```bash
kubectl get pods -n team-a
kubectl describe resourcequota -n team-a
```

Final check confirms both successful admission and quota counters moving as expected.
