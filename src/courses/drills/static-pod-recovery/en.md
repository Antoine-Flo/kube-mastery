---
title: Recover a Static Pod From Manifest Backup
isDraft: true
description: Recreate a missing static workload by restoring its manifest under kubelet watch path.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 8
---

## Check if static workload `static-web` is currently absent

### Solution

```bash
kubectl get pods -n kube-system
```

Confirms incident state before recovery.

## Inspect kubelet static manifest directory

### Solution

```bash
sudo ls /etc/kubernetes/manifests
```

Static pods are sourced directly from manifests in this directory.

## Restore the missing static pod manifest from backup location

### Solution

```bash
sudo cp /opt/static-web.yaml /etc/kubernetes/manifests/static-web.yaml
```

Copying the manifest into the static path triggers kubelet reconciliation.

## Wait for kubelet to create the static pod

### Solution

```bash
kubectl get pods -n kube-system -w
```

The static pod should appear shortly with a node-suffixed name.

## Validate static pod details and node binding

### Solution

```bash
kubectl get pods -n kube-system -o wide
```

Static pods should appear with node-specific naming and stable placement.
