---
title: Labels and Selectors
description: Create a selector mismatch, then fix pod labels so Service endpoints are restored.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 5
comingSoon: true
---

## Restore backend routing for service `nginx-svc` in namespace `default` so it targets pod `nginx`

### Solution

Identify the selector mismatch before changing anything:

```bash
kubectl get svc nginx-svc -n default -o jsonpath='{.spec.selector}'
kubectl get pod nginx -n default --show-labels
```

Apply only the metadata change needed to make pod labels match the service selector:

```bash
kubectl label pod nginx -n default env=production track=stable --overwrite
kubectl wait --for=condition=Ready pod/nginx -n default --timeout=60s
```

Verify backend resolution through endpoint slices:

```bash
kubectl get endpointslices -n default -l kubernetes.io/service-name=nginx-svc -o jsonpath='{.items[*].endpoints[*].targetRef.name}'
```

Keep the fix narrow, do not recreate the pod or service. Use `--overwrite` so the command succeeds if one label already exists. <a href="https://kubemastery.com/en/courses/cka/what-is-a-service" target="_blank" rel="noopener noreferrer">What is a Service</a>

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: default
  name: nginx
  path: '{.metadata.labels.env}'
  value: 'production'
  onFail: "Le pod `nginx` n'a pas le label `env=production`. Vérifiez la commande `kubectl label` avec `--overwrite`."
- type: clusterFieldEquals
  kind: Pod
  namespace: default
  name: nginx
  path: '{.metadata.labels.track}'
  value: 'stable'
  onFail: "Le pod `nginx` n'a pas le label `track=stable`. Vérifiez la commande `kubectl label` avec `--overwrite`."
- type: clusterListFieldContains
  kind: EndpointSlice
  namespace: default
  path: '{.items[*].endpoints[*].targetRef.name}'
  value: 'nginx'
  onFail: "Aucun EndpointSlice lié à `nginx-svc` ne cible le pod `nginx`. Vérifiez que les labels du pod correspondent exactement au selector du service `nginx-svc`."
```

## Optional clean up, delete pod `nginx` and service `nginx-svc`

### Solution

```bash
kubectl delete pod nginx -n default
kubectl delete svc nginx-svc -n default
```

This removes the drill resources without resetting the full environment.
