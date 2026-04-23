---
seoTitle: 'Kubernetes Job Failure, backoffLimit, activeDeadlineSeconds'
seoDescription: 'Learn how Kubernetes Jobs handle Pod failures, configure retry limits with backoffLimit, set deadlines with activeDeadlineSeconds, and diagnose stuck Jobs.'
---

# Job Failure, Backoff, and Retry

A Job Pod exits with code 1. The Job controller retries it. The next attempt also fails. And the next. Without limits, the Job would retry forever, wasting resources and hiding the root cause. Two fields control this: `backoffLimit` caps the number of retries, and `activeDeadlineSeconds` caps the total elapsed time. Together they ensure a failing Job surfaces its error rather than looping silently.

Create a Job that always fails so you can observe the retry behavior:

```bash
nano failing-job.yaml
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: failing-job
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: busybox:1.36
          command: ['sh', '-c', 'echo failing && exit 1']
```

```bash
kubectl apply -f failing-job.yaml
```

## What backoffLimit does

@@@
graph LR
P0["Attempt 1\nexit 1"] -->|"retry"| P1["Attempt 2\nexit 1"]
P1 -->|"retry"| P2["Attempt 3\nexit 1"]
P2 -->|"retry"| P3["Attempt 4\nexit 1"]
P3 -->|"backoffLimit=3 reached"| F["Job: Failed"]
@@@

`backoffLimit` is the maximum number of Pod failures allowed before the Job is marked `Failed`. With `backoffLimit: 3`, the Job controller creates up to 4 Pods total (the initial attempt plus 3 retries). When the fourth attempt fails, no more Pods are created and the Job transitions to `Failed`.

Watch the Pods appear:

```bash
kubectl get pods -l job-name=failing-job --watch
```

You will see four Pods with names `failing-job-<hash>`. Each shows `Error` status. After the fourth failure, no new Pod appears.

```bash
kubectl get jobs
```

The Job shows `STATUS: Failed` and `COMPLETIONS: 0/1`.

```bash
kubectl describe job failing-job
```

Look at the `Events` section. The final event reads something like `BackoffLimitExceeded`. This is the condition that stopped retries.

:::quiz
A Job has `backoffLimit: 2` and `restartPolicy: Never`. The Pod fails each time. How many Pods are created in total before the Job is marked Failed?

**Answer:** 3 Pods. The Job creates one initial Pod plus two retries (backoffLimit: 2 means two retry attempts). After the third failure, no more Pods are created. With `restartPolicy: Never`, each attempt is a distinct Pod, so you have three separate Pod objects all in Error state.
:::

## Diagnosing failures

The failed Pods remain available for inspection. Check the last attempt's logs:

```bash
kubectl get pods -l job-name=failing-job
```

Copy one of the Pod names, then:

```bash
kubectl logs <pod-name>
```

In a real failure scenario, the container's stdout and stderr tell you what went wrong before the process exited. This is why `restartPolicy: Never` is often preferable: each failed attempt is a separate Pod with its own logs. With `restartPolicy: OnFailure`, the container restarts inside the same Pod and the previous attempt's logs may be overwritten.

## Setting a deadline with activeDeadlineSeconds

`backoffLimit` counts failures. `activeDeadlineSeconds` counts time. It sets an upper bound on how long a Job can run from start to finish, including all retries. If the Job is still not complete when the deadline expires, the running Pod is terminated and the Job is marked `Failed` with reason `DeadlineExceeded`.

```bash
nano deadline-job.yaml
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: deadline-job
spec:
  activeDeadlineSeconds: 10
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: busybox:1.36
          command: ['sh', '-c', 'sleep 60']
```

```bash
kubectl apply -f deadline-job.yaml
```

After 10 seconds:

```bash
kubectl describe job deadline-job
```

The `Reason` field in the Job status shows `DeadlineExceeded`. The Pod was terminated before the sleep completed.

:::warning
`activeDeadlineSeconds` is measured from the moment the Job was created, not from the moment a Pod started running. If scheduling is slow (for example, the cluster is under pressure and the Pod stays Pending for several seconds), that time counts against the deadline. Set deadlines conservatively for Jobs where scheduling delay is possible.
:::

:::quiz
A Job has `backoffLimit: 5` and `activeDeadlineSeconds: 30`. The first Pod fails after 25 seconds. Does the Job retry?

**Answer:** Possibly once, but quickly. The Job has 5 seconds left before the deadline. If the second Pod fails or does not complete within that window, the Job fails with DeadlineExceeded. The backoffLimit and activeDeadlineSeconds are independent: whichever limit is hit first stops the Job.
:::

```bash
kubectl delete job failing-job deadline-job
```

`backoffLimit` prevents silent infinite retry loops. `activeDeadlineSeconds` prevents Jobs from holding cluster resources indefinitely when something hangs rather than crashes. Use both together for robust batch workloads. The next lesson covers CronJobs, which schedule Jobs to run automatically at recurring intervals.
