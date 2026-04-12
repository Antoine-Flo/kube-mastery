---
title: Expose Workload Through NodePort
isDraft: true
description: Create or fix a NodePort service and verify external node-level exposure.
tag: services_networking
environment: minimal
ckaTargetMinutes: 6
---

## Extract `webapp` container port from deployment spec

### Solution

```bash
kubectl get deployment webapp -n app -o jsonpath='{.spec.template.spec.containers[0].ports[0].containerPort}'
```

Use this value as `targetPort` to avoid creating a service that points to the wrong container port.

## Create NodePort service with deterministic node port

### Solution

```bash
kubectl expose deployment webapp -n app --name=webapp-nodeport --type=NodePort --port=80 --target-port=8080 --dry-run=client -o yaml > webapp-nodeport.yaml
```

Generate manifest first so you can set an explicit `nodePort` and keep the exercise verifiable.

## Apply the service manifest after setting `nodePort: 30080`

### Solution

```bash
kubectl apply -f webapp-nodeport.yaml -n app
```

A fixed nodePort removes ambiguity and makes post-submit checks deterministic.

## Validate NodePort service contract (type, port, targetPort, nodePort)

### Solution

```bash
kubectl get svc webapp-nodeport -n app -o jsonpath='{.spec.type} {.spec.ports[0].port} {.spec.ports[0].targetPort} {.spec.ports[0].nodePort}'
```

Expected shape is `NodePort 80 8080 30080`.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Service
  namespace: app
  name: webapp-nodeport
  path: '{.spec.ports[0].nodePort}'
  value: '30080'
  onFail: 'Le nodePort doit être `30080`.'
```

## Validate that endpoints are attached to the service

### Solution

```bash
kubectl get endpoints webapp-nodeport -n app -o jsonpath='{.subsets[*].addresses[*].ip}'
```

Endpoint IPs confirm the service is not only defined, but actually routing to running pods.

### Validation

```yaml
- type: clusterFieldNotEmpty
  kind: Endpoints
  namespace: app
  name: webapp-nodeport
  path: '{.subsets[*].addresses[*].ip}'
  onFail: 'Aucun endpoint trouvé pour `webapp-nodeport`.'
```
