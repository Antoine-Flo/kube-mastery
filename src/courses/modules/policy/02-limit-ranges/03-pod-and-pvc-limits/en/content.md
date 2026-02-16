# Pod and PVC Limit Ranges

Container-level limits handle individual containers. But what about a Pod with 10 containers, each requesting 500m CPU? That's 5 CPU cores for a single Pod — potentially more than you'd want. And what about PVCs requesting 1TB of storage when your backend only has 100GB?

**Pod-level** and **PVC-level** LimitRanges address these scenarios.

## Pod-Level Limits

A Pod-level LimitRange sets min/max for the **sum of all containers** in a Pod. Unlike container limits, Pod limits don't set defaults — they only enforce boundaries on the aggregate.

Think of it as a table limit at a restaurant. Each person (container) orders individually, but there's a maximum bill for the entire table (Pod). If the total exceeds the limit, the order is rejected.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: pod-limits
  namespace: dev
spec:
  limits:
    - type: Pod
      max:
        cpu: "4"
        memory: 4Gi
      min:
        cpu: "100m"
        memory: 128Mi
```

With this LimitRange:
- A Pod with three containers requesting 2 CPU each (total: 6 CPU) would be **rejected** — it exceeds the Pod max of 4.
- A Pod with one container requesting 50m CPU would be **rejected** — it's below the Pod min of 100m.

:::info
Pod-level and container-level LimitRanges can coexist in the same namespace. Both are validated independently: a Pod must satisfy container-level limits for each individual container **and** Pod-level limits for the aggregate. This gives you layered control.
:::

## PVC-Level Limits

PVC-level LimitRanges constrain the **storage size** of PersistentVolumeClaims. This prevents users from accidentally (or intentionally) requesting enormous volumes that could exhaust your storage backend:

```yaml
limits:
  - type: PersistentVolumeClaim
    min:
      storage: 1Gi
    max:
      storage: 10Gi
```

With this in place:
- A PVC requesting 500Mi is rejected (below min)
- A PVC requesting 50Gi is rejected (above max)
- A PVC requesting 5Gi is accepted

## Combining Everything in One LimitRange

You can define Pod, Container, and PVC limits in a single LimitRange resource:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: full-limits
  namespace: dev
spec:
  limits:
    - type: Container
      default:
        cpu: "200m"
        memory: 256Mi
      defaultRequest:
        cpu: "50m"
        memory: 64Mi
      max:
        cpu: "1"
        memory: 1Gi
    - type: Pod
      max:
        cpu: "4"
        memory: 4Gi
    - type: PersistentVolumeClaim
      min:
        storage: 1Gi
      max:
        storage: 10Gi
```

This single resource covers all three levels: individual containers get defaults and boundaries, the Pod aggregate is capped, and PVC sizes are constrained.

## Testing the Limits

```bash
# Apply the LimitRange
kubectl apply -f full-limits.yaml

# Check the configured limits
kubectl describe limitrange full-limits -n dev

# Create a Pod and verify container defaults were applied
kubectl run test --image=nginx -n dev
kubectl get pod test -n dev -o jsonpath='{.spec.containers[0].resources}'
```

To test PVC limits:

```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pvc
  namespace: dev
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 5Gi
EOF
kubectl get pvc test-pvc -n dev
```

A 5Gi request fits within the 1Gi-10Gi range, so it's accepted.

:::warning
Pod-level limits don't inject defaults — they only validate. If a Pod's containers have no requests/limits and there's no container-level LimitRange to inject defaults, the Pod may be rejected by the Pod-level validator. Always pair Pod limits with container-level defaults for a smooth experience.
:::

## The Full Governance Picture

With everything we've covered in this chapter, here's how the pieces fit together:

- **LimitRange (Container)** — Defaults and min/max per container
- **LimitRange (Pod)** — Max aggregate per Pod
- **LimitRange (PVC)** — Min/max storage per PVC
- **ResourceQuota** — Total namespace budget for compute and object counts

Together, they ensure that no single object is too big, no namespace is too greedy, and every workload gets sensible resource boundaries.

## Wrapping Up

Pod-level LimitRanges cap the total resources a single Pod can request, regardless of how many containers it has. PVC-level LimitRanges prevent unreasonable storage requests. Combined with container-level defaults and ResourceQuotas, they form a comprehensive governance framework for shared clusters. You now have all the tools to keep namespaces fair, predictable, and well-managed.
