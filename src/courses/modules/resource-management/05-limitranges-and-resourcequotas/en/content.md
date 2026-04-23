---
seoTitle: 'Kubernetes LimitRange ResourceQuota, Namespace Resource Policy'
seoDescription: 'Learn how to use Kubernetes LimitRange to set default and maximum container resources, and ResourceQuota to cap total namespace consumption.'
---

# LimitRanges and ResourceQuotas

Individual Pod resource settings work at the workload level. But what happens when a developer forgets to set requests? Or deploys a Pod with an unreasonably high limit? LimitRanges and ResourceQuotas enforce resource policies at the namespace level, catching problems before they affect the cluster.

## LimitRange: defaults and per-container constraints

A LimitRange applies to individual containers and Pods within a namespace. It does two things:

- Sets default requests and limits for containers that do not specify any
- Enforces minimum and maximum bounds on what can be requested

```bash
nano default-limits.yaml
```

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
spec:
  limits:
    - type: Container
      defaultRequest:
        cpu: '100m'
        memory: '64Mi'
      default:
        cpu: '500m'
        memory: '128Mi'
      max:
        cpu: '2'
        memory: '1Gi'
      min:
        cpu: '50m'
        memory: '32Mi'
```

```bash
kubectl apply -f default-limits.yaml
```

Now create a Pod without any resource configuration:

```bash
kubectl run no-resources --image=busybox:1.36 --restart=Never --command -- sleep 3600
kubectl get pod no-resources -o jsonpath='{.spec.containers[0].resources}'
```

The output shows requests and limits filled in automatically by the LimitRange. A developer who forgot to set resources gets the defaults instead of BestEffort placement.

```bash
kubectl describe limitrange default-limits
```

The describe output shows the full policy in a readable table. Check the `Max` row: any container in this namespace that tries to set a CPU limit above 2 cores will be rejected by the API server.

:::quiz
A LimitRange sets `max.cpu: 500m`. A developer submits a Pod with `limits.cpu: 2`. What happens?

**Answer:** The API server rejects the Pod creation with a validation error: the requested CPU limit exceeds the LimitRange maximum. The Pod is not created. The error message specifies which constraint was violated. The developer must lower the CPU limit to 500m or below.
:::

## ResourceQuota: total namespace consumption cap

A ResourceQuota limits the total amount of resources all Pods in a namespace can collectively consume. It also limits the total count of Kubernetes objects.

```bash
nano namespace-quota.yaml
```

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: namespace-quota
spec:
  hard:
    requests.cpu: '4'
    requests.memory: '4Gi'
    limits.cpu: '8'
    limits.memory: '8Gi'
    pods: '20'
```

```bash
kubectl apply -f namespace-quota.yaml
```

```bash
kubectl describe resourcequota namespace-quota
```

The output shows `Used` versus `Hard` for each constraint. As Pods are created, the `Used` values increment. When any `Used` value reaches its `Hard` limit, new Pods that would exceed that limit are rejected.

:::warning
When a ResourceQuota requiring memory requests exists in a namespace, every Pod in that namespace must specify `requests.memory`. If a Pod omits memory requests and a LimitRange is not providing defaults, the quota admission controller rejects the Pod. The combination of a ResourceQuota and a LimitRange with defaults ensures all Pods have requests set while still being subject to the quota.
:::

## Checking quota usage

```bash
kubectl get resourcequota
kubectl describe resourcequota namespace-quota
```

The `describe` output is the clearest view: it shows the hard limit alongside the current usage for each resource type. When a Pod creation fails with `exceeded quota`, this is the first place to check.

:::quiz
A namespace has `ResourceQuota: pods: 5`. There are already 5 running Pods. A developer runs `kubectl apply -f deployment.yaml` which would create a 6th Pod. What happens?

**Answer:** The Deployment is created successfully (the Deployment object itself is not counted by this quota), but the Pod cannot be created because the `pods` quota is exhausted. The Deployment controller will show `0/1 ready` and the associated Pod will remain in a Pending state with an Event saying `exceeded quota: pods`. The developer needs to delete an existing Pod or increase the quota to proceed.
:::

```bash
kubectl delete limitrange default-limits
kubectl delete resourcequota namespace-quota
kubectl delete pod no-resources
```

LimitRanges protect individual workloads from misconfiguration. ResourceQuotas protect the cluster from namespace-level over-allocation. Use them together: the LimitRange ensures defaults so the ResourceQuota can track requests accurately. The next module covers multi-container Pods, where multiple containers share a Pod's network and volume space.
