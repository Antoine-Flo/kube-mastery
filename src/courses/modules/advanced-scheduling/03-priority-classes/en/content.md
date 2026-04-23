---
seoTitle: 'Kubernetes PriorityClass, Pod Preemption, Eviction Priority'
seoDescription: 'Learn how Kubernetes PriorityClasses assign priority values to Pods, how higher-priority Pods preempt lower-priority ones, and how to protect critical workloads.'
---

# Priority Classes

A critical payment processing service goes Pending because the cluster is full of lower-priority batch Jobs. Without priority classes, all Pods are equal and the scheduler has no mechanism to make room. With priority classes, the scheduler can evict lower-priority Pods to schedule higher-priority ones.

A `PriorityClass` is a cluster-level object that maps a name to an integer priority value. Pods reference a PriorityClass by name. Higher values mean higher priority. The scheduler uses priority both for scheduling decisions and for preemption: evicting lower-priority Pods to free capacity for higher-priority ones.

## Creating a PriorityClass

```bash
nano priority-classes.yaml
```

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: critical-workload
value: 1000000
globalDefault: false
description: 'For production-critical services'
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: batch-workload
value: 100
globalDefault: false
description: 'For batch and background processing'
```

```bash
kubectl apply -f priority-classes.yaml
kubectl get priorityclasses
```

The built-in system classes appear too: `system-cluster-critical` (value: 2000000000) and `system-node-critical` (value: 2000001000). These are used by Kubernetes system components and have very high values to prevent them from being preempted.

## Assigning priority to a Pod

```bash
nano high-priority-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: high-priority-pod
spec:
  priorityClassName: critical-workload
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
      resources:
        requests:
          cpu: '100m'
          memory: '64Mi'
```

```bash
kubectl apply -f high-priority-pod.yaml
kubectl get pod high-priority-pod -o jsonpath='{.spec.priority}'
```

The numeric value `1000000` is shown. This is the value that the scheduler uses for comparison.

## How preemption works

@@@
graph LR
A["Cluster full\nlow-priority batch Pods\nrunning on all nodes"]
B["High-priority Pod created\nno room to schedule"]
C["Scheduler identifies\nlowest-priority Pods\nthat, if evicted,\nfree enough space"]
D["Those Pods evicted\nhigh-priority Pod\nscheduled"]
A --> B --> C --> D
@@@

When a Pod cannot be scheduled because of insufficient resources, the scheduler checks if preemption can help: are there lower-priority Pods whose eviction would free enough capacity? If yes, the scheduler evicts them, making room for the higher-priority Pod.

Preempted Pods receive a graceful termination signal. They are not killed immediately. They have `terminationGracePeriodSeconds` (default 30 seconds) to shut down cleanly.

:::quiz
A cluster is at capacity. Two Pods are pending: Pod A with priority 5000 and Pod B with priority 1000. A node has a Pod with priority 500 using exactly enough resources for one of the pending Pods. Which pending Pod gets the resources?

**Answer:** Pod A (priority 5000). The scheduler evicts the priority-500 Pod to make room. When multiple Pods are pending, higher-priority Pods are scheduled first. Pod B (priority 1000) remains Pending until another node has available capacity or another Pod is evicted.
:::

## The globalDefault field

A `PriorityClass` with `globalDefault: true` is automatically assigned to any Pod that does not specify a `priorityClassName`. Only one PriorityClass can have `globalDefault: true` at a time. This is useful for ensuring all Pods in the cluster have a priority value even if developers forget to set one.

```bash
kubectl get pod kube-apiserver-sim-control-plane -n kube-system -o jsonpath='{.spec.priorityClassName}'
```

The output shows `system-cluster-critical`. This is why control plane Pods are never preempted by user workloads.

:::warning
Setting a very high priority on a workload means it can preempt other Pods. In a multi-tenant cluster, giving different teams access to high-priority classes can cause one team's workloads to evict another team's workloads. Use ResourceQuotas to limit which priority classes each namespace can use, and grant high-priority classes only to operators or specific critical namespaces.
:::

:::quiz
A developer sets `priorityClassName: system-cluster-critical` on their application Pod. What is the risk?

**Answer:** The Pod gets the same priority as Kubernetes system components. It could potentially preempt system Pods if resources are scarce. It is also protected from preemption by any other workload. In a shared cluster, this is a privilege escalation: only cluster operators should use system priority classes. Use RBAC or admission controllers to prevent regular users from referencing system priority classes.
:::

```bash
kubectl delete pod high-priority-pod
kubectl delete priorityclass critical-workload batch-workload
```

Priority classes are the mechanism that ensures critical services survive resource pressure. Assign them carefully, restrict access to high-value classes, and pair them with resource quotas. The next lesson covers multiple schedulers, a less common but exam-relevant scenario.
