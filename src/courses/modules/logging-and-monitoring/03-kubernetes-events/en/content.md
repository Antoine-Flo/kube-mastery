---
seoTitle: Kubernetes Events, Warnings, Field Selectors, Retention
seoDescription: Explore Kubernetes Event objects to understand scheduling, image pull failures, and crash loops using kubectl get events and field selectors.
---

# Kubernetes Events

Your Pod has been in `Pending` for five minutes. `kubectl get pods` says `Pending`. That is all it says. The Pod spec looks correct, the image name is right, your resources seem fine. So what is actually happening?

The answer is almost always in the Events.

## What Events Are

Kubernetes Events are first-class API objects, just like Pods or Services. Whenever something significant happens in the cluster, the responsible component creates or updates an Event object. The scheduler cannot find a suitable node: it writes an Event. An image cannot be pulled: the kubelet writes an Event. A container crashes: another Event. A PVC cannot bind: the controller-manager writes an Event.

Events are the cluster's internal activity log. They do not replace container logs, they complement them. Container logs tell you what your application said. Events tell you what Kubernetes itself did or failed to do.

To see all Events in your current namespace, run:

```bash
kubectl get events
```

The output shows the age, type, reason, object name, and a human-readable message for each event. By default they are ordered by creation time, oldest first. To see the most recent activity at the bottom:

```bash
kubectl get events --sort-by=.lastTimestamp
```

:::quiz
You deployed a Pod and it has been `Pending` for two minutes. What command shows you why Kubernetes has not placed it yet?

- kubectl logs my-pod
- kubectl get events --sort-by=.lastTimestamp
- kubectl get pod my-pod -o yaml

**Answer:** `kubectl get events --sort-by=.lastTimestamp` - logs are empty when a Pod never started, and `-o yaml` shows the spec but not scheduling activity. Events capture what the scheduler reported.
:::

## Events Inside Describe

The most common way to check Events in practice is through `kubectl describe`. The Events section always appears at the bottom of the describe output and is automatically scoped to the resource you are describing.

```bash
kubectl describe pod my-pod
```

Look at the last few lines. The Events table there shows exactly what Kubernetes did with that Pod: when it was scheduled, when image pulling started, whether pulling succeeded, and whether the container started successfully. For a Pod that never got past `Pending`, you will see `FailedScheduling` with a message explaining why.

Why does `kubectl describe` include Events automatically? Because diagnosing a resource almost always requires both its configuration and its recent activity. Having to run two commands for that would slow down debugging unnecessarily.

## Event Types and Common Reasons

Events have two types: `Normal` and `Warning`. Normal events are informational milestones. Warning events indicate that something went wrong or may go wrong.

@@@
graph TD
A[Something happens<br/>in the cluster] --> B{Is it expected?}
B -- yes --> C[Normal Event<br/>e.g. Scheduled, Pulled]
B -- no --> D[Warning Event<br/>e.g. BackOff, FailedMount]
C --> E[kubectl get events]
D --> E
@@@

The `reason` field is a short machine-readable label. The most important ones to recognize:

`Scheduled` means the scheduler successfully placed the Pod on a node. `Pulling` and `Pulled` indicate image download progress. `BackOff` appears when a container is crashing repeatedly and the restart interval is growing. `FailedScheduling` means no node matched the Pod's requirements. `FailedMount` means a volume could not be attached or mounted.

Now try creating a Pod with a deliberately broken image name to see what Events look like in failure:

```bash
kubectl run broken --image=nginx:does-not-exist
```

Then watch the events for that Pod:

```bash
kubectl get events --sort-by=.lastTimestamp
```

You should see `Pulling`, then `Failed`, then `BackOff` appearing as Kubernetes tries and retries the image pull.

:::quiz
A Pod shows `ErrImagePull` as its status. Which Event reason is most likely to appear in `kubectl get events`?

- FailedScheduling
- Failed (with a message about pulling the image)
- FailedMount

**Answer:** `Failed` (image pull) - `FailedScheduling` means the Pod was never placed on a node, and `FailedMount` is about volumes, not images.
:::

## Filtering Events with Field Selectors

When your namespace has many resources and many events, the full list gets noisy. You can filter by any field using `--field-selector`.

To see only Warning events:

```bash
kubectl get events --field-selector type=Warning
```

To see events related to a specific object:

```bash
kubectl get events --field-selector involvedObject.name=my-pod
```

To see events with a specific reason:

```bash
kubectl get events --field-selector reason=BackOff
```

These selectors can help you isolate exactly the signal you need without scrolling through unrelated Normal events.

:::quiz
You want to see only the Warning events in the current namespace without any Normal events. What command do you run?

**Try it:** `kubectl get events --field-selector type=Warning`

**Answer:** The `--field-selector type=Warning` filter keeps only Warning events. Without it, Normal scheduling and image pull events fill the output and make Warning events harder to spot.
:::

:::warning
Events are retained for only one hour by default in a standard Kubernetes cluster. If you wait too long after an incident to investigate, the Events that could explain it may already be gone. In the simulator, Events persist for the entire session and do not expire.
:::

Events are often the fastest path from a confusing Pod status to a clear diagnosis. When you do not know where to start, `kubectl get events` and `kubectl describe pod` together will answer most questions without needing to dig further.
