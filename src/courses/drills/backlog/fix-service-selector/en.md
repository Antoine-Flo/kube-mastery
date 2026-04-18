---
title: Repair Service Routing Without Recreating Pods
isDraft: true
description: Find why `web-svc` has no backend targets and restore routing using a selector-only fix.
tag: services_networking
environment: minimal
ckaTargetMinutes: 6
---

## Confirm `web-svc` has no resolved backend IP before the fix

### Solution

```bash
kubectl get endpoints web-svc -n app -o jsonpath='{.subsets[*].addresses[*].ip}'
```

Empty output confirms routing is broken before you patch the selector.

## Inspect labels on candidate pods

### Solution

```bash
kubectl get pods -n app --show-labels -l app=web
```

Restricting to expected backend pods makes selector mismatch analysis faster.

## Extract current service selector to confirm mismatch

### Solution

```bash
kubectl get svc web-svc -n app -o jsonpath='{.spec.selector}'
```

Read selector as structured data before patching.

## Patch only the selector (keep ports untouched)

### Solution

```bash
kubectl patch svc web-svc -n app --type=merge -p '{"spec":{"selector":{"component":"web"}}}'
```

This repair is intentionally narrow, fix target matching without changing service exposure.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Service
  namespace: app
  name: web-svc
  path: '{.spec.selector.component}'
  value: 'web'
  onFail: "Le selector `component=web` n'est pas appliqué sur `web-svc`."
```

## Validate endpoint addresses are now discovered

### Solution

```bash
kubectl get endpoints web-svc -n app -o jsonpath='{.subsets[*].addresses[*].ip}'
```

If at least one IP is returned, the Service selector now matches live pods.

## Verify final selector and endpoints together

### Solution

```bash
kubectl get svc web-svc -n app -o jsonpath='{.spec.selector}'
kubectl get endpoints web-svc -n app -o jsonpath='{.subsets[*].addresses[*].ip}'
```

Successful result must show corrected selector and non-empty endpoint IPs.

### Validation

```yaml
- type: clusterFieldNotEmpty
  kind: Endpoints
  namespace: app
  name: web-svc
  path: '{.subsets[*].addresses[*].ip}'
  onFail: "Le service `web-svc` n'a toujours aucun endpoint."
```
