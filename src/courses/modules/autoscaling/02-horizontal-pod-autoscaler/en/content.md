---
seoTitle: 'Kubernetes HPA, Horizontal Pod Autoscaler, CPU Memory Scaling'
seoDescription: 'Learn how to create a Kubernetes HPA, configure CPU and memory targets, observe scaling decisions, and understand how the HPA calculates replica counts.'
---

# Horizontal Pod Autoscaler

You set a Deployment to 3 replicas and call it a day. Traffic doubles during peak hours. Your 3 replicas are throttled. Requests queue up. An HPA would have scaled to 6 replicas automatically and then scaled back down when traffic normalized, saving cost outside peak hours.

The HPA watches a Deployment (or StatefulSet or ReplicaSet) and adjusts the replica count to maintain a target metric value. The most common target is CPU utilization: "keep average CPU usage across all Pods below 60%."

## Prerequisites: resource requests and metrics-server

HPA requires two things:
1. **Resource requests on the container**: the HPA calculates utilization as a percentage of the request, not of the node's total CPU. Without a CPU request, the HPA has no baseline.
2. **metrics-server**: the source of CPU and memory metrics.

```bash
kubectl top pods
```

If this command works, metrics-server is running.

## Creating an HPA

First, create a Deployment with resource requests:

```bash
nano hpa-deploy.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hpa-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hpa-demo
  template:
    metadata:
      labels:
        app: hpa-demo
    spec:
      containers:
        - name: app
          image: busybox:1.36
          command: ['sh', '-c', 'sleep 3600']
          resources:
            requests:
              cpu: '100m'
            limits:
              cpu: '500m'
```

```bash
kubectl apply -f hpa-deploy.yaml
```

Now create the HPA targeting 50% CPU utilization:

```bash
kubectl autoscale deployment hpa-demo --cpu-percent=50 --min=1 --max=5
```

Or equivalently, as a YAML manifest:

```bash
nano hpa.yaml
```

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hpa-demo
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hpa-demo
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50
```

## Observing the HPA

```bash
kubectl get hpa
```

The output shows the current and target metrics, the current replica count, and the min/max bounds:

```
NAME       REFERENCE             TARGETS   MINPODS   MAXPODS   REPLICAS
hpa-demo   Deployment/hpa-demo   5%/50%    1         5         1
```

`5%/50%` means current CPU is 5%, target is 50%. The single replica is well within capacity, so no scaling occurs.

```bash
kubectl describe hpa hpa-demo
```

Look at the `Events` section and the `Conditions` section. `AbleToScale: True` and `ScalingActive: True` confirm the HPA is functioning. The conditions also show the reason for any recent scaling decisions.

## How the HPA calculates replicas

@@@
graph LR
CURR["Current CPU\nacross all Pods:\n400m total\nwith 2 Pods = 200m avg"]
REQ["CPU request per Pod:\n100m\nTarget: 50%\n= 50m per Pod"]
CALC["desiredReplicas =\nceil(200m / 50m) = 4"]
CURR --> CALC
REQ --> CALC
@@@

The formula: `desiredReplicas = ceil(currentUtilization / targetUtilization)`.

If the target is 50% of a 100m request (= 50m target per Pod), and the current average usage across all Pods is 200m per Pod, then `ceil(200 / 50) = 4` replicas are needed.

:::quiz
A Deployment has `requests.cpu: 200m`. An HPA targets `averageUtilization: 50` (meaning 50% of the request = 100m per Pod). There are 3 running Pods with total CPU usage of 600m. How many replicas does the HPA target?

**Answer:** 6 replicas. Average usage per Pod: 600m / 3 = 200m. Target per Pod: 100m. desiredReplicas = ceil(200 / 100) = 2 times current replicas? Let me recalculate: desiredReplicas = ceil(currentReplicas * (currentUtilization / targetUtilization)) = ceil(3 * (200 / 100)) = ceil(6) = 6.
:::

## Memory-based HPA

HPA also supports memory as a target metric:

```yaml
metrics:
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70
```

:::warning
Memory-based scaling is more complex than CPU-based scaling because memory is not released automatically when load decreases. A Pod that consumed 500Mi of memory during a spike may retain that memory even after the spike. This can cause the HPA to maintain a high replica count longer than necessary. CPU is compressible and decreases quickly when load drops. Memory-based HPA requires careful tuning of scale-down behavior.
:::

```bash
kubectl delete deployment hpa-demo
kubectl delete hpa hpa-demo
```

:::quiz
An HPA has `minReplicas: 2` and `maxReplicas: 10`. Current replica count is 8. CPU drops to nearly 0. What is the minimum the HPA will scale down to?

**Answer:** 2, the `minReplicas` bound. The HPA will never go below `minReplicas` regardless of how low the metric drops. Similarly, it will never exceed `maxReplicas`. The bounds protect against both over-scaling (runaway scaling) and under-scaling (going to zero and losing availability).
:::

HPA automates replica management based on actual workload metrics. Set `minReplicas` to at least 2 for high-availability, size your CPU requests accurately, and watch the HPA events to understand scaling decisions. The next lesson covers the stabilization and behavior settings that control how quickly the HPA scales up and down.
