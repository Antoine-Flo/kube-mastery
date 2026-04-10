---
seoTitle: Create a Kubernetes ReplicaSet, manifest, selector, and verification
seoDescription: Learn how to create a ReplicaSet in Kubernetes, validate selector and template labels, and verify desired, current, and ready pods with kubectl.
---

# Creating a ReplicaSet

You know why ReplicaSets exist. Now write one. A ReplicaSet manifest shares a lot with a Pod manifest, but it adds three fields that completely change how Kubernetes treats it: `replicas`, `selector`, and `template`. Build the manifest incrementally to understand what each part does before putting them together.

## The Three Key Fields

**`replicas`** is the desired count. This is the number the controller will enforce at all times.

```yaml
# illustrative only
spec:
  replicas: 3
```

**`selector`** tells the ReplicaSet which Pods it owns. The controller counts all Pods in the namespace that match these labels and compares the count to `replicas`.

```yaml
# illustrative only
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
```

**`template`** is the blueprint. When the controller needs to create a new Pod, it uses this template exactly. Everything under `template` is a standard Pod spec, minus the `apiVersion` and `kind`.

```yaml
# illustrative only
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

Notice that `template.metadata.labels` includes `app: web`, which matches `selector.matchLabels`. This is not optional. The labels in the template must include every label the selector requires. If they do not, the API server rejects the manifest immediately.

Why? Because the controller creates Pods from the template. If the resulting Pods do not carry the labels the selector looks for, the controller cannot count them as its own. It would keep creating Pods, none of which satisfy the selector, resulting in an uncontrolled creation loop. Kubernetes blocks this at admission time rather than letting it happen at runtime.

:::quiz
Why must `template.metadata.labels` include all labels from `selector.matchLabels`?

**Answer:** Because the ReplicaSet creates new Pods from the template. If the newly created Pods lack the labels the selector requires, the controller will not count them toward the desired total. It would create Pod after Pod indefinitely. Kubernetes prevents this by rejecting the manifest at the API server if the labels do not satisfy the selector.
:::

## Write and Apply the Full Manifest

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
          resources:
            requests:
              cpu: '100m'
              memory: '64Mi'
            limits:
              cpu: '200m'
              memory: '128Mi'
```


```bash
kubectl apply -f web-rs.yaml
```

The controller starts immediately. It counts Pods with `app=web`, finds zero, and creates 3 from the template.

## Inspect the Result

```bash
kubectl get replicaset web-rs
```

The output shows four columns: `DESIRED`, `CURRENT`, `READY`, and `AGE`. `DESIRED` is what you asked for. `CURRENT` is how many Pod objects exist. `READY` is how many have passed their readiness check. With no readiness probe configured, nginx Pods become ready quickly after their container starts.

:::quiz
How many Pods are READY out of the 3 desired?

**Try it:** `kubectl get replicaset web-rs`

**Answer:** The `READY` column shows the count that passed readiness checks. With nginx and no custom readiness probe, all 3 should show ready shortly after creation. The format is `<ready>/<desired>` in some output formats, and separate columns in the table view.
:::

```bash
kubectl get pods -l app=web
```

Three Pods appear, each named `web-rs-<random-suffix>`. That naming pattern is intentional. Unlike bare Pods where you assign the name, the ReplicaSet generates a unique suffix for each Pod it creates. This ensures no two Pods collide on name, even when Pods are replaced after a crash.

```bash
kubectl describe replicaset web-rs
```

Scroll through the output. Find the `Replicas` line showing `3 current / 3 desired`, the `Selector` field showing `app=web`, and the `Events` section at the bottom listing each `SuccessfulCreate` event. Those events are the controller's action log.

:::warning
A mismatch between `selector.matchLabels` and `template.metadata.labels` causes an immediate rejection: `selector does not match template labels`. The most common mistake is adding a label to the template (for example, a `version` label) without adding it to the selector. The reverse, requiring a label in the selector that the template does not provide, is always an error. Adding extra labels to the template that are not in the selector is allowed.
:::

## What You Have Now

Three Pods running nginx, all managed by a single ReplicaSet. If any Pod disappears, the controller creates a replacement. The next lesson makes that self-healing visible by deliberately deleting Pods and watching the simulator respond. You will also see how scaling works and what happens when a standalone Pod with matching labels shows up unexpectedly.

