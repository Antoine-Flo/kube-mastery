---
seoTitle: 'Kubernetes HPA Scaling Behavior, scaleDown Stabilization Window'
seoDescription: 'Learn how to configure Kubernetes HPA scale-up and scale-down behavior, stabilization windows, and policies to prevent flapping and control scaling speed.'
---

# HPA Stabilization and Behavior

The default HPA scales up aggressively and scales down conservatively. This is intentional: scaling up quickly prevents outages, scaling down slowly prevents thrashing (rapidly adding and removing Pods). But the defaults may not be right for your workload. The `behavior` field gives you precise control over how fast and how much the HPA scales in each direction.

## The default behavior

```bash
kubectl describe hpa <name>
```

Look at the `Conditions` section. You may see a message like `the desired count is less than the minimum count` or `the desired count has not changed for enough time`. The HPA has a built-in stabilization window before it acts on scale-down decisions.

By default:
- **Scale up**: the HPA can double the replica count every 15 seconds, or add at most 4 Pods in 15 seconds, whichever is larger. This allows rapid response to traffic spikes.
- **Scale down**: the HPA waits 5 minutes (300 seconds) after the last metric reading that would suggest fewer replicas. This prevents flapping when metrics oscillate.

## Configuring custom behavior

```bash
nano hpa-behavior.yaml
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hpa-with-behavior
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hpa-demo
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60
      selectPolicy: Max
```

@@@
graph TB
SU["scaleUp\nstabilizationWindow: 0s\nno delay before scaling up\npolicy: max(100% or +4 pods) / 15s"]
SD["scaleDown\nstabilizationWindow: 300s\nwait 5min before scaling down\npolicy: max 25% reduction / 60s"]
SU --> UP["Traffic spike:\nscales quickly"]
SD --> DOWN["Traffic drop:\nscales slowly"]
@@@

## Understanding stabilization windows

`stabilizationWindowSeconds` defines how long the HPA looks back when deciding whether to scale. For scale-down, it considers the maximum recommended replica count over the last N seconds. This prevents a temporary dip from triggering a scale-down that would leave you short when the spike resumes.

Setting `scaleDown.stabilizationWindowSeconds: 0` means the HPA acts immediately on every metric reading. This is appropriate for batch workloads where you want fast scale-down to reduce cost. It is risky for web services: a brief metric drop can trigger a scale-down, and the scale-up takes time, causing a temporary capacity gap.

## Understanding policies

Each policy specifies a maximum change per period:

- `type: Pods, value: 4, periodSeconds: 15`: add at most 4 Pods every 15 seconds
- `type: Percent, value: 50, periodSeconds: 60`: increase by at most 50% every 60 seconds

Multiple policies can be defined. The `selectPolicy` field determines which one to apply:
- `Max`: use the policy that allows the largest change (scale faster)
- `Min`: use the policy that allows the smallest change (scale more conservatively)

:::quiz
An HPA has two scaleUp policies: `Pods: 2 per 15s` and `Percent: 100 per 15s`. Current replicas: 1. `selectPolicy: Max`. How many replicas can be added in the first 15 seconds?

**Answer:** 1 Pod (100% of 1 = 1). The Percent policy allows 100% increase (1 Pod) and the Pods policy allows 2. The Max selector picks the higher of the two, which is 2... wait: 100% of 1 replica = 1 Pod. The Pods policy allows adding 2 Pods. Max picks the higher value: 2 Pods can be added in the first 15 seconds.
:::

## The disabled scale-down scenario

Setting `selectPolicy: Disabled` on scaleDown prevents the HPA from ever scaling down:

```yaml
behavior:
  scaleDown:
    selectPolicy: Disabled
```

This is useful when you want manual control over scale-down (e.g., during end-of-year traffic when you want to keep replicas high) while keeping automatic scale-up.

:::warning
A HPA that cannot scale down leaves Pods running after traffic drops. This wastes resources and costs money. `selectPolicy: Disabled` on scaleDown should be a temporary configuration with a plan to re-enable it. Do not make it a permanent setting without explicit capacity justification.
:::

```bash
kubectl delete hpa hpa-with-behavior 2>/dev/null; true
```

:::quiz
You set `scaleDown.stabilizationWindowSeconds: 600`. Metric drops at time 0. The stabilization window prevents scale-down until when?

**Answer:** Until time 600 seconds (10 minutes), IF the metric stays below the target for all 600 seconds. The stabilization window means: "only scale down if, over the last 600 seconds, every metric reading would suggest a lower replica count." A single spike back above target during those 600 seconds resets the window.
:::

Stabilization windows and policies give you control over the speed and volatility of scaling. For production web services, keep the default 300-second scale-down window. Tune scale-up policies based on your startup time and traffic pattern. The next lesson covers VPA.
