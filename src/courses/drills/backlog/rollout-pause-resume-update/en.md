---
title: Pause, Update, and Resume a Deployment Rollout
isDraft: true
description: Control rollout flow using pause or resume and validate revision changes.
tag: services_networking
environment: minimal
ckaTargetMinutes: 7
---

## Inspect current deployment and rollout history

### Solution

```bash
kubectl get deployment webapp -n app
kubectl rollout history deployment/webapp -n app
```

Baseline state before changing image and rollout behavior.

## Pause the deployment rollout

### Solution

```bash
kubectl rollout pause deployment/webapp -n app
```

Pause lets you stage multiple spec changes before rollout continues.

## Update the deployment image while paused

### Solution

```bash
kubectl set image deployment/webapp -n app webapp=nginx:1.28
```

Image is updated in spec but pods should not roll until resume.

## Confirm the template image changed before resuming

### Solution

```bash
kubectl get deployment webapp -n app -o jsonpath='{.spec.template.spec.containers[0].image}'
```

This verifies spec update was accepted even though rollout has not progressed yet.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Deployment
  namespace: app
  name: webapp
  path: '{.spec.template.spec.containers[0].image}'
  value: 'nginx:1.28'
  onFail: "Le deployment `webapp` n'utilise pas l'image attendue `nginx:1.28`."
```

## Confirm rollout is paused

### Solution

```bash
kubectl rollout status deployment/webapp -n app
```

Status should indicate deployment is paused or not progressing.

## Resume rollout and wait for completion

### Solution

```bash
kubectl rollout resume deployment/webapp -n app
kubectl rollout status deployment/webapp -n app
```

Resuming triggers pod replacement toward the new revision.

## Verify new revision and running pods

### Solution

```bash
kubectl rollout history deployment/webapp -n app
kubectl get pods -n app -l app=webapp
```

Final validation confirms successful rollout with updated image.

### Validation

```yaml
- type: clusterFieldsEqual
  kind: Deployment
  namespace: app
  name: webapp
  leftPath: '{.status.readyReplicas}'
  rightPath: '{.status.replicas}'
  onFail: "Le rollout n'est pas terminé: toutes les replicas ne sont pas Ready."
```
