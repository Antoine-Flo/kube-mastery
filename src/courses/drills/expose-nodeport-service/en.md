---
title: Expose Workload Through NodePort
description: Create or fix a NodePort service and verify external node-level exposure.
tag: services_networking
environment: minimal
ckaTargetMinutes: 6
---

## Create namespace `app`

### Solution

```bash
kubectl create namespace app
```

This namespace isolates the workload and service used in the drill.

## Create deployment `webapp` in namespace `app` with image `nginx:1.28`, label `app=webapp`, and containerPort `80`

### Solution

Generate a base manifest quickly:

```bash
kubectl create deployment webapp -n app --image=nginx:1.28 --dry-run=client -o yaml > webapp-deploy.yaml
```

Then edit `webapp-deploy.yaml` so it matches this final manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
        - name: nginx
          image: nginx:1.28
          ports:
            - containerPort: 80
```

```bash
kubectl apply -f webapp-deploy.yaml
```

Reference lesson for recall: <a href="https://kubemastery.com/en/courses/cka/what-is-a-service" target="_blank" rel="noopener noreferrer">What is a Service</a>

The `selector.matchLabels` and `template.metadata.labels` must match exactly.

### Validation

```yaml
- type: clusterResourceExists
  kind: Deployment
  namespace: app
  name: webapp
  onFail: "Le deployment `webapp` n'existe pas dans `app`. Vérifiez que `webapp-deploy.yaml` a bien été appliqué."
- type: clusterFieldEquals
  kind: Deployment
  namespace: app
  name: webapp
  path: '{.spec.template.spec.containers[0].image}'
  value: 'nginx:1.28'
  onFail: "L'image du deployment `webapp` n'est pas `nginx:1.28`. Vérifiez `spec.template.spec.containers[0].image`."
- type: clusterFieldEquals
  kind: Deployment
  namespace: app
  name: webapp
  path: '{.spec.template.spec.containers[0].ports[0].containerPort}'
  value: '80'
  onFail: "Le containerPort de `webapp` n'est pas `80`. Vérifiez `spec.template.spec.containers[0].ports`."
```

## Create service `webapp-nodeport` in namespace `app` with type `NodePort`, port `80`, targetPort `80`, nodePort `30090`

### Solution

Use the deployment container port as `targetPort`:

```bash
kubectl get deployment webapp -n app -o jsonpath='{.spec.template.spec.containers[0].ports[0].containerPort}'
```

Generate a base manifest quickly:

```bash
kubectl expose deployment webapp -n app --name=webapp-nodeport --type=NodePort --port=80 --target-port=80 --dry-run=client -o yaml > webapp-nodeport.yaml
```

Then edit `webapp-nodeport.yaml` so it matches this final manifest:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: webapp-nodeport
  namespace: app
spec:
  type: NodePort
  selector:
    app: webapp
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30090
```

```bash
kubectl apply -f webapp-nodeport.yaml
```

A fixed `nodePort` keeps the expected output deterministic.

### Validation

```yaml
- type: clusterResourceExists
  kind: Service
  namespace: app
  name: webapp-nodeport
  onFail: "Le service `webapp-nodeport` n'existe pas dans `app`. Vérifiez que `webapp-nodeport.yaml` a bien été appliqué."
- type: clusterFieldEquals
  kind: Service
  namespace: app
  name: webapp-nodeport
  path: '{.spec.type}'
  value: 'NodePort'
  onFail: "Le service `webapp-nodeport` n'est pas de type `NodePort`. Vérifiez `spec.type`."
- type: clusterFieldEquals
  kind: Service
  namespace: app
  name: webapp-nodeport
  path: '{.spec.ports[0].port}'
  value: '80'
  onFail: "Le port du service `webapp-nodeport` n'est pas `80`. Vérifiez `spec.ports[0].port`."
- type: clusterFieldEquals
  kind: Service
  namespace: app
  name: webapp-nodeport
  path: '{.spec.ports[0].targetPort}'
  value: '80'
  onFail: "Le targetPort du service `webapp-nodeport` n'est pas `80`. Vérifiez `spec.ports[0].targetPort`."
- type: clusterFieldEquals
  kind: Service
  namespace: app
  name: webapp-nodeport
  path: '{.spec.ports[0].nodePort}'
  value: '30090'
  onFail: "Le nodePort du service `webapp-nodeport` n'est pas `30090`. Vérifiez `spec.ports[0].nodePort`."
- type: clusterFieldEquals
  kind: Service
  namespace: app
  name: webapp-nodeport
  path: '{.spec.selector.app}'
  value: 'webapp'
  onFail: "Le selector du service `webapp-nodeport` n'est pas `app=webapp`. Vérifiez `spec.selector`."
```
