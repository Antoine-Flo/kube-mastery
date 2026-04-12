---
title: Scale StatefulSet and Verify Stable Identities
isDraft: true
description: Scale a StatefulSet and validate ordered pod names and persistent identities.
tag: storage
environment: minimal
ckaTargetMinutes: 8
---

## Inspect current StatefulSet and pods

### Solution

```bash
kubectl get statefulset,pods -n data
```

Baseline current replica count and pod ordinal names.

## Scale StatefulSet to 3 replicas

### Solution

```bash
kubectl scale statefulset/web -n data --replicas=3
```

StatefulSet scales in ordered fashion (`web-0`, `web-1`, `web-2`).

## Wait for rollout completion

### Solution

```bash
kubectl rollout status statefulset/web -n data
```

Ensures all replicas are updated and ready.

### Validation

```yaml
- type: clusterFieldsEqual
  kind: StatefulSet
  namespace: data
  name: web
  leftPath: '{.status.readyReplicas}'
  rightPath: '{.spec.replicas}'
  onFail: "Le StatefulSet `web` n'a pas ses 3 replicas prêtes."
```

## Verify stable pod identities and order

### Solution

```bash
kubectl get pods -n data -l app=web
```

Pod names should keep deterministic ordinals across restarts.

## Delete a non-zero ordinal pod and verify it comes back with same name

### Solution

```bash
kubectl delete pod web-1 -n data
kubectl get pod web-1 -n data -w
```

StatefulSet identity guarantees recreate the same ordinal instead of a random pod name.

### Validation

```yaml
- type: clusterResourceExists
  kind: Pod
  namespace: data
  name: web-1
  onFail: "Le pod ordinal `web-1` n'existe pas après rescheduling."
```

## Verify per-pod PVCs are created

### Solution

```bash
kubectl get pvc -n data
```

StatefulSet with volumeClaimTemplates should create one PVC per pod ordinal.

### Validation

```yaml
- type: clusterListFieldContains
  kind: PersistentVolumeClaim
  namespace: data
  path: '{.items[*].metadata.name}'
  value: 'web-2'
  onFail: 'Les PVCs attendues pour les pods du StatefulSet ne sont pas toutes créées.'
```
