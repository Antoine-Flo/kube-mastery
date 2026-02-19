# Rollout Status

You have triggered a rolling update — but how do you know it is actually working? Is it halfway done? Did it stall? Are users being affected? Monitoring a rollout is like watching the dashboard of a running machine: the gauges tell you whether everything is on track or whether you need to intervene.

Kubernetes provides several tools to observe rollout progress, from a single blocking command to detailed column-by-column inspection. Mastering these will give you confidence every time you ship a change.

## Watching the Rollout in Real Time

The primary command for monitoring a rollout is `kubectl rollout status deployment/<name>`. This command **blocks** your terminal and streams progress updates until the rollout either completes successfully or fails. You will see output like:

```
Waiting for deployment "nginx-deployment" rollout to finish: 1 out of 3 new replicas have been updated...
Waiting for deployment "nginx-deployment" rollout to finish: 2 out of 3 new replicas have been updated...
deployment "nginx-deployment" successfully rolled out
```

Think of it as a progress bar for your deployment. When the final line reads "successfully rolled out," every Pod is running the new template and ready to serve traffic. If you prefer continuous monitoring without blocking, use `kubectl get deployment nginx-deployment -w` to watch the status columns update in real time.

## Reading the Status Columns

When you run `kubectl get deployments`, the output includes four key columns that together paint a complete picture:

```
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3/3     3            3           10m
```

Each column answers a specific question:

| Column | What it tells you |
|---|---|
| **READY** | How many Pods are running and ready vs. how many are desired. `2/3` means one Pod is not yet ready. |
| **UP-TO-DATE** | How many Pods match the *latest* Pod template. During a rollout, this number climbs from 0 to the desired count. |
| **AVAILABLE** | How many Pods are actually available to serve traffic — they have passed readiness probes and meet the minimum availability window. |
| **AGE** | Time since the Deployment was first created (not since the last update). |

During an active rollout, you might see something like:

```
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3/3     1            3           10m
```

Here, `UP-TO-DATE: 1` means only one Pod has been updated so far, while `READY: 3/3` tells you three Pods are available overall (a mix of old and new). As the rollout progresses, `UP-TO-DATE` climbs to 3 and the old Pods are terminated.

:::info
A rollout is considered **complete** when three conditions are met: the new ReplicaSet has the desired number of Pods, all those Pods are ready, and the old ReplicaSet has scaled to zero. Until all three are true, the rollout is still in progress.
:::

## Inspecting ReplicaSets During a Rollout

For deeper visibility, look at the ReplicaSets directly with `kubectl get replicasets -l app=nginx-deployment`. During a rollout, you will see both the old and new ReplicaSets. When the rollout finishes, the old ReplicaSet drops to zero replicas but remains in the cluster — it serves as the rollback target if you ever need to revert. Use `kubectl get pods -l app=nginx-deployment -o wide` to see the individual Pods and which node they landed on.

## The Progress Deadline

Kubernetes does not wait forever for a rollout to complete. The `progressDeadlineSeconds` field (default: 600 seconds) sets a time limit. If the Deployment fails to make progress within this window — for example, because new Pods keep crash-looping or failing readiness checks — the rollout is marked as **failed**.

```yaml
spec:
  progressDeadlineSeconds: 600
  strategy:
    type: RollingUpdate
```

"Progress" here means any change in the rollout state — a new Pod becoming ready, an old Pod being terminated. As long as *something* is moving forward, the clock resets. But if the rollout is completely stuck for 600 seconds, Kubernetes flags it. A failed rollout produces an error exit code when you run `kubectl rollout status`, with a message like `error: deployment "nginx-deployment" exceeded its progress deadline`.

:::warning
A "successful" rollout means the controller finished replacing Pods — it does not guarantee your application is healthy. A Pod can pass its readiness probe but still serve errors. Always validate with application-level health checks, logs, and metrics after every rollout.
:::

## When a Rollout Stalls

If a rollout is not progressing, here is a diagnostic checklist:

1. **Check Deployment events**: `kubectl describe deployment nginx-deployment` — the Events section shows exactly what the controller is doing.
2. **Inspect pending Pods**: `kubectl describe pod <pod-name>` — look for scheduling failures, image pull errors, or crash loops.
3. **Review logs**: `kubectl logs <pod-name>` — the application itself may be crashing on startup.
4. **Consider reverting**: If the issue is not quickly resolvable, `kubectl rollout undo deployment/nginx-deployment` restores the previous version immediately.

---

## Hands-On Practice

### Step 1: Create a deployment

```bash
kubectl create deployment nginx-deployment --image=nginx:1.14.2 --replicas=3
```

**Observation:** Three Pods running nginx:1.14.2 are created.

### Step 2: Trigger an update

```bash
kubectl set image deployment/nginx-deployment nginx=nginx:1.16.1
```

**Observation:** A rolling update begins. The Deployment controller creates a new ReplicaSet.

### Step 3: Run kubectl rollout status

```bash
kubectl rollout status deployment/nginx-deployment
```

**Observation:** The command blocks and shows progress — "1 out of 3 new replicas have been updated...", then "successfully rolled out". This is your real-time rollout monitor.

### Step 4: Inspect ReplicaSets

```bash
kubectl get rs -l app=nginx
```

**Observation:** You see both the old and new ReplicaSets. The old one is scaled to zero; the new one has 3 replicas. The old ReplicaSet remains for rollback.

### Step 5: Check status columns

```bash
kubectl get deployment nginx-deployment
```

**Observation:** The `READY`, `UP-TO-DATE`, and `AVAILABLE` columns all show `3/3`. During an active rollout, `UP-TO-DATE` would climb from 0 to 3 as new Pods become ready.

### Step 6: View Pods with node info

```bash
kubectl get pods -l app=nginx-deployment -o wide
```

**Observation:** You see each Pod, its status, the node it runs on, and the pod IP. Useful for understanding placement and debugging.

### Step 7: Clean up

```bash
kubectl delete deployment nginx-deployment
```

**Observation:** The Deployment and all its Pods are removed.

---

## Wrapping Up

Monitoring rollouts is essential to deploying with confidence. Use `kubectl rollout status` for a blocking progress view, `kubectl get deployment -w` for continuous observation, and inspect ReplicaSets and Pods for detailed state. The status columns — `READY`, `UP-TO-DATE`, and `AVAILABLE` — tell you at a glance where the rollout stands. And when things go wrong, the `progressDeadlineSeconds` safeguard flags stalled rollouts so they do not hang indefinitely. The next lesson covers rollback — how to revert to a previous version when an update causes problems.
