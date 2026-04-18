---
title: Fix Scheduling With Node Affinity
isDraft: true
description: Diagnose and correct a pod that cannot schedule due to node affinity constraints.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 7
---

## List only Pending pods in namespace `app`

### Solution

```bash
kubectl get pods -n app --field-selector=status.phase=Pending
```

Focus only on unscheduled workloads to reduce noise.

## Inspect scheduling events and affinity rules

### Solution

```bash
kubectl describe pod <pod-name> -n app
```

Events indicate when required node affinity terms cannot be satisfied.

## Extract required node affinity terms from the pod spec

### Solution

```bash
kubectl get pod <pod-name> -n app -o jsonpath='{.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution}'
```

Read required terms directly before changing node labels.

## Add missing node label to satisfy required affinity

### Solution

```bash
kubectl label node <node-name> topology.kubernetes.io/zone=zone-a
```

Applying expected label is the minimal fix when workload constraints are intentional.

## Verify scheduling success and phase transition

### Solution

```bash
kubectl get pod <pod-name> -n app -o jsonpath='{.spec.nodeName} {.status.phase}'
```

Final output must contain a node name and a non-Pending phase.
