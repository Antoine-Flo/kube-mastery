---
title: Restore etcd Snapshot With Manifest Rewire
isDraft: true
description: Restore etcd data to a new path and update static manifest wiring safely.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 10
---

## Restore snapshot to a new data directory

### Solution

```bash
ETCDCTL_API=3 etcdctl snapshot restore /opt/etcd-snapshot.db --data-dir=/var/lib/etcd-from-backup
```

This creates restored etcd data in a separate directory to avoid clobbering current data.

## Update etcd static manifest to use restored data directory

### Solution

```bash
sudo sed -i 's|/var/lib/etcd|/var/lib/etcd-from-backup|g' /etc/kubernetes/manifests/etcd.yaml
```

Ensure both command flags and volume hostPath point to the same restored directory.

## Verify manifest now references restored path

### Solution

```bash
grep -n '/var/lib/etcd-from-backup' /etc/kubernetes/manifests/etcd.yaml
```

Quick guardrail check before waiting for restart.

## Wait for etcd static pod restart

### Solution

```bash
kubectl get pods -n kube-system -w
```

Kubelet restarts etcd automatically after manifest change.

## Check etcd pod health after restore

### Solution

```bash
kubectl get pods -n kube-system -o wide
```

etcd pod should return to Running on the control-plane node.

## Validate API responsiveness

### Solution

```bash
kubectl get nodes
```

If etcd restore wiring is correct, API server should respond normally.
