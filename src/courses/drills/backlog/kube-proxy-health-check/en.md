---
title: Recover kube-proxy DaemonSet Health
isDraft: true
description: Diagnose kube-proxy coverage drift and restore daemonset readiness.
tag: troubleshooting
environment: minimal
ckaTargetMinutes: 6
---

## Capture kube-proxy daemonset readiness ratio

### Solution

```bash
kubectl get daemonset kube-proxy -n kube-system -o jsonpath='{.status.numberReady}/{.status.desiredNumberScheduled}'
```

This ratio is the primary measurable health target for this drill.

## Inspect kube-proxy pods with node placement

### Solution

```bash
kubectl get pods -n kube-system -l k8s-app=kube-proxy -o wide
```

Node placement helps identify where coverage is missing.

## Inspect kube-proxy logs on an unhealthy node

### Solution

```bash
kubectl logs -n kube-system <kube-proxy-pod-name>
```

Logs reveal config, CNI, or permissions issues affecting service routing.

## Describe kube-proxy DaemonSet for scheduling or image errors

### Solution

```bash
kubectl describe daemonset kube-proxy -n kube-system
```

Use events to identify pull errors, taint issues, or rollout problems.

## Restart kube-proxy daemonset to recover unhealthy pods

### Solution

```bash
kubectl rollout restart daemonset/kube-proxy -n kube-system
```

A controlled restart is a common remediation when pods are stale or misconfigured.

## Validate daemonset recovery reached full readiness

### Solution

```bash
kubectl rollout status daemonset/kube-proxy -n kube-system
kubectl get daemonset kube-proxy -n kube-system -o jsonpath='{.status.numberReady}/{.status.desiredNumberScheduled}'
```

Final proof is matching ready and desired counts after restart.

### Validation

```yaml
- type: clusterFieldsEqual
  kind: DaemonSet
  namespace: kube-system
  name: kube-proxy
  leftPath: '{.status.numberReady}'
  rightPath: '{.status.desiredNumberScheduled}'
  onFail: "Le DaemonSet kube-proxy n'a pas atteint un état fully ready."
```
