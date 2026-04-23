---
seoTitle: 'Kubernetes QoS Classes, Guaranteed, Burstable, BestEffort Eviction'
seoDescription: 'Learn the three Kubernetes QoS classes: Guaranteed, Burstable, and BestEffort, how they are assigned automatically, and which Pods are evicted first under memory pressure.'
---

# QoS Classes

A node runs low on memory. The kubelet needs to evict Pods to free resources. Which ones go first? Kubernetes assigns every Pod one of three Quality of Service (QoS) classes based on how its containers are configured. The class determines eviction priority: some Pods are protected, others are the first to be reclaimed.

The QoS class is not something you set directly. It is derived automatically from the requests and limits you specify.

## The three QoS classes

@@@
graph TB
G["Guaranteed\nHighest priority\nLast to be evicted"]
B["Burstable\nMedium priority\nEvicted before Guaranteed"]
BE["BestEffort\nLowest priority\nEvicted first"]
G --> B --> BE
note["Eviction order: BestEffort first,\nthen Burstable,\nGuaranteed last"]
@@@

**Guaranteed**: every container in the Pod has both `requests` and `limits` set for CPU and memory, and `requests` equals `limits` exactly. The Pod gets exactly the resources it declares, no more and no less.

**Burstable**: at least one container has `requests` or `limits` set, but not all containers meet the Guaranteed criteria. The Pod can use more than its request if the node has slack, but it is not protected under pressure.

**BestEffort**: no container has any requests or limits. The scheduler can place this Pod anywhere and the kubelet gives it whatever is left over. It is the first to go when the node needs resources.

## Verifying the QoS class

```bash
kubectl run guaranteed-pod --image=busybox:1.36 --restart=Never \
  --requests='cpu=100m,memory=128Mi' --limits='cpu=100m,memory=128Mi' \
  --command -- sleep 3600
```

```bash
kubectl get pod guaranteed-pod -o jsonpath='{.status.qosClass}'
```

Output: `Guaranteed`. Requests equal limits for both CPU and memory on the only container.

```bash
kubectl run burstable-pod --image=busybox:1.36 --restart=Never \
  --requests='cpu=100m,memory=128Mi' --limits='cpu=500m,memory=256Mi' \
  --command -- sleep 3600
```

```bash
kubectl get pod burstable-pod -o jsonpath='{.status.qosClass}'
```

Output: `Burstable`. Limits are higher than requests.

```bash
kubectl run besteffort-pod --image=busybox:1.36 --restart=Never \
  --command -- sleep 3600
```

```bash
kubectl get pod besteffort-pod -o jsonpath='{.status.qosClass}'
```

Output: `BestEffort`. No requests or limits set.

:::quiz
A Pod has two containers. Container A has `requests: cpu=100m, memory=128Mi` and `limits: cpu=100m, memory=128Mi`. Container B has `requests: cpu=50m, memory=64Mi` but no limits. What is the Pod's QoS class?

**Answer:** Burstable. For Guaranteed, every container must have both requests and limits set, with requests equal to limits. Container B has requests but no limits, so the Pod does not qualify for Guaranteed. Since at least one container has requests, the Pod is Burstable (not BestEffort).
:::

## Eviction under memory pressure

When a node is running low on memory, the kubelet evicts Pods in this order:

1. BestEffort Pods (no protection)
2. Burstable Pods that are using more than their memory request
3. Burstable Pods that are not exceeding their request
4. Guaranteed Pods (only evicted if the node is critically pressured)

The kubelet also considers how much over their request each Burstable Pod is consuming. A Pod using 300% of its request is evicted before one using 110%.

:::warning
System Pods in `kube-system` (like kube-proxy and CoreDNS) are typically Guaranteed or have high priority classes. They are protected from eviction under normal memory pressure. If you are seeing cluster-level issues during a memory event, check non-system Pods first before suspecting control plane components.
:::

:::quiz
Your cluster is under memory pressure. A Burstable Pod (using 150% of its request) and a BestEffort Pod are both running. Which is evicted first?

**Answer:** The BestEffort Pod. BestEffort Pods have no declared resources at all and are the first candidates for eviction regardless of their actual consumption. The Burstable Pod, despite consuming above its request, has declared resource needs that provide some protection.
:::

```bash
kubectl delete pod guaranteed-pod burstable-pod besteffort-pod
```

QoS classes are a direct consequence of your resource configuration choices. Guaranteed protects critical workloads. BestEffort is appropriate only for batch jobs that can be restarted. Set requests equal to limits for your most critical Pods to achieve Guaranteed class. The next lesson covers LimitRanges and ResourceQuotas, which enforce default and maximum resource policies at the namespace level.
