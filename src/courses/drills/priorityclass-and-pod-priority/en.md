---
title: Schedule With PriorityClass
isDraft: true
description: Create a PriorityClass and run a pod using explicit scheduling priority.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 6
---

## Create PriorityClass manifest

### Solution

```bash
kubectl create priorityclass high-priority --value=100000 --global-default=false --description='High priority workloads'
```

Defines scheduler priority used during contention and preemption scenarios.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: app
  name: priority-pod
  path: '{.spec.priorityClassName}'
  value: 'high-priority'
  onFail: 'La PriorityClass `high-priority` est absente.'
```

## Generate pod manifest using that PriorityClass

### Solution

```bash
kubectl run priority-pod -n app --image=nginx:1.27 --dry-run=client -o yaml > priority-pod.yaml
```

Generate base manifest, then set `spec.priorityClassName: high-priority`.

## Apply the pod manifest

### Solution

```bash
kubectl apply -f priority-pod.yaml
```

Creates workload with explicit priority.

## Verify pod has expected class and numeric priority

### Solution

```bash
kubectl get pod priority-pod -n app -o jsonpath='{.spec.priorityClassName} {.spec.priority}'
```

Final check should return `high-priority` and a high numeric value.

### Validation

```yaml
- type: clusterFieldEquals
  kind: Pod
  namespace: app
  name: priority-pod
  path: '{.spec.priorityClassName}'
  value: 'high-priority'
  onFail: "Le pod `priority-pod` n'utilise pas la PriorityClass attendue."
```

## Confirm PriorityClass value and default flag

### Solution

```bash
kubectl get priorityclass high-priority -o jsonpath='{.value} {.globalDefault}'
```

Expected output confirms correct class value and non-default behavior.
