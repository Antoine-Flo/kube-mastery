---
title: Restore RBAC Access for a ServiceAccount
isDraft: true
description: Grant missing permissions using Role and RoleBinding, then verify with `kubectl auth can-i`.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 7
---

## Check current permissions for the ServiceAccount

### Solution

```bash
kubectl auth can-i list pods -n prod --as=system:serviceaccount:prod:app-sa
```

Use an impersonation check first so you can compare before and after behavior.

## Ensure the ServiceAccount exists

### Solution

```bash
kubectl create serviceaccount app-sa -n prod --dry-run=client -o yaml | kubectl apply -f -
```

This idempotent create or apply ensures the bound identity exists.

## Create or update Role granting pod read access

### Solution

```bash
kubectl create role pod-reader --verb=get,list,watch --resource=pods -n prod --dry-run=client -o yaml | kubectl apply -f -
```

Using apply flow keeps the task rerunnable and ensures the role contract is explicit.

## Create or update RoleBinding to connect Role and ServiceAccount

### Solution

```bash
kubectl create rolebinding pod-reader-binding --role=pod-reader --serviceaccount=prod:app-sa -n prod --dry-run=client -o yaml | kubectl apply -f -
```

This guarantees binding exists even when rerunning the drill.

## Validate permissions after the RBAC fix

### Solution

```bash
kubectl auth can-i list pods -n prod --as=system:serviceaccount:prod:app-sa
kubectl auth can-i delete pods -n prod --as=system:serviceaccount:prod:app-sa
```

Final state should grant read access while keeping delete denied.

### Validation

```yaml
- type: clusterResourceExists
  kind: Namespace
  name: prod
  onFail: 'Le ServiceAccount `app-sa` ne peut pas lister les pods.'
```
