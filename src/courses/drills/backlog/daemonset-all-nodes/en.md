---
title: Deploy Node Agent as DaemonSet
isDraft: true
description: Roll out a node agent DaemonSet and verify full node coverage including tainted nodes.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 8
---

## Check node inventory and taints before deployment

### Solution

```bash
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
```

Pre-checking taints helps explain why some nodes may not receive DaemonSet pods.

## Deploy the DaemonSet manifest

### Solution

```bash
kubectl apply -f log-collector-daemonset.yaml -n kube-system
```

Apply the prepared manifest for the `log-collector` DaemonSet.

## Verify DaemonSet desired and ready counts

### Solution

```bash
kubectl get daemonset log-collector -n kube-system
```

DESIRED and READY should converge when scheduling is correct.

## List DaemonSet pods with their assigned nodes

### Solution

```bash
kubectl get pods -n kube-system -l app=log-collector -o wide
```

Confirms per-node placement and highlights missing nodes.

## If any tainted node is missing, add required tolerations to the pod template

### Solution

```bash
kubectl edit daemonset log-collector -n kube-system
```

Editing tolerations in template is more flexible than one fixed patch command.

## Validate final DaemonSet coverage and pod distribution

### Solution

```bash
kubectl get daemonset log-collector -n kube-system
kubectl get pods -n kube-system -l app=log-collector -o wide
```

Final check confirms desired count and real per-node placement.
