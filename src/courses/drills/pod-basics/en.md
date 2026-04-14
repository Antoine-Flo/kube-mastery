---
title: Pod Basics
description: Create a pod with labels and resource constraints, then manage its labels.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 6
isFree: true
---

## Create a namespace called `exercise-01`

### Solution

```bash
kubectl create namespace exercise-01
```

Creates the namespace. All subsequent commands target this namespace with `-n exercise-01`. <a href="https://kubemastery.com/en/courses/common-core/what-are-namespaces" target="_blank" rel="noopener noreferrer">Reference lesson.</a>

## Create pod `web` in namespace `exercise-01` with image `nginx:1.28`, labels `app=web,tier=frontend`, requests `cpu=100m,memory=64Mi`, limits `cpu=250m,memory=128Mi`

### Solution

Generate a base manifest quickly:

```bash
kubectl run web -n exercise-01 --image=nginx:1.28 --labels=app=web,tier=frontend --dry-run=client -o yaml > pod.yaml
```

Then edit `pod.yaml` so it matches this final manifest:

```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: web
    tier: frontend
  name: web
  namespace: exercise-01
spec:
  containers:
    - image: nginx:1.28
      name: web
      resources:
        limits:
          cpu: 250m
          memory: 128Mi
        requests:
          cpu: 100m
          memory: 64Mi
```

```bash
kubectl apply -f pod.yaml
```

This step creates the pod with the expected metadata and resource constraints. <a href="https://kubemastery.com/en/courses/common-core/creating-your-first-pod" target="_blank" rel="noopener noreferrer">Reference lesson.</a>

### Validation

```yaml
- type: clusterResourceExists
  kind: Pod
  namespace: exercise-01
  name: web
  onFail: "Le pod `web` n'existe pas dans `exercise-01`. Vérifiez que `pod.yaml` a bien été appliqué dans le bon namespace."
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.metadata.labels.app}'
  value: 'web'
  onFail: "Le label `app=web` est absent sur le pod `web`. Vérifiez la section `metadata.labels`."
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.metadata.labels.tier}'
  value: 'frontend'
  onFail: "Le label `tier=frontend` est absent sur le pod `web`. Vérifiez la section `metadata.labels`."
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.spec.containers[0].resources.requests.cpu}'
  value: '100m'
  onFail: "La request CPU de `web` n'est pas `100m`. Vérifiez `spec.containers[0].resources.requests`."
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.spec.containers[0].resources.requests.memory}'
  value: '64Mi'
  onFail: "La request mémoire de `web` n'est pas `64Mi`. Vérifiez `spec.containers[0].resources.requests`."
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.spec.containers[0].resources.limits.cpu}'
  value: '250m'
  onFail: "La limit CPU de `web` n'est pas `250m`. Vérifiez `spec.containers[0].resources.limits`."
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.spec.containers[0].resources.limits.memory}'
  value: '128Mi'
  onFail: "La limit mémoire de `web` n'est pas `128Mi`. Vérifiez `spec.containers[0].resources.limits`."
```

## Add label `version=v1` and remove label `tier` from pod `web`

### Solution

```bash
kubectl label pod web -n exercise-01 version=v1
kubectl label pod web -n exercise-01 tier-
```

Labels are mutable metadata, no pod restart is required. <a href="https://kubemastery.com/en/courses/common-core/what-are-labels" target="_blank" rel="noopener noreferrer">Reference lesson.</a>

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.metadata.labels.app}'
  value: 'web'
  onFail: "Le label `app=web` est manquant après mise à jour. Vérifiez les commandes `kubectl label`."
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.metadata.labels.version}'
  value: 'v1'
  onFail: "Le label `version=v1` n'a pas été appliqué. Vérifiez la commande d'ajout du label."
- type: clusterFieldEquals
  kind: Pod
  namespace: exercise-01
  name: web
  path: '{.metadata.labels.tier}'
  value: ''
  onFail: "Le label `tier` existe encore. Vérifiez l'utilisation de `tier-` pour supprimer un label."
```

## Optional clean up, delete the namespace

### Solution

```bash
kubectl delete namespace exercise-01
```

Deletes the namespace and everything inside it in one command.
