---
seoTitle: 'Kubernetes Job, Run to Completion, Batch Workloads'
seoDescription: 'Learn what a Kubernetes Job is, how it differs from Deployments and DaemonSets, and how to run a task that completes rather than runs continuously.'
---

# What Is a Job

Every controller you have seen so far has the same goal: keep Pods running. A Deployment restarts a Pod if it exits. A DaemonSet does the same. This is the right behavior for web servers and agents. It is the wrong behavior for a database migration, a report generator, or a batch import. Those tasks should run once, finish, and stop.

A Job is a controller that runs Pods until they succeed. When a Pod completes successfully, the Job considers its work done. If a Pod fails, the Job retries it according to configurable rules. Once the required number of successful completions is reached, the Job stops creating Pods and leaves the completed Pods in place for inspection.

```bash
kubectl get jobs
```

No output yet. Jobs only appear after you create them, and they disappear from active status once they complete. You use `kubectl get jobs` to check completion status, not to watch running Pods.

## The simplest Job manifest

@@@
graph LR
J["Job\ncompletions: 1"] --> P["Pod\nRunning"] --> S["Pod\nSucceeded"]
S --> JC["Job\nComplete"]
JC -. "Pod stays for logs" .-> S
@@@

A Job manifest is minimal. The two required fields inside `spec` are `template` (the Pod spec) and `restartPolicy`. The `restartPolicy` for a Job Pod must be `Never` or `OnFailure`. It cannot be `Always`, because `Always` would prevent the Pod from ever being considered complete.

```bash
nano hello-job.yaml
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: hello-job
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: hello
          image: busybox:1.36
          command: ['sh', '-c', 'echo Hello from a Job && sleep 2']
```

```bash
kubectl apply -f hello-job.yaml
```

## Watching a Job run and complete

```bash
kubectl get pods
```

You will see a Pod named `hello-job-<random>` in `Running` status, then `Completed`. The transition happens quickly because the command only runs for two seconds.

```bash
kubectl get jobs
```

Once the Pod completes successfully, the Job shows `COMPLETIONS: 1/1` and `STATUS: Complete`. The `1/1` means one successful completion out of the one required.

```bash
kubectl logs job/hello-job
```

The completed Pod is still there. You can read its logs even after it finishes. This is intentional: Jobs leave Pods around so you can inspect their output and diagnose failures. The logs show the output of the command that ran inside the container.

:::quiz
A Job Pod exits with code 0. What does the Job controller do next?

**Answer:** It marks the Pod as Succeeded and counts it as a successful completion. If the Job required only one completion (the default), the Job transitions to Complete state. The Pod is not deleted automatically and remains available for log inspection.
:::

## How a Job differs from a Deployment

A Deployment treats any Pod exit as a failure and immediately replaces it. A Job treats a successful exit (exit code 0) as the goal. Once enough Pods exit successfully, the Job is done. A Job treats a non-zero exit as a failure and applies retry logic, which is covered in the backoff lesson.

:::warning
If you set `restartPolicy: Always` in a Job Pod template, the API server will reject the Job with a validation error. `Always` would mean the container restarts inside the Pod after exiting, preventing the Job from ever detecting a completion. Use `Never` when you want the Pod to stop immediately on failure, or `OnFailure` when you want the container to restart within the same Pod.
:::

:::quiz
What is the difference between `restartPolicy: Never` and `restartPolicy: OnFailure` in a Job?

**Answer:** `OnFailure` restarts the container inside the same Pod when the container exits with a non-zero code. The Pod stays Running. `Never` stops the Pod immediately on any exit, successful or not. A new Pod is then created by the Job controller if a retry is needed. With `Never`, each attempt is a separate Pod, which makes it easier to inspect each attempt's logs individually.
:::

```bash
kubectl delete job hello-job
```

This also deletes the completed Pod. Jobs own their Pods: deleting the Job cleans up all associated Pods.

A Job is the correct abstraction whenever a task has a defined end point. The next lesson covers how to configure a Job to run multiple tasks in parallel and require more than one successful completion.
