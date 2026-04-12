---
title: Schedule a Pod Across Tainted Nodes
isDraft: true
description: Resolve Pending state by reconciling pod tolerations with node taints.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 7
---

## List only Pending pods in namespace `app`

### Solution

```bash
kubectl get pods -n app --field-selector=status.phase=Pending
```

Filter to unscheduled workloads so the root-cause signal is immediate.

## Inspect pod scheduling events

### Solution

```bash
kubectl describe pod <pod-name> -n app
```

Events usually report taint-related rejection such as `had taint ... that the pod didn't tolerate`.

## Check taints on all nodes in structured output

### Solution

```bash
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
```

Structured view is faster than long describe output for taint triage.

## Add a matching toleration to the workload template

### Solution

```bash
kubectl patch deployment <deployment-name> -n app --type='merge' -p '{"spec":{"template":{"spec":{"tolerations":[{"key":"dedicated","operator":"Equal","value":"app","effect":"NoSchedule"}]}}}}'
```

This variant preserves node taint policy and makes the workload explicitly eligible.

## Re-check node assignment after toleration patch

### Solution

```bash
kubectl get pod <pod-name> -n app -o jsonpath='{.spec.nodeName}'
```

A non-empty node name confirms scheduling constraints are now satisfied.

## Confirm final pod phase is no longer Pending

### Solution

```bash
kubectl get pod <pod-name> -n app -o jsonpath='{.status.phase}'
```

Final expected value is `Running` (or `ContainerCreating` if still starting).
