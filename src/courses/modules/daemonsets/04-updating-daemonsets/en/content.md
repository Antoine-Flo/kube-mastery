---
seoTitle: 'Updating DaemonSets, RollingUpdate, OnDelete, kubectl rollout'
seoDescription: 'Learn how to update a DaemonSet image with RollingUpdate and OnDelete strategies, control the rollout pace with maxUnavailable, and roll back safely.'
---

# Updating DaemonSets

You need to update a log agent DaemonSet to a new image version across 20 nodes. Unlike a Deployment, you cannot take a DaemonSet offline during the update. The agents must keep running on as many nodes as possible throughout. DaemonSets support two update strategies: `RollingUpdate`, which handles this automatically, and `OnDelete`, which gives you manual control per node.

First, create a DaemonSet to work with:

```bash
nano update-agent.yaml
```

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: update-agent
spec:
  selector:
    matchLabels:
      app: update-agent
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: update-agent
    spec:
      containers:
        - name: agent
          image: busybox:1.35
```

```bash
kubectl apply -f update-agent.yaml
kubectl get pods -o wide
```

Note the current image version in the Pod spec. You will update it in a moment.

## RollingUpdate: one node at a time

@@@
graph LR
N1["node-1\nbusybox:1.35 running"] -->|"delete + replace"| N1U["node-1\nbusybox:1.36 ready"]
N2["node-2\nbusybox:1.35 running"] -->|"wait"| N2W["node-2\nbusybox:1.35 (waiting)"]
N3["node-3\nbusybox:1.35 running"] -->|"wait"| N3W["node-3\nbusybox:1.35 (waiting)"]
N1U -->|"moves to next"| N2U["node-2\nbusybox:1.36 ready"]
@@@

With `RollingUpdate` and `maxUnavailable: 1`, the DaemonSet controller deletes one Pod and waits for its replacement to become Ready before moving to the next node. At most one node is missing its agent at any point during the update.

Trigger the update by changing the image:

```bash
kubectl set image daemonset/update-agent agent=busybox:1.36
```

Watch the rollout progress:

```bash
kubectl rollout status daemonset/update-agent
```

The output shows each node as the update proceeds. Once the command returns, all nodes are running the new image.

:::quiz
A DaemonSet has `maxUnavailable: 2` and runs on 6 nodes. During a rolling update, how many nodes can be missing their Pod simultaneously?

**Answer:** 2. `maxUnavailable` for a DaemonSet sets the maximum number of nodes that can have their Pod down at the same time during a rolling update. With `maxUnavailable: 2` on 6 nodes, at most 2 nodes are unprotected at any moment.
:::

## Inspecting the rollout

```bash
kubectl describe daemonset update-agent
```

Look at the `Events` section. You will see lines like `SuccessfulCreate` for each new Pod and `SuccessfulDelete` for each old one. During a rolling update, these events alternate as the controller cycles through nodes.

Check the current image across all Pods:

```bash
kubectl get pods -l app=update-agent -o yaml
```

All Pods should now show `image: busybox:1.36`. If any Pod still shows the old image, the rollout stalled. The most common reason is a node condition that prevents the new Pod from reaching Ready.

## Rolling back

If the new image has a problem, roll back with the same command you use for Deployments:

```bash
kubectl rollout undo daemonset/update-agent
```

This restores the previous image on all nodes using the same rolling process. The rollback respects `maxUnavailable` just like a forward update.

:::warning
DaemonSet rollout history is limited. Unlike Deployments, which keep old ReplicaSets as rollback points, DaemonSets only retain the immediately previous version. `kubectl rollout undo` goes back one step. There is no multi-step rollback for DaemonSets. If you need the ability to roll back further, maintain your manifests in version control and apply an older version manually.
:::

## OnDelete: manual per-node control

The `OnDelete` strategy updates a Pod only when you explicitly delete it. The DaemonSet controller will not touch running Pods. This gives you node-by-node control over when the update happens.

Change the strategy:

```bash
kubectl patch daemonset update-agent -p '{"spec":{"updateStrategy":{"type":"OnDelete"}}}'
```

Now update the image:

```bash
kubectl set image daemonset/update-agent agent=busybox:1.35
```

Check the Pods. They are still running `busybox:1.36`. The image change was recorded, but no Pods were updated. To apply the update on a specific node, delete the Pod on that node:

```bash
kubectl delete pod -l app=update-agent --field-selector spec.nodeName=sim-worker
```

The DaemonSet controller immediately creates a replacement Pod, this time with the new image. You control exactly when each node gets updated.

:::quiz
You are running a DaemonSet with `OnDelete` strategy and update the image. You check the Pods and they all still show the old image. Is this a bug?

**Answer:** No. `OnDelete` is intentional behavior. The DaemonSet records the new desired image but does not touch existing Pods. Each Pod is only updated when you manually delete it. This is useful when you need to update nodes one at a time with human oversight between each step.
:::

```bash
kubectl delete daemonset update-agent
```

`RollingUpdate` handles most production scenarios well: it keeps coverage high, moves automatically through all nodes, and supports rollback. `OnDelete` is the choice when your update process requires manual validation between nodes, such as a firmware driver update that needs a maintenance window per node. The next module covers Jobs and CronJobs, which handle batch and scheduled workloads instead of continuously running processes.
