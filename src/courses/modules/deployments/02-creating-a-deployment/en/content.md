---
seoTitle: 'Create a Kubernetes Deployment, Manifest, Apply, Inspect'
seoDescription: 'Learn how to write a Deployment manifest, apply it with kubectl, inspect the Deployment-ReplicaSet-Pod hierarchy, and monitor rollout status.'
---

# Creating a Deployment

Now that you understand what a Deployment is and why it exists, it's time to create one. In this lesson you'll write a complete Deployment manifest, apply it to the cluster, and explore the objects it creates at each level of the hierarchy. You'll also learn the imperative shortcut for when you need to spin something up quickly.

:::info
A Deployment manifest looks almost identical to a ReplicaSet manifest, the key addition is `spec.strategy`, which controls how updates are applied.
:::

## Anatomy of a Deployment Manifest

A Deployment is a thin but powerful wrapper around a ReplicaSet. Here's a complete example:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web
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
          ports:
            - containerPort: 80
```

Let's walk through each section carefully.

**`apiVersion: apps/v1`:** Deployments belong to the `apps` API group, introduced as a stable (`v1`) API in Kubernetes 1.9. This is the only version you'll use today; the older `extensions/v1beta1` path was removed years ago.

**`kind: Deployment`:** Tells Kubernetes what type of object you're creating.

**`metadata.name`:** The name of the Deployment object itself. This name also becomes the prefix for the ReplicaSets and Pods that the Deployment creates. For example, a Deployment named `web-app` will create ReplicaSets like `web-app-6d4b9c7f8` and Pods like `web-app-6d4b9c7f8-x2pkz`.

**`spec.replicas`:** The desired number of Pod replicas. The Deployment passes this down to its active ReplicaSet.

**`spec.selector`:** The label selector the Deployment uses to identify the Pods it owns. This must match the labels in `spec.template.metadata.labels`. If they don't match, the API server will reject the manifest.

**`spec.template`:** The Pod template. Everything under this key describes the Pods that will be created. It has the same structure as a standalone Pod manifest, minus the top-level `apiVersion`, `kind`, and the name (Pods get auto-generated names).

:::info
The `spec.selector` in a Deployment is immutable after creation. If you ever need to change the label selector, you must delete and recreate the Deployment. Plan your label strategy carefully before you go to production.
:::

## The `spec.strategy` Field (and Its Defaults)

You'll notice the manifest above doesn't include a `spec.strategy` section. When omitted, Kubernetes uses sensible defaults:

- **type**: `RollingUpdate`
- **maxUnavailable**: `25%`
- **maxSurge**: `25%`

This means during an update, at most 25% of your Pods can be unavailable at any time, and at most 25% extra Pods above the desired count can be created. For a 3-replica Deployment that works out to approximately one Pod unavailable and one Pod extra at any given moment during the rollout. You'll tune these values in a later lesson.

## Applying the Manifest: Declarative vs Imperative Creation

Once your manifest is saved to a file (for example `deployment.yaml`), you send it to the cluster. The standard way is **declarative**: `kubectl apply -f <file>` is idempotent, it creates the object if it doesn't exist, or updates it if it does. Unlike `kubectl create` (which fails if the object exists), you can re-run `apply` as you iterate on your manifest: change the image, adjust replicas, apply again. The cluster converges to what you declared.

:::info
Prefer `kubectl apply` for anything you intend to version-control or reuse. Reserve `kubectl create` for one-off experiments or when you explicitly want to avoid overwriting an existing object.
:::

## Inspecting the Hierarchy

One of the most satisfying things about creating a Deployment for the first time is watching the full hierarchy materialize. The Deployment controller creates a ReplicaSet; the ReplicaSet creates the Pods. You can inspect each level.

At the Deployment level, `kubectl get deployment <name>` shows you **READY** (e.g. `3/3`), **UP-TO-DATE** (how many Pods match the current template), and **AVAILABLE** (how many are ready for traffic). Those columns tell you at a glance whether the desired state is met.

At the ReplicaSet level, you list ReplicaSets with the same labels as your Deployment (e.g. `app=web`). You'll see one active ReplicaSet whose name is the Deployment name plus a hash. That hash is derived from the Pod template: change the image or the container spec, and a new ReplicaSet appears with a new hash. Kubernetes uses this to distinguish "old" from "new" during rollouts.

At the Pod level, you list Pods with the same label selector. Each Pod name includes the ReplicaSet hash and a unique suffix. Seeing all three levels (Deployment → ReplicaSet → Pods) confirms that the controller chain is working.

@@@
graph TB
    DEP["Deployment<br/>web-app<br/>replicas: 3"]
    RS["ReplicaSet<br/>web-app-6d4b9c7f8<br/>replicas: 3"]
    P1["Pod<br/>web-app-6d4b9c7f8-abc12<br/>nginx:1.28"]
    P2["Pod<br/>web-app-6d4b9c7f8-def34<br/>nginx:1.28"]
    P3["Pod<br/>web-app-6d4b9c7f8-ghi56<br/>nginx:1.28"]

    DEP --> RS
    RS --> P1
    RS --> P2
    RS --> P3
@@@

## Describing the Deployment

For a deeper view than `kubectl get`, use `kubectl describe deployment <name>`. The output is structured into sections that every Kubernetes practitioner should know.

- **Replicas:** Current counts for ready, available, and up-to-date replicas. If something is wrong, the numbers here often tell you (e.g. desired 3, ready 2).

- **StrategyType:** Confirms `RollingUpdate` and shows the configured `maxUnavailable` and `maxSurge` values.

- **Pod Template:** The full Pod spec that this Deployment is managing. Handy to verify that the image, labels, and container config are what you expect.

- **Conditions:** High-level health: `Available` (can the Deployment serve traffic?) and `Progressing` (is a rollout in progress?). A stuck rollout will show one of these as `False` with a reason.

- **Events:** A chronological log of what the Deployment controller did: scaled up a ReplicaSet, scaled down an old one, etc. When a rollout is stuck, the Events section usually explains why. Image pull errors, insufficient cluster resources, or failing readiness probes. Get into the habit of scrolling to Events when something doesn't match your expectations.

## The Imperative Alternative: When and Why

Sometimes you need a Deployment in seconds, during the CKA exam, in a demo, or when prototyping. Kubernetes lets you create a Deployment **imperatively** with `kubectl create deployment <name> --image=<image> --replicas=<n>`.

A very useful **hybrid** is to let kubectl generate the YAML for you, then edit it. Using `--dry-run=client -o yaml` with `kubectl create deployment` tells kubectl to build the object in memory and print the YAML without sending anything to the API server. You get a valid, ready-to-edit manifest in one command. You can then add ports, env, resources, and apply the file. This pattern is especially valuable when time is limited (e.g. CKA) or when you want a correct skeleton.

## Checking Rollout Status

After you apply a Deployment (or an update to it), the rollout may take a few seconds or longer.

The command is `kubectl rollout status deployment/<name>`. It blocks until all new Pods are up and old ones are terminated according to the strategy, or exits with a non-zero code if the rollout fails or times out. This makes it useful in CI/CD pipelines: run `kubectl apply -f ...` followed by `kubectl rollout status ...` to automatically fail the pipeline if the new version doesn't become healthy.

---

## Hands-On Practice

Put the theory into practice with the following steps. Use the manifest from the Anatomy section.

**1. Write the manifest to a file**

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web
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
          ports:
            - containerPort: 80
```

**2. Apply it and wait for the rollout**

```bash
kubectl apply -f deployment.yaml
kubectl rollout status deployment/web-app
```

**3. Inspect all three levels of the hierarchy**

```bash
kubectl get deployment web-app
kubectl get rs -l app=web
kubectl get pods -l app=web
```

**4. Explore the full describe output**

```bash
kubectl describe deployment web-app
```

Read through the Events section at the bottom. You should see something like:

```
Events:
  Type    Reason             Age   From                   Message
  ----    ------             ----  ----                   -------
  Normal  ScalingReplicaSet  30s   deployment-controller  Scaled up replica set web-app-6d4b9c7f8 to 3
```

**5. Use dry-run to see the full generated YAML**

```bash
kubectl create deployment demo --image=nginx --replicas=2 --dry-run=client -o yaml
```

Compare what Kubernetes generates with what you wrote by hand. Notice the additional fields Kubernetes fills in automatically (like `strategy` and default values in metadata).

**6. Scale the Deployment up and observe the ReplicaSet**

```bash
kubectl scale deployment web-app --replicas=5
kubectl get pods -l app=web
# You should now see 5 Pods, all created by the same ReplicaSet
kubectl get rs -l app=web
# DESIRED is now 5
```

**7. Scale back down**

```bash
kubectl scale deployment web-app --replicas=3
kubectl get pods -l app=web
# Back to 3 Pods; the extras are terminated
```

**8. Clean up**

```bash
kubectl delete deployment web-app
```
