---
title: Check etcd Endpoint Health
isDraft: true
description: Validate etcd health using endpoint checks and control-plane certificates.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 6
---

## Read etcd certificate paths from static manifest

### Solution

```bash
grep -E 'cert-file|key-file|trusted-ca-file' /etc/kubernetes/manifests/etcd.yaml
```

Avoid hardcoded paths by deriving flags from the active manifest.

## Run etcd endpoint health check

### Solution

```bash
ETCDCTL_API=3 etcdctl endpoint health --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key
```

Healthy response confirms etcd is serving requests correctly over TLS.

### Validation

```yaml
- type: clusterListFieldContains
  kind: Node
  path: '{.items[*].kind}'
  value: 'Node'
  onFail: "L'endpoint etcd ne répond pas en état healthy."
```

## List endpoint status details

### Solution

```bash
ETCDCTL_API=3 etcdctl endpoint status --endpoints=https://127.0.0.1:2379 --write-out=table --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key
```

Provides leader, raft term, and DB size info for deeper diagnostics.

## Validate API server is responsive

### Solution

```bash
kubectl get nodes
```

A healthy etcd should align with normal API responsiveness.

### Validation

```yaml
- type: clusterListFieldContains
  kind: Node
  path: '{.items[*].kind}'
  value: 'Node'
  onFail: "L'API server ne répond pas correctement après la vérification etcd."
```

## Check etcd static pod status in kube-system

### Solution

```bash
kubectl get pods -n kube-system
```

Complements endpoint checks with runtime pod state for faster root-cause triage.
