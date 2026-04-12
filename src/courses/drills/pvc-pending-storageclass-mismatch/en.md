---
title: Resolve PVC Pending by Matching Storage Contracts
isDraft: true
description: Diagnose why a claim does not bind and fix class, mode, or size mismatch.
tag: storage
environment: minimal
ckaTargetMinutes: 8
---

## Confirm target claim is Pending before remediation

### Solution

```bash
kubectl get pvc <pvc-name> -n app -o jsonpath='{.status.phase}'
```

Initial state should be `Pending` for this exercise.

## Describe the pending PVC to read binding events

### Solution

```bash
kubectl describe pvc <pvc-name> -n app
```

Events usually state the exact reason, no matching StorageClass, capacity, or access mode.

## Inspect available PV details and storage class names

### Solution

```bash
kubectl get pv -o custom-columns=NAME:.metadata.name,SC:.spec.storageClassName,CAP:.spec.capacity.storage,MODE:.spec.accessModes,STATUS:.status.phase
```

This compact view makes class and mode mismatches obvious before editing the claim.

## Update the PVC so class and requirements match a valid PV

### Solution

```bash
kubectl edit pvc <pvc-name> -n app
```

Apply the minimal correction (for example storageClassName mismatch).

## Verify the claim becomes Bound

### Solution

```bash
kubectl get pvc <pvc-name> -n app -o jsonpath='{.status.phase}'
```

Final expected state value is `Bound`.

## Validate workload recovery using the claim

### Solution

```bash
kubectl get pods -n app
```

Any workload depending on this claim should leave Pending and move to Running.
