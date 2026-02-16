# ResourceQuota Scopes

Not all Pods are created equal. Some are critical production workloads with guaranteed resources. Others are best-effort batch jobs that can be evicted when the cluster is under pressure. It would be unfair — and impractical — to count them against the same quota.

**Quota scopes** let you create separate quotas for different classes of workloads. A scoped quota only counts resources that match the scope, so you can give production Pods generous limits while capping best-effort Pods tightly.

## The Available Scopes

Kubernetes supports four built-in scopes:

- **BestEffort** — Pods with no CPU/memory requests or limits at all. These are the lowest-priority Pods and get evicted first when nodes are under pressure.
- **NotBestEffort** — Pods that have at least one request or limit (Burstable or Guaranteed QoS class). These are your "real" workloads.
- **Terminating** — Pods with `activeDeadlineSeconds` set — typically Jobs with a time limit.
- **NotTerminating** — Long-running Pods without `activeDeadlineSeconds` — most Deployments and StatefulSets.

You can combine scopes: a resource must match **all** specified scopes to be counted.

## Why This Matters

Imagine a development namespace where developers run experimental Pods without any resource requests (BestEffort). Without scoped quotas, these experiments eat into the same budget as your critical workloads. With scoped quotas, you can say:

- "BestEffort Pods: max 5 in this namespace"
- "NotBestEffort Pods: max 20, with up to 8 CPU cores and 16Gi memory"

This gives you fine-grained control without blocking either category entirely.

## Scoped Quota Example: BestEffort

This quota limits BestEffort Pods — only Pods without any requests or limits count:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: best-effort-quota
  namespace: dev
spec:
  hard:
    pods: "5"
  scopes:
    - BestEffort
```

## Scoped Quota Example: NotBestEffort

This quota limits Pods that do have requests or limits — the "real" workloads:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: dev
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
  scopes:
    - NotBestEffort
```

Both quotas coexist in the same namespace, each tracking its own set of Pods.

:::info
You can also use `scopeSelector` for more advanced matching — for example, creating quotas per <a target="_blank" href="https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/">PriorityClass</a>. This enables scenarios like "high-priority Pods get more quota than low-priority ones."
:::

## Verifying Scoped Quotas

Check which scope a quota applies to:

```bash
kubectl get resourcequota -n dev -o yaml
```

To see a Pod's QoS class (which determines whether it's BestEffort):

```bash
kubectl get pod my-pod -o jsonpath='{.status.qosClass}'
```

The output will be `BestEffort`, `Burstable`, or `Guaranteed`.

:::warning
If a Pod isn't being counted by a quota you expected, it probably doesn't match the scope. A Pod with `requests` but no `limits` is Burstable (NotBestEffort), not BestEffort. Use `kubectl get pod -o jsonpath` to check the QoS class.
:::

## Wrapping Up

Quota scopes let you tailor resource limits to different types of workloads. Use BestEffort/NotBestEffort to separate experimental from production Pods, and Terminating/NotTerminating to handle batch Jobs differently from long-running services. Combined with standard quotas, scopes give you precise control over who gets what in your namespaces. In the next lesson, we'll look at object count quotas — limiting how many ConfigMaps, Secrets, and other objects a namespace can hold.
