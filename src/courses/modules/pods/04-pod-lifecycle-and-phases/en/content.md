---
seoTitle: 'Kubernetes Pod Phases, Container States, and Conditions'
seoDescription: 'Understand Kubernetes Pod phases from Pending to Succeeded, container states like CrashLoopBackOff, and readiness conditions that control traffic.'
---

# Pod Lifecycle and Phases

You run `kubectl get pods` and notice a Pod sitting in `Pending` for two full minutes. Is that normal? Is something broken? You need more information before you can answer, and that information lives in the Pod's lifecycle. Kubernetes moves every Pod through a series of well-defined phases, and knowing what each phase means turns a confusing status column into a clear diagnostic signal.

@@@
graph LR
PEND["Pending\nScheduled, pulling image"]
RUN["Running\nAt least one container running"]
SUCC["Succeeded\nAll containers exited 0"]
FAIL["Failed\nAt least one container exited non-zero"]
UNK["Unknown\nNode unreachable"]
PEND --> RUN
RUN --> SUCC
RUN --> FAIL
PEND --> FAIL
RUN --> UNK
@@@

## The Five Phases

A Pod phase is the high-level summary of where the Pod is in its lifecycle. It is stored in `status.phase` and shown in the `STATUS` column of `kubectl get pods`.

**Pending** is the starting point. The cluster has accepted the Pod, but at least one container is not yet running. This happens when the scheduler is still assigning the Pod to a node, when the container image is being pulled from a registry, or when a required volume has not been bound yet. Pending is normal for a few seconds. Two minutes of Pending is a signal to investigate.

**Running** means the Pod has been assigned to a node and at least one container is actively executing, starting up, or restarting. Running does not mean the container is healthy, it only means the process exists. A container can be running but serving errors.

**Succeeded** is a terminal phase: every container in the Pod exited with code 0. The Pod will not restart. This is the expected end state for batch jobs and one-shot tasks.

**Failed** is also terminal: at least one container exited with a non-zero code, and the Pod will not restart again. If you see Failed, something inside the container went wrong.

**Unknown** means the control plane lost contact with the node where the Pod was running. The kubelet stopped reporting. This usually means the node itself is unreachable or crashed.

## Conditions: a finer view

Phase is the summary, but conditions tell the full story. Each Pod carries a set of boolean conditions that describe sub-states within a phase.

`PodScheduled` becomes `True` once the scheduler has assigned the Pod to a node. If it stays `False`, the cluster may be out of resources or the node selectors do not match any available node.

`Initialized` turns `True` when all init containers have completed successfully. Most basic Pods have no init containers, so this condition is immediately `True`.

`ContainersReady` becomes `True` when every container passes its readiness check. A container can be running without being ready.

`Ready` is the condition that Services use to decide whether to send traffic to this Pod. A Pod must have both `ContainersReady` and `Ready` as `True` before it receives any requests. This is the condition you care about most in production.

## Observing the lifecycle

Create a Pod to watch these phases unfold:

```bash
nano lifecycle-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: lifecycle-pod
spec:
  containers:
    - name: web
      image: nginx:1.28
```

```bash
kubectl apply -f lifecycle-pod.yaml
kubectl get pod lifecycle-pod
```

The `STATUS` column shows the current phase. To see conditions and the full event history, use `describe`:

```bash
kubectl describe pod lifecycle-pod
```

:::quiz
Where do you find the Pod conditions, and what events appear in the `Events` section?

**Try it:** `kubectl describe pod lifecycle-pod`

**Answer:** The `Conditions` section lists `PodScheduled`, `Initialized`, `ContainersReady`, and `Ready`, all `True` when the Pod is healthy. The `Events` section shows the sequence: Scheduled, then Pulling, Pulled, Created, and Started. Each step is timestamped so you can measure how long image pull took.
:::

## When things go wrong: ImagePullBackOff

If a Pod stays `Pending` then transitions through `ErrImagePull` into `ImagePullBackOff`, Kubernetes cannot pull the container image. This is often a typo in the image name, a missing tag, or a private registry with no credentials. Kubernetes retries with exponential backoff, so the wait between attempts doubles each time, up to five minutes. Always check `kubectl describe pod <name>` and read the `Events` section to find the exact error message from the container runtime.

You can try this by creating a Pod with a deliberately broken image name:

```bash
kubectl run broken --image=nginx:does-not-exist
```

Then watch the events in the visualizer. Delete the Pod when you are done.

```bash
kubectl delete pod broken
```

## When things go wrong: CrashLoopBackOff

A second failure pattern is `CrashLoopBackOff`. The container starts, but exits almost immediately with a non-zero code. Because the restart policy is `Always` by default, Kubernetes restarts it, but again it crashes. Kubernetes increases the delay between restarts to avoid hammering a broken container. You will see the `RESTARTS` counter climbing and the `STATUS` showing `CrashLoopBackOff`. The fix is almost always inside the container, not in Kubernetes itself.

:::quiz
A Pod is in phase `Running`, but its `Ready` condition is `False`. What can you conclude?

- The Pod crashed and is about to be restarted
- At least one container is running, but the Pod cannot receive traffic yet
- The Pod has not been scheduled to a node

**Answer:** At least one container is running, but the Pod cannot receive traffic yet. `Running` and `Ready` are independent. A Pod can be `Running` with a failing readiness probe, which removes it from Service endpoints without restarting it. The first option describes `CrashLoopBackOff`, and the third would show up as `Pending`, not `Running`.
:::

## Cleanup

```bash
kubectl delete pod lifecycle-pod
```

Pod phases give you the map, and conditions give you the compass. Together they let you locate exactly where in the lifecycle a Pod is stuck and why. The next lesson introduces restart policies, which control what Kubernetes does once a container reaches the end of its lifecycle.
