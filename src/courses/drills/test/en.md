---
title: Test
isDraft: true
description: Sanity check, verify validation runner with simple deterministic checks.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 2
---

## Create namespace `drill-test`

### Solution

```bash
kubectl create namespace drill-test
```

Creates an isolated namespace for this test drill.

### Validation

```yaml
- type: clusterResourceExists
  kind: Namespace
  name: drill-test
  onFail: 'Namespace `drill-test` is missing.'
```

## Create pod `web` with image `nginx:1.27` in namespace `drill-test`

### Solution

```bash
kubectl run web -n drill-test --image=nginx:1.27
```

Creates a simple pod with a known image.

### Validation

```yaml
- type: clusterResourceExists
  kind: Pod
  namespace: drill-test
  name: web
  onFail: 'Pod `web` was not found in namespace `drill-test`.'
```

## Wait until pod `web` is Ready in namespace `drill-test`

### Solution

```bash
kubectl wait --for=condition=Ready pod/web -n drill-test --timeout=60s
```

Ensures the pod reaches the Ready state before checks.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: drill-test
  name: web
  path: '{.status.conditions[?(@.type=="Ready")].status}'
  value: 'True'
  onFail: 'Pod `web` is not Ready.'
```

## Optional clean up

### Solution

```bash
kubectl delete namespace drill-test
```

Optional cleanup once you finish testing.
