---
seoTitle: 'Kubernetes Pod Restart Policies and CrashLoopBackOff'
seoDescription: 'Learn how Kubernetes restartPolicy controls container recovery, when to use Always, OnFailure, or Never, and how to debug CrashLoopBackOff.'
---

# Container Restart Policies

Imagine two programs. The first is a web server: it should run indefinitely, and if it crashes, you want Kubernetes to bring it back automatically. The second is a data processing script: it reads a file, writes results, exits with code 0, and its job is done. You do not want Kubernetes to restart it after a successful run. These two programs need very different behavior, and `restartPolicy` is how you express that difference.

## What restartPolicy controls

The `restartPolicy` field lives in the Pod spec, not inside a container spec. It applies to every container in the Pod, and it has exactly three possible values: `Always`, `OnFailure`, and `Never`.

@@@
graph TD
EXIT["Container exits"]
EXIT --> CODE{Exit code?}
CODE --> ZERO["0 (success)"]
CODE --> NONZERO["non-zero (failure)"]
ZERO --> ALW_R["Always: restart"]
ZERO --> ONFE["OnFailure: no restart"]
ZERO --> NEV_OK["Never: Pod = Succeeded"]
NONZERO --> ALW_R2["Always: restart"]
NONZERO --> ONFE_R["OnFailure: restart"]
NONZERO --> NEV_FAIL["Never: Pod = Failed"]
@@@

**Always** restarts the container every time it stops, regardless of the exit code. A clean exit with code 0? Restart. A crash with code 1? Restart. This is the default value, and it is the right choice for any long-running service.

**OnFailure** restarts the container only when it exits with a non-zero code. A successful exit is respected and the Pod moves to `Succeeded`. This is the right choice for batch jobs and scripts that may occasionally fail and need a retry, but should not be re-run after success.

**Never** means exactly that. Whatever the exit code, Kubernetes will not restart the container. The Pod moves to `Succeeded` if all containers exited 0, or `Failed` if any exited non-zero. Use this for true one-shot tasks where even retrying on failure is not desired.

## Why Always is the default

Why would Kubernetes assume you always want restarts? Because the vast majority of workloads on Kubernetes are services: web servers, APIs, workers listening to queues. For these, a crash is an anomaly, not an expected outcome. `Always` keeps your service running without human intervention, which is the whole point of running on Kubernetes. If you are building a one-shot task, you opt out of this default explicitly.

## Setting restartPolicy in a manifest

```yaml
# illustrative only
spec:
  restartPolicy: OnFailure
  containers:
    - name: processor
      image: busybox:1.36
```

Notice that `restartPolicy` sits at the same level as `containers`, not inside a container definition. This is intentional: one policy governs all containers in the Pod.

:::quiz
You have a worker that processes a task, succeeds, and exits. You want Kubernetes to treat it as successfully completed. Which restart policy should you use?

- `Always`: the container is restarted after every exit, including successful ones
- `OnFailure`: the container is not restarted if the exit code is 0
- `Never`: the container is never restarted, Pod moves to Succeeded or Failed

**Answer:** `OnFailure` or `Never` depending on whether retries on failure are acceptable. `OnFailure` is usually the best fit for jobs: it retries on error but respects a clean exit. `Always` is wrong here because it would restart the container even after a successful run, looping forever.
:::

## The backoff mechanism

Kubernetes does not restart a crashing container instantly every time. It applies exponential backoff: 10 seconds, then 20, 40, 80, up to 5 minutes between attempts. This prevents a broken container from consuming CPU and generating noise at full speed. The `RESTARTS` counter in `kubectl get pods` shows how many times Kubernetes has retried, and the `STATUS` column will show `CrashLoopBackOff` when the backoff is in effect.

:::warning
`CrashLoopBackOff` is not a Kubernetes failure. It means Kubernetes is working correctly: it is restarting the container as instructed, but the container keeps exiting. The problem is inside the container itself. Check `kubectl describe pod <name>` for the exit code, and `kubectl logs <name>` for the container output before it died. The restart policy does not fix bugs; it only controls what Kubernetes does after a bug causes a crash.
:::

:::info
Kubernetes Jobs, which run batch workloads at scale, use `OnFailure` or `Never` by default. Never set `restartPolicy: Always` on a Pod intended to run a finite task. After it succeeds, Kubernetes would restart it immediately, running it again and again indefinitely.
:::

:::quiz
Why does restartPolicy apply to the entire Pod rather than to individual containers?

**Answer:** Containers in a Pod share the same network namespace, the same IP address, and often the same volumes. They are designed to run together as a single unit. Applying different restart strategies to individual containers in the same Pod would create difficult-to-reason-about intermediate states where some containers are running and others are not, against the intent of the shared spec. The Pod is the atom of scheduling, and the restart policy reflects that.
:::

Understanding restart policies makes `CrashLoopBackOff` much less mysterious. You know why Kubernetes keeps retrying, and you know where to look when the retry loop does not resolve itself. The next lesson covers a different kind of constraint: what happens when you need to change a Pod that is already running.
