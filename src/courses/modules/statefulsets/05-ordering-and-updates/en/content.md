---
seoTitle: 'StatefulSet Update Strategies, RollingUpdate, Partition, OnDelete'
seoDescription: 'Learn how StatefulSets update Pods in reverse ordinal order, how to use partitions for canary updates, and how the OnDelete strategy gives manual control.'
---

# StatefulSet Ordering and Updates

A StatefulSet update behaves very differently from a Deployment update. Deployments can update multiple replicas simultaneously. A StatefulSet updates one Pod at a time, in reverse ordinal order: the highest-numbered Pod is updated first. This is intentional: in distributed databases, the primary is typically `db-0`. Starting the update from the highest ordinal (`db-N-1`) reduces the risk of disrupting the primary.

## The default RollingUpdate strategy

Create a StatefulSet to update:

```bash
nano update-sts.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: update-headless
spec:
  clusterIP: None
  selector:
    app: update-sts
  ports:
    - port: 80
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: update-sts
spec:
  serviceName: update-headless
  replicas: 3
  updateStrategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: update-sts
  template:
    metadata:
      labels:
        app: update-sts
    spec:
      containers:
        - name: app
          image: busybox:1.35
          command: ['sh', '-c', 'sleep 3600']
```

```bash
kubectl apply -f update-sts.yaml
kubectl get pods -l app=update-sts
```

Trigger an update by changing the image:

```bash
kubectl set image statefulset/update-sts app=busybox:1.36
kubectl rollout status statefulset/update-sts
```

Watch the output. The rollout processes `update-sts-2` first, waits for it to be Ready, then `update-sts-1`, then `update-sts-0` last.

@@@
graph LR
U2["update-sts-2\nupdated first"] -->|"Ready"| U1["update-sts-1\nupdated second"] -->|"Ready"| U0["update-sts-0\nupdated last"]
@@@

:::quiz
A StatefulSet has 4 replicas (pods 0 through 3). The update starts. Pod 2 gets updated but its readiness probe fails. What happens?

**Answer:** The rollout is blocked. The StatefulSet controller waits for `update-sts-2` to be Ready before proceeding to `update-sts-1`. Since the readiness probe is failing, `update-sts-2` is never marked Ready, and the update stalls. `update-sts-0` and `update-sts-1` remain at the old version indefinitely. Use `kubectl rollout status` to see the blocked state and `kubectl describe pod update-sts-2` to diagnose the readiness failure.
:::

## Canary updates with partitions

The `partition` field allows you to update only the Pods with ordinal index >= the partition value. Lower-ordinal Pods keep the old version. This enables controlled canary rollouts.

```bash
kubectl patch statefulset update-sts -p '{"spec":{"updateStrategy":{"rollingUpdate":{"partition":2}}}}'
```

Now change the image:

```bash
kubectl set image statefulset/update-sts app=busybox:1.35
```

Only `update-sts-2` is updated. `update-sts-0` and `update-sts-1` keep the previous image (partition=2 means only ordinals >= 2 are updated, which is just index 2).

```bash
kubectl get pods -l app=update-sts -o jsonpath='{range .items[*]}{.metadata.name}: {.spec.containers[0].image}{"\n"}{end}'
```

After verifying the canary works, remove the partition to roll out to all Pods:

```bash
kubectl patch statefulset update-sts -p '{"spec":{"updateStrategy":{"rollingUpdate":{"partition":0}}}}'
```

The remaining Pods are updated in reverse ordinal order.

:::quiz
A StatefulSet has `partition: 1`. You change the image. Which Pods are updated?

**Answer:** Pods with ordinal index >= 1: that is, `pod-1`, `pod-2`, and any higher-ordinal Pods. `pod-0` is not updated. This is the canary pattern: test the update on higher-ordinal (typically secondary) nodes while `pod-0` (typically the primary) remains on the stable version.
:::

## OnDelete strategy

With `updateStrategy.type: OnDelete`, the StatefulSet controller does not automatically update Pods when the template changes. Each Pod is only updated when you manually delete it.

```bash
kubectl patch statefulset update-sts -p '{"spec":{"updateStrategy":{"type":"OnDelete"}}}'
kubectl set image statefulset/update-sts app=busybox:1.35
```

Check the Pods: they still run the old image. Delete one manually:

```bash
kubectl delete pod update-sts-2
```

The StatefulSet recreates `update-sts-2` with the new image. The other Pods are unchanged until you delete them.

:::warning
`OnDelete` requires manual intervention for every Pod. In a cluster under change pressure, it is easy to leave some Pods on the old version for extended periods. Always track which Pods have been updated with `kubectl get pods -o jsonpath` to verify image versions. Never use `OnDelete` without a tracking process.
:::

## Rollback

There is no native `kubectl rollout undo` for StatefulSets. To roll back, set the image back to the previous version and the RollingUpdate strategy will roll it out in reverse order:

```bash
kubectl set image statefulset/update-sts app=busybox:1.36
kubectl rollout status statefulset/update-sts
```

```bash
kubectl delete statefulset update-sts
kubectl delete service update-headless
```

StatefulSet updates are conservative by design: one Pod at a time, in reverse order, blocking on readiness. The partition feature enables controlled canary rollouts. `OnDelete` gives full manual control at the cost of automation. The combination of stable identity, persistent storage, ordered lifecycle, and controlled updates makes StatefulSets the right controller for distributed stateful workloads in Kubernetes.
