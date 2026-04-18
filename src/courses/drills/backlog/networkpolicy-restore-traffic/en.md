---
title: Recover App Flow After Policy Lockdown
isDraft: true
description: Find which policy blocks `frontend -> backend` and re-open only required traffic.
tag: services_networking
environment: minimal
ckaTargetMinutes: 8
---

## Identify candidate policies affecting backend pods

### Solution

```bash
kubectl get networkpolicy -n app -o name
```

Start from concrete policy names you can inspect and patch.

## Inspect the blocking policy rules

### Solution

```bash
kubectl describe networkpolicy <policy-name> -n app
```

Read podSelector, policyTypes, ingress, and egress rules to find missing allow paths.

## Extract labels for source and destination pods

### Solution

```bash
kubectl get pod <source-pod> -n app --show-labels
kubectl get pod <dest-pod> -n app --show-labels
```

Policy selectors must match actual pod labels, not assumed labels.

## Confirm traffic is currently blocked from source pod

### Solution

```bash
kubectl exec -n app <source-pod> -- nc -zvw3 backend 80
```

A timeout or refusal before the fix validates the scenario is truly broken.

## Apply a minimal allow policy for required traffic

### Solution

```bash
kubectl apply -f allow-frontend-to-backend.yaml
```

Keep the rule intentionally narrow, source app label, destination app label, single TCP port.

## Re-test connectivity and confirm policy fix

### Solution

```bash
kubectl exec -n app <source-pod> -- nc -zvw3 backend 80
kubectl exec -n app <source-pod> -- wget -qO- http://backend:80
```

Final validation requires successful TCP connectivity and an HTTP response.
