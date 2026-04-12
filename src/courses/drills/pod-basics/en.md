---
title: Pod Basics
isDraft: true
description: Create a pod with labels and resource constraints, then manage its labels.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 6
---

## Create a namespace called `exercise-01`

### Solution

```bash
kubectl create namespace exercise-01
```

Creates the namespace. All subsequent commands target this namespace with `-n exercise-01`.

## Create a pod named `web` in namespace `exercise-01` with image `nginx:1.27`, labels `app=web` and `tier=frontend`, requests 64Mi memory and 100m CPU, limits 128Mi memory and 250m CPU

### Solution

```bash
kubectl run web -n exercise-01 --image=nginx:1.27 --labels=app=web,tier=frontend --dry-run=client -o yaml > pod.yaml
```

Generates the pod manifest without creating anything. Edit `pod.yaml` to add `resources.requests` and `resources.limits` under `spec.containers[0]`, then apply it.

## Apply the manifest to create the pod

### Solution

```bash
kubectl apply -f pod.yaml
```

Creates the pod from the edited manifest.

## Wait until pod `web` is Ready

### Solution

```bash
kubectl wait --for=condition=Ready pod/web -n exercise-01 --timeout=60s
```

Ready condition is a stronger success criterion than a visual `get` check.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.status.conditions[?(@.type=="Ready")].status}'
  value: 'True'
  onFail: "Le pod `web` n'est pas en état Ready."
```

## Validate labels and resource constraints on the created pod

### Solution

```bash
kubectl get pod web -n exercise-01 -o jsonpath='{.metadata.labels.app} {.metadata.labels.tier} {.spec.containers[0].resources.requests.cpu} {.spec.containers[0].resources.limits.memory}'
```

Expected output should include `web frontend 100m 128Mi`.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.spec.containers[0].resources.requests.cpu}'
  value: '100m'
  onFail: 'Les resources requests/limits du pod `web` ne correspondent pas aux attentes.'
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.spec.containers[0].resources.limits.memory}'
  value: '128Mi'
  onFail: 'Les resources requests/limits du pod `web` ne correspondent pas aux attentes.'
```

## Add a new label `version=v1` to the running pod

### Solution

```bash
kubectl label pod web -n exercise-01 version=v1
```

Adds the `version=v1` label. No restart required, labels are metadata changes only.

## Remove the `tier` label from the pod

### Solution

```bash
kubectl label pod web -n exercise-01 tier-
```

Removes a label by appending a dash to the key. Verify with `--show-labels` afterwards.

## Prove final label state after updates

### Solution

```bash
kubectl get pod web -n exercise-01 -o jsonpath='{.metadata.labels.app} {.metadata.labels.version} {.metadata.labels.tier}'
```

Final state should keep `app` and `version` and remove `tier`.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.metadata.labels.app}'
  value: 'web'
  onFail: 'Les labels finaux attendus (`app=web`, `version=v1`, `tier` supprimé) ne sont pas respectés.'
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.metadata.labels.version}'
  value: 'v1'
  onFail: 'Les labels finaux attendus (`app=web`, `version=v1`, `tier` supprimé) ne sont pas respectés.'
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.metadata.labels.tier}'
  value: ''
  onFail: 'Les labels finaux attendus (`app=web`, `version=v1`, `tier` supprimé) ne sont pas respectés.'
```

## Optional clean up, delete the namespace

### Solution

```bash
kubectl delete namespace exercise-01
```

Deletes the namespace and everything inside it in one command.
