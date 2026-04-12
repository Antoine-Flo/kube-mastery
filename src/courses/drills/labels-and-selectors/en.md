---
title: Labels and Selectors
description: Use labels to make a Service select the intended pods and restore endpoints.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 5
isDraft: true
---

## Inspect `nginx-svc` selector in namespace `app`

### Solution

```bash
kubectl get svc nginx-svc -n app -o jsonpath='{.spec.selector}'
```

Read the selector first so you know which labels must exist on target pods.

## Apply missing labels on pod `nginx` to satisfy the selector

### Solution

```bash
kubectl label pod nginx -n app env=production track=stable --overwrite
```

Use `--overwrite` so the command succeeds even if one label already exists.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: app
  name: nginx
  path: '{.metadata.labels.env}'
  value: 'production'
  onFail: "Le pod `nginx` n'a pas les labels requis (`env=production`, `track=stable`)."
- type: clusterFieldEquals
  kind: Pod
  namespace: app
  name: nginx
  path: '{.metadata.labels.track}'
  value: 'stable'
  onFail: "Le pod `nginx` n'a pas les labels requis (`env=production`, `track=stable`)."
```

## Verify pod selection with the exact selector expected by the service

### Solution

```bash
kubectl get pods -n app -l 'app=nginx,env=production,track=stable'
```

This confirms your label update actually matches the routing contract.

## Validate that service endpoints are now populated

### Solution

```bash
kubectl get endpoints nginx-svc -n app -o jsonpath='{.subsets[*].addresses[*].ip}'
```

Non-empty endpoint IPs prove the selector fix restored traffic routing.

### Validation

```yaml
- type: clusterFieldNotEmpty
  kind: Endpoints
  namespace: app
  name: nginx-svc
  path: '{.subsets[*].addresses[*].ip}'
  onFail: "Le service `nginx-svc` n'a aucun endpoint après mise à jour des labels."
```
