---
seoTitle: 'Kubernetes CPU Throttling OOMKilled, Container Limits Exceeded'
seoDescription: 'Learn what happens when a Kubernetes container exceeds its CPU or memory limit: CPU throttling vs OOMKilled, how to detect each, and how to diagnose CrashLoopBackOff.'
---

# What Happens When Limits Are Exceeded

CPU and memory behave very differently when a container hits its limit. Getting this wrong is a common source of mysterious CrashLoopBackOff. Knowing the exact outcome for each resource type lets you diagnose the problem from the first `kubectl describe`.

## CPU: throttling, not termination

When a container's CPU usage exceeds its CPU limit, the Linux kernel's CFS (Completely Fair Scheduler) throttles it. The process continues running but gets less CPU time per scheduling interval. From inside the container, computations take longer. The application slows down. It is not killed.

Create a Pod with a very low CPU limit and simulate work:

```bash
nano cpu-stress.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cpu-stress
spec:
  containers:
    - name: stressor
      image: busybox:1.36
      command: ['sh', '-c', 'while true; do echo computing; done']
      resources:
        requests:
          cpu: '10m'
        limits:
          cpu: '50m'
  restartPolicy: Never
```

```bash
kubectl apply -f cpu-stress.yaml
kubectl top pod cpu-stress
```

The Pod runs but the `kubectl top` output shows CPU capped near the limit. The container is not killed.

```bash
kubectl describe pod cpu-stress
```

The container state is `Running`. There is no restart count increment from CPU throttling.

## Memory: OOMKilled, immediate termination

When a container's memory usage exceeds its memory limit, the Linux out-of-memory (OOM) killer terminates the container immediately. No warning, no graceful shutdown. The process is killed with `SIGKILL`. The kubelet then restarts the container, resulting in `CrashLoopBackOff` if it keeps happening.

The signature is a container with `State: Terminated`, `Reason: OOMKilled`.

```bash
kubectl describe pod <pod-name>
```

Look for:

```
State:          Terminated
  Reason:       OOMKilled
  Exit Code:    137
```

Exit code 137 means the process was killed with signal 9 (SIGKILL). 128 + 9 = 137. This is the standard Linux convention.

:::quiz
A container restarts repeatedly with `Exit Code: 137` and `Reason: OOMKilled`. What is the most likely cause and how do you fix it?

**Answer:** The container is exceeding its memory limit. The OOM killer terminates it when usage crosses the limit, which is why exit code 137 (SIGKILL) appears. Fix options: increase the memory limit, fix a memory leak in the application, or reduce the application's working set. Check `kubectl top pods` during normal operation to get a baseline, then set the limit above that baseline with reasonable headroom.
:::

@@@
graph TB
subgraph cpu_path ["CPU limit exceeded"]
  C1["Container uses > CPU limit"] --> C2["CFS throttles CPU time"]
  C2 --> C3["Process slows down\nbut keeps running"]
end
subgraph mem_path ["Memory limit exceeded"]
  M1["Container uses > memory limit"] --> M2["OOM killer sends SIGKILL"]
  M2 --> M3["Container terminated\nExit Code: 137"]
  M3 --> M4["Kubelet restarts container\nCrashLoopBackOff if repeated"]
end
@@@

## Diagnosing CrashLoopBackOff from resource limits

`CrashLoopBackOff` means the container is crashing and the kubelet is applying an exponential backoff before each restart. Three common causes that look similar:

- **OOMKilled**: `Exit Code: 137`, `Reason: OOMKilled` in `kubectl describe pod`
- **Application crash**: non-zero exit code (1, 2, etc.), no `OOMKilled` reason, logs contain the error
- **Missing command**: exit code 127 or 0 immediately, usually from a misconfigured `command` field

Check the current state:

```bash
kubectl describe pod <pod-name>
```

Then check if there was a previous container (the one that just crashed):

```bash
kubectl logs <pod-name> --previous
```

The `--previous` flag fetches the logs from the last terminated container instance. This is the most important log for diagnosing a crash: the current container has not produced logs yet (it may be waiting in backoff), but the previous one has the crash output.

:::warning
`kubectl logs <pod>` without `--previous` shows logs from the current running instance. If the container just restarted and has not produced output yet, the log is empty. Always use `--previous` when diagnosing CrashLoopBackOff to see what the last run produced before dying.
:::

:::quiz
`kubectl describe pod my-app` shows `Restarts: 5` and `Exit Code: 1`. `kubectl logs my-app --previous` shows `connection refused: database not found`. Is this an OOM issue?

**Answer:** No. Exit code 1 is a generic application error, not OOM (which would be 137). The logs confirm the cause: the application could not connect to the database. This is a configuration or network issue, not a resource limit issue. Check that the database service is reachable and the connection string is correct.
:::

```bash
kubectl delete pod cpu-stress
```

CPU limit means throttle; memory limit means kill. Exit code 137 plus `OOMKilled` means the limit is too low. `--previous` logs reveal what happened in the last crash. The next lesson covers QoS classes, which control eviction priority when a node runs out of resources.
