---
title: Unblock Scheduling for a nodeSelector-Locked Pod
isDraft: true
description: Resolve Pending state caused by a strict nodeSelector mismatch.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 6
---

## List only Pending pods in namespace `app`

### Solution

```bash
kubectl get pods -n app --field-selector=status.phase=Pending
```

This filters directly to unscheduled workloads.

## Describe the pending pod and inspect scheduling events

### Solution

```bash
kubectl describe pod <pod-name> -n app
```

The Events section usually reports node selector mismatch or no matching nodes.

## Extract nodeSelector expected by the pending pod

### Solution

```bash
kubectl get pod <pod-name> -n app -o jsonpath='{.spec.nodeSelector}'
```

Read required selector keys and values before deciding how to fix scheduling.

## Apply the missing label expected by the pod selector

### Solution

```bash
kubectl label node <node-name> topology.kubernetes.io/zone=lab-a
```

This scenario expects you to satisfy the selector by aligning node labels with workload constraints.

## Re-check pod placement

### Solution

```bash
kubectl get pod <pod-name> -n app -o jsonpath='{.spec.nodeName}'
```

A non-empty node name confirms the scheduler accepted the pod.

## Verify scheduler selected a node and the pod left Pending

### Solution

```bash
kubectl get pod <pod-name> -n app -o jsonpath='{.spec.nodeName} {.status.phase}'
```

Successful output shows a node name and `Running` or `ContainerCreating` transition.
