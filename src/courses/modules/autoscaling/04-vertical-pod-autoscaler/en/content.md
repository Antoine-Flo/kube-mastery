---
seoTitle: 'Kubernetes Vertical Pod Autoscaler, VPA Modes, Resource Recommendations'
seoDescription: 'Learn how Kubernetes VPA recommends and applies CPU and memory requests automatically, VPA operating modes, and when VPA is the right choice over HPA.'
---

# Vertical Pod Autoscaler

A database Pod is OOMKilled every few days. You keep manually increasing the memory limit. A VPA (Vertical Pod Autoscaler) would observe the actual memory consumption over time, calculate the right request and limit, and update the Pod automatically. You stop chasing the right value manually.

VPA works at the individual Pod level: it adjusts the CPU and memory requests and limits on containers based on observed usage. It is the counterpart to HPA, which adjusts replica counts.

## VPA components

VPA is an optional add-on that installs three components:

- **VPA Recommender**: monitors resource usage and computes recommendations
- **VPA Updater**: evicts Pods that need their resources adjusted (so they restart with new values)
- **VPA Admission Controller**: sets resource requests on new Pods based on VPA recommendations

```bash
kubectl get pods -n kube-system | grep vpa
```

In the simulator, VPA components may be pre-installed.

## VPA operating modes

A `VerticalPodAutoscaler` object targets a specific workload and operates in one of four modes:

**`Off`**: VPA computes recommendations but does not apply them. Use this to understand what VPA would recommend without making changes.

**`Initial`**: VPA sets resources only when a new Pod is created (via the admission controller). It never evicts running Pods. Safe for production use as it does not cause restarts.

**`Auto`**: VPA both sets resources at creation and evicts Pods to apply updated recommendations. Pods are recreated with new resource values. This causes restarts.

**`Recreate`**: similar to Auto but only evicts when the current resources are significantly outside the recommendation.

## Creating a VPA object

```bash
nano vpa-example.yaml
```

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: my-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: 'Off'
  resourcePolicy:
    containerPolicies:
      - containerName: app
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: 2
          memory: 2Gi
```

```bash
kubectl apply -f vpa-example.yaml
```

With `updateMode: Off`, VPA observes the workload but never changes anything. After a period of observation:

```bash
kubectl describe vpa my-app-vpa
```

Look at the `Recommendation` section:

```
  Recommendation:
    Container Recommendations:
      Container Name:  app
      Lower Bound:
        Cpu:     50m
        Memory:  64Mi
      Target:
        Cpu:     200m
        Memory:  128Mi
      Uncapped Target:
        Cpu:     150m
        Memory:  100Mi
      Upper Bound:
        Cpu:     500m
        Memory:  256Mi
```

- **Target**: the recommended request to set (based on observed usage with safety margins)
- **Lower Bound**: the minimum sensible request
- **Upper Bound**: the maximum that would be useful given the usage pattern
- **Uncapped Target**: what VPA would recommend without the `minAllowed`/`maxAllowed` bounds

@@@
graph LR
OBS["VPA Recommender\nobserves actual usage\nover time"] --> REC["Recommendation\nTarget: cpu=200m\nmemory=128Mi"]
REC -->|"updateMode: Initial"| ADM["Admission Controller\nsets on new Pods"]
REC -->|"updateMode: Auto"| UPD["Updater\nevicts Pod\nrecreates with\nnew requests"]
@@@

:::quiz
A VPA in `Off` mode shows `Target: memory=512Mi` but the Pod's current request is `memory=128Mi`. What happens?

**Answer:** Nothing. `Off` mode is observation-only. The recommendation is displayed but never applied. The Pod keeps running with its original 128Mi request. To apply the recommendation, change the mode to `Initial` (applies to new Pods only) or `Auto` (evicts the running Pod to apply the new value).
:::

## The restart limitation of Auto mode

When VPA updates a Pod's resources, it evicts the Pod. The Pod is then recreated with the new values by the Deployment controller. This means VPA-managed Pods may restart periodically as VPA refines its recommendations.

This is acceptable for stateful workloads (like databases) that Kubernetes already handles with ordered restarts. It is problematic for web services: unexpected restarts during traffic can cause errors. For web services, use HPA instead.

:::warning
Do not run HPA (CPU-based) and VPA (in Auto or Recreate mode) on the same Deployment. VPA changes the CPU request, which changes the HPA's utilization calculation, which changes the replica count, which changes the overall resource usage, which changes VPA's recommendation. This creates a feedback loop. Run HPA without VPA, or run VPA in `Off`/`Initial` mode alongside HPA for read-only recommendations.
:::

:::quiz
When is VPA the better choice over HPA?

**Answer:** When the workload cannot be horizontally scaled. Stateful services (databases), singleton controllers, and Jobs that process one item at a time cannot simply be duplicated. For these workloads, adding replicas either causes errors (split-brain for databases) or has no effect (only one replica does useful work anyway). VPA increases the resources available to the single instance instead.
:::

```bash
kubectl delete vpa my-app-vpa 2>/dev/null; true
```

VPA automates the tedious task of right-sizing resource requests. Use `Off` mode first to understand recommendations, then `Initial` to apply them to new Pods without restarts. The next lesson covers in-place Pod resource resize, a newer feature that avoids the restart cycle entirely.
