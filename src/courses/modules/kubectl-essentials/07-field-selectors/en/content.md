---
seoTitle: 'kubectl field selectors, filter by status phase, spec node'
seoDescription: 'Learn how to use kubectl field selectors to filter Kubernetes resources by built-in fields like status.phase and spec.nodeName, and how they differ from label selectors.'
---

# Field Selectors

You have used `-l app=web` to filter Pods by a label you defined. But what if you want to filter by something Kubernetes manages, not something you attached? Which Pods are currently running? Which Pods landed on a specific node? Which events belong to a specific Pod? You did not write those values into a label. They are fields in the object itself. That is where field selectors come in.

## Labels vs Fields

Label selectors filter by values you chose and attached. Field selectors filter by values Kubernetes computes and stores in the object's structure.

@@@
graph LR
  L["-l app=web\nLabel selector\nFilters by user-defined labels"] --> LP["Returns Pods where\nlabels.app == web"]
  F["--field-selector=status.phase=Running\nField selector\nFilters by object fields"] --> FP["Returns Pods where\nstatus.phase == Running"]
@@@

A label is arbitrary metadata you control. A field is a specific path inside the object, like `status.phase` or `spec.nodeName`. Field selectors let you query on the structure of the object, not just the metadata you annotated it with.

## Filtering by Phase

The most common use case is filtering Pods by their current phase. Create a few Pods to work with:

```bash
kubectl create deployment web --image=nginx:1.28 --replicas=3
kubectl get pods
```

Once they are running, filter to show only the running ones:

```bash
kubectl get pods --field-selector=status.phase=Running
```

You can also invert the filter using `!=`:

```bash
kubectl get pods --field-selector=status.phase!=Running
```

This returns every Pod not currently in the Running phase: Pending, Succeeded, Failed, or Unknown. In a healthy cluster this list is usually empty. In a cluster with problems, it is where you look first.

:::quiz
You want to list all Pods that are not in the Running phase across the default namespace. Which command gives you that?

- `kubectl get pods -l status.phase!=Running`
- `kubectl get pods --field-selector=status.phase!=Running`
- `kubectl get pods --field-selector=status!=Running`

**Answer:** `kubectl get pods --field-selector=status.phase!=Running`. Label selectors use `-l`. Field selectors use `--field-selector`. The path must be the full field path, so `status.phase`, not just `status`.
:::

## Filtering by Node

Another indexed field on Pods is `spec.nodeName`, which holds the name of the node the scheduler assigned this Pod to. In a multi-node cluster, this is how you list all Pods on a specific node without `describe`-ing the node itself:

```bash
kubectl get pods --field-selector=spec.nodeName=sim-worker
```

In the simulator, the node name reflects the simulated node. Run `kubectl get nodes` first to confirm the exact name, then use it in the selector.

:::quiz
How would you list all Pods running on a node named `sim-worker`?

**Try it:** `kubectl get nodes` to confirm the node name, then `kubectl get pods --field-selector=spec.nodeName=sim-worker`

**Answer:** The output shows only Pods whose `spec.nodeName` equals `sim-worker`. All other Pods are excluded regardless of their labels.
:::

## Combining Multiple Selectors

You can stack multiple field conditions by separating them with a comma. All conditions must match, the same AND logic you saw with label selectors.

```bash
kubectl get pods --field-selector=status.phase=Running,spec.nodeName=sim-worker
```

This returns only Pods that are Running AND scheduled on `sim-worker`. Each condition narrows the result further.

You can also combine a field selector with a label selector in the same command:

```bash
kubectl get pods -l app=web --field-selector=status.phase=Running
```

Labels and field selectors are independent filters applied together.

## Filtering Events by Object

Field selectors are especially useful for events, because events do not have labels you can filter by. The most useful field is `involvedObject.name`, which lets you scope all events to a specific resource by name.

First, get the name of one of your Pods:

```bash
kubectl get pods
```

Then pull the events for that specific Pod, replacing `web-xxxx` with the actual name:

```bash
kubectl get events --field-selector=involvedObject.name=web-xxxx
```

Without this filter, `kubectl get events` returns every event in the namespace. With it, you see only the events Kubernetes recorded for that one object. This is often faster than `kubectl describe pod`, which also shows events but includes all the other Pod metadata around them.

:::quiz
You want to see only the events related to a Pod named `api-deployment-abc`. Which command is correct?

**Try it:** `kubectl get events --field-selector=involvedObject.name=api-deployment-abc`

**Answer:** The output shows only events where the `involvedObject.name` equals that Pod's name. Other Pods' events are excluded. This is the fastest way to scope event history to one object without reading the full describe output.
:::

## What Fields Are Selectable

Not every field in an object can be used as a field selector. Only fields that are indexed by the API server are supported. The set of supported fields varies by resource type. The consistently supported ones across most resources are `metadata.name` and `metadata.namespace`. Pods additionally support `status.phase`, `spec.nodeName`, and a few others.

:::warning
If you try a field selector on an unsupported field, the API server returns an error, not an empty list. For example, `--field-selector=spec.containers[0].image=nginx` is not an indexed field on Pods and will fail with `field selector not supported`. This is different from a selector that simply matches nothing, which returns an empty list with no error.
:::

:::quiz
You run `kubectl get pods --field-selector=spec.containers[0].image=nginx` and get an error instead of an empty list. Why?

**Answer:** The field `spec.containers[0].image` is not indexed by the API server and cannot be used as a field selector. Only specific fields are indexed. An unsupported field produces an explicit error, not an empty result.
:::

Field selectors and label selectors cover different filtering needs: you reach for labels when you control the metadata, and for field selectors when you need to query on what Kubernetes itself knows about the object. Together with the output formatting flags from the previous lesson, they give you precise control over exactly what information you extract from the cluster.

This module covered the essential kubectl operations: creating, reading, editing, deleting, formatting output, and filtering by field. These patterns apply to every resource type you will encounter. The next module covers kubeconfig, which determines which cluster, which user, and which namespace all of these commands are aimed at.
