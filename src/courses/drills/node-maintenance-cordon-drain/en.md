---
title: Node Maintenance with Cordon and Drain
isDraft: true
description: Prepare a worker for maintenance, verify evacuation, then restore scheduling capacity.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 7
---

## List nodes with roles and select a worker target

### Solution

```bash
kubectl get nodes -o wide
```

Use a worker node for maintenance to avoid disrupting core control-plane components.

## Mark the target node unschedulable

### Solution

```bash
kubectl cordon <node-name>
```

Cordon prevents new pods from being scheduled to that node.

## Verify node is marked SchedulingDisabled

### Solution

```bash
kubectl get node <node-name> -o jsonpath='{.spec.unschedulable}'
```

Expected value is `true` before drain.

## Drain workloads from the node

### Solution

```bash
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
```

Drain evicts movable pods and is the standard pre-maintenance step.

## Validate only DaemonSet or mirror pods remain on drained node

### Solution

```bash
kubectl get pods -A -o wide --field-selector spec.nodeName=<node-name>
```

After drain, regular workload pods should have moved off the node.

## Return node to schedulable state

### Solution

```bash
kubectl uncordon <node-name>
```

Uncordon re-enables normal scheduling after maintenance.

## Confirm node is Ready and schedulable

### Solution

```bash
kubectl get node <node-name> -o jsonpath='{.status.conditions[?(@.type=="Ready")].status} {.spec.unschedulable}'
```

Final output should show `True` and an empty or false unschedulable flag.
