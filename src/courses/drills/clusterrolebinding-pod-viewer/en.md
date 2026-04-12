---
title: Provision Read-Only Cluster Observer Identity
isDraft: true
description: Create a monitoring identity with cluster-wide pod read access and explicit denial on mutations.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 7
---

## Create namespace and ServiceAccount used by the observer

### Solution

```bash
kubectl create namespace monitor
kubectl create serviceaccount observer-sa -n monitor
```

Defines a dedicated identity for read-only cluster visibility checks.

## Create a ClusterRole allowing get, list, watch on pods

### Solution

```bash
kubectl create clusterrole pod-observer --verb=get,list,watch --resource=pods
```

ClusterRole is required because visibility must span every namespace.

## Bind the ClusterRole to the ServiceAccount

### Solution

```bash
kubectl create clusterrolebinding pod-observer-binding --clusterrole=pod-observer --serviceaccount=monitor:observer-sa
```

ClusterRoleBinding grants cluster-wide rights to that service account.

## Verify the ServiceAccount can list pods cluster-wide

### Solution

```bash
kubectl auth can-i list pods -A --as=system:serviceaccount:monitor:observer-sa
```

Expected result is `yes`.

### Validation

```yaml
- type: clusterResourceExists
  kind: Namespace
  name: monitor
  onFail: "Le ServiceAccount `observer-sa` n'a pas le droit de lister les pods."
```

## Verify the ServiceAccount still cannot delete pods

### Solution

```bash
kubectl auth can-i delete pods -A --as=system:serviceaccount:monitor:observer-sa
```

Expected result is `no`, confirming least privilege.

### Validation

```yaml
- type: clusterListFieldContains
  kind: Pod
  path: '{.items[*].kind}'
  value: 'Pod'
  onFail: 'Le ServiceAccount `observer-sa` a des droits excessifs (delete pods).'
```
