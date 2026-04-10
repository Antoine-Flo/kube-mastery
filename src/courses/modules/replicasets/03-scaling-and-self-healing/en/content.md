---
seoTitle: 'Kubernetes ReplicaSets, Scaling, Self-Healing, Pod Adoption'
seoDescription: 'Explore how Kubernetes ReplicaSets scale replicas up and down, automatically self-heal from Pod failures, and handle unexpected Pod adoption.'
---

# Scaling and Self-Healing

Your ReplicaSet has 3 Pods running. Traffic suddenly doubles, so you need 6. Then it drops off and you need 2. While this is happening, one Pod crashes. Scaling up, scaling down, crash recovery: all three are handled by the same underlying mechanism in the controller. This lesson makes each case visible in the simulator.

## Set Up the ReplicaSet

If you still have `web-rs` running from the previous lesson, check:

```bash
kubectl get replicaset web-rs
```

If it is gone, recreate it:

```bash
nano web-rs.yaml
```

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.28
```

```bash
kubectl apply -f web-rs.yaml
kubectl get pods -l app=web
```

Three Pods running. Now put the controller to work.

## Scaling Up


```bash
kubectl scale replicaset web-rs --replicas=5
kubectl get pods -l app=web
```

The controller noticed the desired count changed from 3 to 5. It created 2 new Pods from the same template. The original 3 Pods were untouched, still running, no restart, no interruption.

## Scaling Down

```bash
kubectl scale replicaset web-rs --replicas=2
kubectl get pods -l app=web
```

Three Pods were terminated. Which ones? Kubernetes applies a selection order when choosing which Pods to remove. It prefers to terminate Pods that are not yet ready, then newer Pods over older ones, then Pods on nodes that are already under higher load. With a simple workload like this, you will not control exactly which Pods go, and you should not need to.

:::warning
Scaling with `kubectl scale` is an imperative command. It changes the live state of the cluster but does not update your `web-rs.yaml` file. If you scale to 5 and later re-apply the file with `replicas: 3`, the count returns to 3. Your YAML file is the source of truth. Use imperative scaling for quick, temporary adjustments, and update the file when you want the change to persist.
:::

## Self-Healing in Action

Scale back to 3 first:

```bash
kubectl scale replicaset web-rs --replicas=3
kubectl get pods -l app=web
```

Now grab the name of one of the running Pods from the output, then delete it:


```bash
kubectl delete pod <POD-NAME>
kubectl get pods -l app=web
```

The deleted Pod is gone. A new Pod with the same prefix but a different suffix has appeared. The ReplicaSet controller detected the count dropped to 2 and created a replacement from the template.

Why does the replacement have a different name? Because it is a completely new object. The old Pod no longer exists. The controller created a brand new Pod with a new UID, a new name, and a fresh start. It uses the same template, so the spec is identical, but it shares nothing else with the Pod it replaced.

:::quiz
After deleting one Pod and the ReplicaSet replacing it, how does the new Pod name compare to the old one?

**Try it:** `kubectl get pods -l app=web`

**Answer:** The new Pod has the same `web-rs-` prefix but a different random suffix. It is a completely new object, a new UID, a new name. Same template, same spec, entirely new identity.
:::

## The Adoption Edge Case

The ReplicaSet does not track which Pods it created. It tracks which Pods match its selector. That distinction matters.

If a standalone Pod exists with labels matching the selector, the controller adopts it and counts it toward the desired total.

:::warning
This can produce confusing results. Suppose you have 2 standalone Pods with `app=web` already running, and you create a ReplicaSet with `replicas: 3` selecting `app=web`. The controller adopts the 2 existing Pods. It only needs to create 1 more, not 3. If those 2 existing Pods have a different image or different resources than the template, they will remain as-is. The controller manages count, not configuration of adopted Pods.
:::

The reverse is also true. If the count of matching Pods exceeds the desired total, the controller deletes the excess, regardless of who created them.

:::quiz
A ReplicaSet has `replicas: 3` and all 3 Pods are running. You manually create a bare Pod with the same labels as the selector. What does the ReplicaSet do?

- It ignores the Pod because it did not create it
- It adopts the Pod, now sees 4 Pods, and deletes one to return to 3
- It crashes with a selector conflict error

**Answer:** It adopts the Pod and then deletes one to return to the desired count of 3. The controller cares only about the current count of matching Pods, not who created them.
:::

## Cleanup

```bash
kubectl delete replicaset web-rs
```

The ReplicaSet and all the Pods it owns are deleted together. Deleting the ReplicaSet is sufficient to clean up everything.

ReplicaSets give you continuous enforcement of a desired Pod count, in both directions, for any reason the count changes. The next lesson reveals where this primitive falls short and why Deployments exist as the layer above it.

