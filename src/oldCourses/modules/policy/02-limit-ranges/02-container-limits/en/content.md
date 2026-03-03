# Container Limit Ranges

In the previous lesson, you saw the big picture of LimitRanges. Now let's focus on the most common and most useful type: **Container limits**. These set defaults, minimums, and maximums for individual containers — ensuring every container in your namespace has predictable resource boundaries.

## How the LimitRanger Works

When you create a Pod, the **LimitRanger admission controller** processes it before it's stored:

1. **Apply defaults:** If a container is missing `limits`, the LimitRange's `default` values are injected. If `requests` are missing, `defaultRequest` values are injected.
2. **Validate:** If the resulting `requests` or `limits` are below `min` or above `max`, the Pod is rejected.

This happens automatically — developers don't need to remember to set resource values every time. The LimitRange acts as a safety net.

## A Complete Container LimitRange

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: container-limits
  namespace: dev
spec:
  limits:
    - type: Container
      min:
        cpu: '50m'
        memory: 64Mi
      max:
        cpu: '1'
        memory: 1Gi
      default:
        cpu: '200m'
        memory: 256Mi
      defaultRequest:
        cpu: '50m'
        memory: 64Mi
```

Here's what each field does:

- **min:** The floor. No container can request less than 50m CPU or 64Mi memory. This prevents Pods from being too small to function.
- **max:** The ceiling. No container can request more than 1 CPU core or 1Gi memory. This prevents any single container from hogging resources.
- **default:** The default `limits` value. Applied when a container doesn't specify limits.
- **defaultRequest:** The default `requests` value. Applied when a container doesn't specify requests.

:::info
The `defaultRequest` and `default` values should be between `min` and `max`. If they're outside those bounds, the LimitRange configuration itself is invalid. Design them to represent a reasonable starting point for most workloads in the namespace.
:::

## Ephemeral Storage Limits

LimitRanges can also constrain ephemeral storage — the temporary disk space containers use for logs, caches, and tmp files:

```yaml
limits:
  - type: Container
    default:
      ephemeral-storage: 1Gi
    max:
      ephemeral-storage: 4Gi
```

This prevents a container from filling up the node's disk with temporary data — a common cause of node instability.

## What Happens When Limits Are Violated

If a container's `requests` or `limits` fall outside the min/max range, the Pod is rejected immediately:

```
Error: pods "big-pod" is forbidden: [maximum cpu usage per Container is 1, but limit is 4]
```

The error message clearly states which limit was exceeded and what the allowed range is.

:::warning
The LimitRanger must be enabled in your cluster (it's enabled by default on most distributions). If defaults aren't being applied, verify with `kubectl api-versions | grep admissionregistration` and check that the LimitRanger admission plugin is active.
:::

## Common Troubleshooting

**"Exceeded maximum":** The container requests or limits are above `max`. Reduce them to fit within the range.

**"Below minimum":** The container requests are below `min`. Increase them or rely on `defaultRequest`.

**"Defaults not applied":** The LimitRanger admission controller may not be enabled, or the LimitRange is in a different namespace. LimitRanges are namespace-scoped — they only apply to Pods in the same namespace.

---

## Hands-On Practice

### Step 1: Create a LimitRange with Container Defaults

```bash
kubectl create namespace dev 2>/dev/null || true
kubectl apply -f - <<EOF
apiVersion: v1
kind: LimitRange
metadata:
  name: container-limits
  namespace: dev
spec:
  limits:
    - type: Container
      min:
        cpu: "50m"
        memory: 64Mi
      max:
        cpu: "1"
        memory: 1Gi
      default:
        cpu: "200m"
        memory: 256Mi
      defaultRequest:
        cpu: "50m"
        memory: 64Mi
EOF
```

### Step 2: Create a Pod Without Specifying Resources

```bash
kubectl run test-pod --image=nginx -n dev
```

The Pod runs even though you didn't specify requests or limits.

### Step 3: Verify Defaults Were Applied

```bash
kubectl get pod test-pod -n dev -o jsonpath='{.spec.containers[0].resources}'
```

You'll see `requests` and `limits` automatically filled in with the LimitRange's defaults.

### Step 4: Clean Up

```bash
kubectl delete pod test-pod -n dev
kubectl delete limitrange container-limits -n dev
```

## Wrapping Up

Container LimitRanges are the most practical governance tool for day-to-day operations. They inject sensible defaults so developers don't have to think about resources for every Pod, and they enforce min/max boundaries to prevent extreme allocations. Combined with ResourceQuotas, they ensure both individual containers and the namespace as a whole stay well-behaved. In the next lesson, we'll look at Pod-level and PVC-level limits.
