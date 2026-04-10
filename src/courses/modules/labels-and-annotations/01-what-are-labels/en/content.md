---
seoTitle: Kubernetes Labels, Key-Value Pairs, Syntax, Filtering
seoDescription: Learn how to use Kubernetes labels to organize resources, connect Services to Pods, and filter workloads with kubectl selectors.
---

# What Are Labels

Imagine you have 40 Pods running across several namespaces. Some belong to the frontend, some to the backend. Some are for staging, some for production. Running `kubectl get pods` gives you a flat list with no grouping whatsoever. How do you quickly get just the frontend Pods that are in staging? That is the exact problem labels were designed to solve.

Labels are key-value pairs you attach to any Kubernetes object: Pods, Deployments, Services, Nodes, and more. They look simple, but they are the backbone of how Kubernetes connects objects to each other and how you filter resources from the command line.

Think of labels like sticky notes on boxes in a warehouse. The warehouse itself does not care what is written on any of them. But if you ask "give me all boxes tagged 'fragile' and 'floor-2'", you find them instantly. Kubernetes controllers work the same way: a Deployment does not track its Pods by name. It uses a label selector to find every Pod carrying the right labels.

Here is what labels look like in a manifest:

```yaml
# illustrative only
metadata:
  labels:
    app: frontend
    env: staging
    version: v2
```

Any number of key-value pairs. Keys and values are plain strings. Now let us make this real.

## Creating a Pod with Labels

```bash
nano labeled-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: labeled-pod
  labels:
    app: web
    env: staging
spec:
  containers:
    - name: web
      image: nginx:1.28
```


```bash
kubectl apply -f labeled-pod.yaml
```

Once the Pod is running, read its labels directly:

```bash
kubectl get pod labeled-pod --show-labels
```

The `LABELS` column at the end of the output shows all key-value pairs attached to the object. Now filter across all Pods in the namespace:

```bash
kubectl get pods -l app=web
kubectl get pods -l env=staging
```

The `-l` flag stands for "label selector". You are telling the API server: return only resources that carry this label. Without labels, this query would be impossible.

## Modifying Labels on a Running Object

You do not have to edit a file to add or change labels. The `kubectl label` command works directly on live objects:

```bash
kubectl label pod labeled-pod tier=frontend
kubectl get pod labeled-pod --show-labels
```

The Pod now carries three labels: `app=web`, `env=staging`, and `tier=frontend`. To change the value of an existing label, you must pass `--overwrite`:

```bash
kubectl label pod labeled-pod env=production --overwrite
kubectl get pod labeled-pod --show-labels
```

:::warning
If you try to change an existing label without `--overwrite`, kubectl returns an error: `'env' already has a value (staging), and --overwrite is false`. This is intentional. kubectl protects you from silently overwriting a label that another tool or person may have set deliberately.
:::

To remove a label entirely, append a `-` to the key name:

```bash
kubectl label pod labeled-pod tier-
kubectl get pod labeled-pod --show-labels
```

The `tier` label is gone. `env` now reads `production`.

:::quiz
How many labels does `labeled-pod` have after all the commands above?

**Try it:** `kubectl get pod labeled-pod --show-labels`

**Answer:** Two labels remain: `app=web` and `env=production`. The `tier` label was removed with the trailing `-` syntax, and `env` was overwritten from `staging` to `production`.
:::

## Filtering with Multiple Labels

@@@
graph LR
    POD1["Pod\napp=web\nenv=staging"]
    POD2["Pod\napp=web\nenv=production"]
    POD3["Pod\napp=api\nenv=staging"]
    SEL1["-l app=web\nmatches POD1 + POD2"]
    SEL2["-l app=web,env=staging\nmatches POD1 only"]
    SEL1 --> POD1
    SEL1 --> POD2
    SEL2 --> POD1
@@@

When you pass multiple labels to `-l`, Kubernetes applies AND logic: every label in the list must match. A Pod matching `app=web` but not `env=staging` is excluded.

```bash
kubectl get pods -l app=web,env=staging
```

This returns only Pods where both conditions are true simultaneously. There is no OR at this syntax level; for more expressive matching you use set-based selectors, which the next lesson covers.

:::quiz
Why does Kubernetes use labels for selection instead of names or UIDs?

**Answer:** Names are unique per resource type per namespace, which makes them useless for grouping multiple objects. UIDs are immutable and implementation-internal. Labels are flexible, user-defined, and can express any grouping dimension: application, environment, version, team, tier. The same label scheme applies uniformly to Pods, Services, Deployments, and Nodes, which is what makes the whole system composable.
:::

## Cleanup

```bash
kubectl delete pod labeled-pod
```

Labels are the most fundamental metadata primitive in Kubernetes. The next lesson goes deeper into how selectors work inside Deployment and Service specs, and what happens when they go wrong.
