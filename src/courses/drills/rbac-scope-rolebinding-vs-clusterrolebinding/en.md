---
title: Validate RBAC Scope Boundaries
isDraft: true
description: Demonstrate why a ClusterRole bound with RoleBinding stays namespace-scoped.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 8
---

## Create namespace `dev` and ServiceAccount `deploy-bot`

### Solution

```bash
kubectl create namespace dev
kubectl create serviceaccount deploy-bot -n dev
```

Defines the identity to validate throughout the exercise.

## Create ClusterRole for deployment management

### Solution

```bash
kubectl create clusterrole deployment-manager --verb=get,list,create,update,patch --resource=deployments
```

ClusterRole can be reused at namespace scope or cluster scope depending on binding type.

## Bind the ClusterRole only inside namespace `dev`

### Solution

```bash
kubectl create rolebinding deployment-manager-dev --clusterrole=deployment-manager --serviceaccount=dev:deploy-bot -n dev
```

RoleBinding limits permissions to namespace `dev` even when it references a ClusterRole.

## Verify access is granted in `dev`

### Solution

```bash
kubectl auth can-i create deployments -n dev --as=system:serviceaccount:dev:deploy-bot
```

Expected result is `yes` in namespace `dev`.

## Verify access is denied outside `dev`

### Solution

```bash
kubectl auth can-i create deployments -n default --as=system:serviceaccount:dev:deploy-bot
```

Expected result is `no`, proving this binding does not escalate to cluster-wide scope.

## Double-check that cluster-scoped resource access is still blocked

### Solution

```bash
kubectl auth can-i list nodes --as=system:serviceaccount:dev:deploy-bot
```

Expected result is `no` because no ClusterRoleBinding grants cluster-scoped permissions.
