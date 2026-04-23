---
seoTitle: 'Kubernetes Job Parallelism and Completions, Batch Processing'
seoDescription: 'Learn how to configure Kubernetes Jobs with multiple completions and parallel execution for batch processing tasks that require running multiple Pods.'
---

# Job Parallelism and Completions

A single-completion Job processes one item. But what if you need to process 10 files, send 50 messages, or run a suite of integration tests? You could create 10 separate Jobs, but that is repetitive and hard to track. A single Job with `completions: 10` and `parallelism: 3` runs three Pods simultaneously, tracks how many have succeeded, and stops when 10 completions are recorded.

```bash
nano batch-job.yaml
```

Start with the Job that requires multiple completions:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: batch-job
spec:
  completions: 6
  parallelism: 2
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: busybox:1.36
          command: ['sh', '-c', 'echo Processing item && sleep 3']
```

```bash
kubectl apply -f batch-job.yaml
```

## What completions and parallelism control

@@@
graph TB
subgraph run ["Job: completions=6, parallelism=2"]
  direction LR
  R1["Wave 1\nPod-1 Pod-2\n(2 running)"] --> R2["Wave 2\nPod-3 Pod-4\n(2 running)"] --> R3["Wave 3\nPod-5 Pod-6\n(2 running)"]
end
R3 --> C["Job: Complete\n6/6 completions"]
@@@

`completions` is the total number of successful Pod exits required before the Job is done. `parallelism` is the maximum number of Pods the Job controller will run simultaneously. The controller creates new Pods as previous ones complete, never exceeding `parallelism`, until `completions` is reached.

Watch the Pods as they run:

```bash
kubectl get pods -l job-name=batch-job --watch
```

You will see two Pods start, reach `Completed`, then two more start, until six total completions are recorded. Press Ctrl+C to exit the watch. Then check the Job:

```bash
kubectl get jobs
```

`COMPLETIONS` shows how many have succeeded out of the total required. `DURATION` shows the elapsed time since the Job started.

:::quiz
A Job has `completions: 9` and `parallelism: 3`. How many waves of Pods will run, assuming no failures?

**Answer:** 3 waves. Each wave runs 3 Pods in parallel. 3 waves x 3 Pods = 9 completions. The Job finishes when all 9 Pods exit successfully.
:::

## Non-indexed vs indexed completion modes

By default, Jobs use non-indexed mode: each Pod is interchangeable and the Job simply counts successful exits. This works for processing items from a shared queue where each worker picks the next available item.

Kubernetes also supports `completionMode: Indexed`. Each Pod receives a unique index via the `JOB_COMPLETION_INDEX` environment variable (0 through completions-1). This lets each Pod know which specific item it is responsible for without an external queue.

```bash
nano indexed-job.yaml
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: indexed-job
spec:
  completions: 4
  parallelism: 2
  completionMode: Indexed
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: busybox:1.36
          command: ['sh', '-c', 'echo "Processing index $JOB_COMPLETION_INDEX"']
```

```bash
kubectl apply -f indexed-job.yaml
kubectl get pods -l job-name=indexed-job
```

Pod names for indexed Jobs include the index: `indexed-job-0-<hash>`, `indexed-job-1-<hash>`. Each Pod processes exactly one index.

```bash
kubectl logs -l job-name=indexed-job
```

Each Pod prints its own index. The four outputs together cover indices 0 through 3 with no overlap and no gap.

:::warning
The default non-indexed mode is fine when workers pull from a shared queue and idempotency is guaranteed. If you use indexed mode, ensure your application actually uses `JOB_COMPLETION_INDEX`. A worker that ignores its index and processes the same default item on every run will appear to succeed while doing no useful work.
:::

:::quiz
You have a dataset of 100 files, each identified by a number 0-99. Which Job configuration is most natural for processing them?

- `completions: 100, parallelism: 10, completionMode: Indexed`
- `completions: 100, parallelism: 10` (non-indexed)
- `completions: 1, parallelism: 100`

**Answer:** `completionMode: Indexed` with `completions: 100`. Each Pod receives a unique index matching a file number, so each Pod processes exactly one specific file. Non-indexed would work too if you have a queue, but indexed is more direct when items are identified by position. The third option runs 100 Pods but only waits for 1 completion, which is incorrect.
:::

```bash
kubectl delete job batch-job indexed-job
```

Parallelism and completions transform a Job from a one-shot task into a batch processing primitive. The next lesson covers what happens when Pods in a Job fail and how to configure retry limits and backoff behavior.
