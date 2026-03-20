# Pod Lifecycle and Phases

A Pod is not a static thing. From the moment it's created to the moment it's gone, it passes through a defined set of states that tell you exactly where it is in its journey. Understanding these states is essential for monitoring your applications, diagnosing problems, and writing automation that reacts correctly to the cluster's condition.

:::info
Kubernetes tracks Pod health at three levels: the **phase** (high-level summary), **container states** (what each container is doing), and **conditions** (boolean checkpoints like `Ready` and `Initialized`).
:::

## Pod Phases

The **phase** is a high-level summary of where the Pod is in its lifecycle. There are exactly five possible phases, and a Pod is in exactly one of them at any given moment.

### `Pending`

A Pod enters `Pending` when it has been accepted by the API server and stored in etcd, but isn't running yet. Common reasons:

- The scheduler hasn't yet assigned the Pod to a node (waiting for resources, or constrained by node selectors/affinity rules)
- The container image is being pulled from the registry

### `Running`

A Pod enters `Running` when it has been bound to a node and at least one container is running. Note the nuance: _at least one_ container. A Pod with three containers is `Running` even if only one has started, or if a container has crashed and is being restarted. This is the normal, healthy state for long-lived workloads.

### `Succeeded`

A Pod reaches `Succeeded` when **all** containers have exited with a zero exit code and will not be restarted. This is the expected terminal state for Jobs and batch workloads, tasks that are meant to run once, complete their work, and exit cleanly.

### `Failed`

A Pod reaches `Failed` when **at least one** container has exited with a non-zero exit code and the restart policy does not allow further retries. A Pod with `restartPolicy: Never` will enter `Failed` immediately if any container exits with an error.

### `Unknown`

`Unknown` is an error state: the API server cannot determine what state the Pod is in because it lost communication with the node. This typically happens when a node fails catastrophically or is partitioned from the network.

:::warning
If you see Pods stuck in `Unknown`, investigate the health of the node they're running on. Check `kubectl get nodes` for a `NotReady` status. `Unknown` Pods are not necessarily dead, the node might just be temporarily unreachable, but they need attention.
:::

## The Phase State Machine

The diagram below shows how a Pod transitions between phases over its lifetime:

```mermaid
stateDiagram-v2
    [*] --> Pending: kubectl apply / create
    Pending --> Running: Scheduled + at least one container starts
    Pending --> Failed: Scheduling fails (permanently)
    Running --> Succeeded: All containers exit 0
    Running --> Failed: Container exits non-zero<br/>(no more restarts)
    Running --> Unknown: Node communication lost
    Unknown --> Running: Node reconnects
    Unknown --> Failed: Node confirmed lost, Pod evicted
    Succeeded --> [*]
    Failed --> [*]
```

## Container States: The Next Level of Detail

While Pod phases give you the broad picture, **container states** tell you what's happening inside each individual container. You can see container states in `kubectl describe pod`. Each container can be in one of three states:

### `Waiting`

A container is `Waiting` when it's not yet running but is getting ready. The `reason` field tells you why. Common reasons:

- `ContainerCreating`: The container is being set up (volumes being mounted, etc.)
- `PodInitializing`: Waiting for init containers to complete
- `ImagePullBackOff`: The image pull failed; Kubernetes is backing off before retrying
- `CrashLoopBackOff`: The container keeps crashing; Kubernetes is delaying the next restart attempt

`CrashLoopBackOff` is one of the most common error states you'll encounter. It means the container started, ran briefly, crashed, and Kubernetes tried to restart it, only for it to crash again. The "BackOff" part means Kubernetes is using an **exponential backoff** delay between restart attempts. We'll cover this in the restart policies lesson.

### `Running`

The container process is actively executing. A running container has a `startedAt` timestamp you can inspect.

### `Terminated`

The container has finished, either successfully or with an error. The `Terminated` state includes an `exitCode` and a `reason`. Common reasons:

- `Completed`: Exited normally with code 0
- `OOMKilled`: Killed by the kernel's out-of-memory killer for exceeding its memory limit
- `Error`: Exited with a non-zero code

`OOMKilled` deserves special mention. When a container exceeds its memory `limit`, the Linux kernel kills the process immediately, Kubernetes doesn't wait for it to crash on its own. If you see this frequently, your memory limit is too low.

:::info
You can view container states directly with:

```bash
kubectl describe pod <name>
```

Look for the `State:` and `Last State:` fields under each container.
:::

## Pod Conditions

In addition to phases and container states, Pods have a set of **conditions**, boolean flags that indicate specific checkpoints in the Pod's readiness. You can see them in `kubectl describe pod` under the `Conditions:` heading.

The four standard conditions are:

- **`PodScheduled`**: Has the Pod been assigned to a node? Stays `False` if no node has enough resources.
- **`Initialized`**: Have all init containers completed successfully?
- **`ContainersReady`**: Are all containers running and passing their readiness probes?
- **`Ready`**: Is the Pod ready to serve traffic? This aggregates the others. Only when `Ready` is `True` will a Service route traffic to this Pod.

The `Ready` condition is what Kubernetes uses to determine whether a Pod should receive traffic. If a container's readiness probe starts failing, `Ready` becomes `False` and the Service stops routing to that Pod, even though the container is still running. This lets Kubernetes gracefully handle a slow or partially broken container without killing it outright.

## Hands-On Practice

Let's observe phases, container states, and conditions live in the cluster.

**1. Create a normal Pod and watch its phase transitions in the visualizer:**

```bash
kubectl run lifecycle-pod --image=nginx:1.28
```

You should see the phase go from `Pending` to `ContainerCreating` to `Running`.

**2. Inspect the full status including conditions:**

```bash
kubectl describe pod lifecycle-pod
```

Look for the `Conditions:` section and the `State:` field under `Containers:`.

**3. View conditions in raw form:**

```bash
kubectl get pod lifecycle-pod -o jsonpath='{.status.conditions}'
```

**4. Simulate a failing container to observe CrashLoopBackOff:**

```bash
kubectl run crash-pod --image=busybox:1.36 --restart=Always -- sh -c "exit 1"
```

Then watch it:

```bash
kubectl get pod crash-pod --watch
```

You'll see it cycle through `Error` → `CrashLoopBackOff` repeatedly, with increasing backoff delays.

**5. Describe the crash Pod for details:**

```bash
kubectl describe pod crash-pod
```

Look at the `Last State:` field under the container, it will show `Terminated` with `Reason: Error` and `Exit Code: 1`. Also note `Restart Count:` increasing with each cycle.

**6. Create a short-lived Pod that succeeds:**

```bash
kubectl run success-pod --image=busybox:1.36 --restart=Never -- sh -c "exit 1"
kubectl get pod success-pod --watch
```

Watch it go from `Pending` to `Running` to `Completed`. The `Completed` status corresponds to the `Succeeded` phase.

**7. Check the exit code of the completed Pod:**

```bash
kubectl get pod success-pod -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}'
```

The exit code should be `0`.

**8. Clean up:**

```bash
kubectl delete pod lifecycle-pod crash-pod success-pod
```

With a firm grasp of Pod phases, container states, and conditions, you now have the vocabulary to read and interpret the cluster's signals, whether things are running smoothly or something has gone sideways. These signals are your first line of defense when debugging production issues.
