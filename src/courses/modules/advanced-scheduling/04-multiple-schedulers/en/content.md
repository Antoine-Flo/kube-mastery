---
seoTitle: 'Kubernetes Multiple Schedulers, Custom Scheduler, schedulerName'
seoDescription: 'Learn how to deploy a second scheduler in Kubernetes, assign Pods to a specific scheduler with schedulerName, and understand when custom schedulers are needed.'
---

# Multiple Schedulers

The default kube-scheduler works well for most workloads. But some specialized environments need custom scheduling logic: high-performance computing clusters with GPU topology awareness, financial workloads with strict latency constraints, or machine learning platforms with custom placement optimization. Kubernetes allows you to run multiple schedulers simultaneously and assign Pods to specific schedulers by name.

This is an advanced feature. On the CKA exam, you need to know how to configure a Pod to use a specific scheduler, how to verify which scheduler placed a Pod, and what happens when the named scheduler is unavailable.

## How multiple schedulers work

Each scheduler instance watches for Pods with a matching `schedulerName`. When a Pod with `schedulerName: my-scheduler` is created, only the scheduler running as `my-scheduler` will process it. The default scheduler (running as `default-scheduler`) ignores that Pod.

```bash
kubectl get pods -n kube-system -l component=kube-scheduler
```

The default kube-scheduler runs here. A custom scheduler would also run here, typically as a Deployment.

## Deploying a custom scheduler

A custom scheduler is usually a Deployment running the standard kube-scheduler binary with a different name and configuration. Here is the minimal setup:

```bash
nano custom-scheduler.yaml
```

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: custom-scheduler
  namespace: kube-system
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: custom-scheduler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      component: custom-scheduler
  template:
    metadata:
      labels:
        component: custom-scheduler
    spec:
      serviceAccountName: custom-scheduler
      containers:
        - name: scheduler
          image: registry.k8s.io/kube-scheduler:v1.29.0
          command:
            - kube-scheduler
            - --config=/etc/kubernetes/custom-scheduler-config.yaml
```

The critical element is the `KubeSchedulerConfiguration` file that sets the scheduler's name:

```yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
  - schedulerName: custom-scheduler
```

Without this configuration, both schedulers would claim to be `default-scheduler` and compete for the same Pods.

:::quiz
Two scheduler instances both run as `default-scheduler`. What problem arises?

**Answer:** Race condition. Both schedulers watch for Pods without a `schedulerName` (or with `schedulerName: default-scheduler`). When a new Pod appears, both attempt to schedule it simultaneously. One will succeed (binding the Pod to a node), but the other may also attempt to bind it to a different node. The result is undefined behavior: the Pod may end up bound twice or an error may occur. Each scheduler must have a unique name to avoid this conflict.
:::

## Assigning a Pod to a specific scheduler

```bash
nano custom-scheduler-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: custom-scheduler-pod
spec:
  schedulerName: custom-scheduler
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
```

```bash
kubectl apply -f custom-scheduler-pod.yaml
kubectl get pod custom-scheduler-pod
```

If the custom scheduler is running and functional, the Pod transitions to `Running`. If the custom scheduler is not running, the Pod stays in `Pending` indefinitely, just as it would if no scheduler existed for it.

## Verifying which scheduler placed a Pod

```bash
kubectl describe pod custom-scheduler-pod
```

Look at the `Events` section. The `Successfully assigned` event includes the scheduler's name:

```
Normal  Scheduled  <timestamp>  custom-scheduler  Successfully assigned default/custom-scheduler-pod to sim-worker
```

The scheduler name appears in the `From` column of the event. This confirms which scheduler made the placement decision.

```bash
kubectl get pod custom-scheduler-pod -o jsonpath='{.spec.schedulerName}'
```

This shows the `schedulerName` field set in the Pod spec.

:::warning
If a Pod's `schedulerName` references a scheduler that is not running, the Pod stays Pending indefinitely. There is no fallback to the default scheduler. This is different from a scheduling constraint failure (like a missing node label): the event will say nothing, because no scheduler is watching those Pods. Check `kubectl describe pod` for any scheduling events. If none appear at all, the named scheduler is likely not running.
:::

:::quiz
A Pod has `schedulerName: custom-scheduler`. The custom scheduler is down. A developer deletes the pod's `schedulerName` field to allow the default scheduler to pick it up. Does this work?

**Answer:** No, you cannot edit the `schedulerName` field of an existing Pod. It is an immutable field. The developer must delete the Pod and recreate it without the `schedulerName` field (or with `schedulerName: default-scheduler`). The new Pod will then be picked up by the default scheduler.
:::

```bash
kubectl delete pod custom-scheduler-pod
```

Multiple schedulers give Kubernetes extensibility for specialized placement logic. The schedulerName field in the Pod spec is the routing mechanism. The next module covers autoscaling: scaling workloads automatically based on CPU, memory, or custom metrics.
