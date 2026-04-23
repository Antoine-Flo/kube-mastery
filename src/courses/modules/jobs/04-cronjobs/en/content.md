---
seoTitle: 'Kubernetes CronJob, Scheduled Jobs, Cron Schedule Syntax'
seoDescription: 'Learn how to schedule recurring Jobs with CronJob, understand the cron syntax, manage history limits, and handle concurrency and missed schedules.'
---

# CronJobs

You need to run a database backup every night at 2 AM. A Job runs once when you create it. A CronJob wraps a Job template with a schedule expression. At each scheduled time, the CronJob controller creates a new Job, which in turn creates a Pod. The backup runs, the Pod completes, and the cycle repeats on the next scheduled trigger.

```bash
nano backup-cron.yaml
```

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-cron
spec:
  schedule: '*/2 * * * *'
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: busybox:1.36
              command: ['sh', '-c', 'echo Running backup at $(date)']
```

The schedule `*/2 * * * *` means every 2 minutes. For a real nightly backup you would use `0 2 * * *`. The `*/2` schedule is used here because the simulation moves faster than wall time.

```bash
kubectl apply -f backup-cron.yaml
```

## Reading the cron schedule syntax

@@@
graph LR
S["schedule: '0 2 * * *'"] --> F1["minute: 0"]
S --> F2["hour: 2"]
S --> F3["day of month: * (any)"]
S --> F4["month: * (any)"]
S --> F5["day of week: * (any)"]
F1 & F2 & F3 & F4 & F5 --> R["Runs at 02:00 every day"]
@@@

The five fields are: minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6, where 0 is Sunday). Common patterns:

- `0 * * * *`: every hour on the hour
- `*/15 * * * *`: every 15 minutes
- `0 9 * * 1`: every Monday at 9:00 AM
- `0 0 1 * *`: first day of every month at midnight

## Watching the CronJob create Jobs

```bash
kubectl get cronjobs
```

The `LAST SCHEDULE` column shows when the most recent Job was triggered. The `ACTIVE` column shows how many Jobs are currently running.

```bash
kubectl get jobs
```

Each run creates a Job named `backup-cron-<timestamp>`. After the CronJob runs a few times, you will see multiple completed Jobs in the list.

```bash
kubectl get pods
```

Completed Pods from past Job runs also accumulate. The CronJob keeps a history of completed and failed Jobs for debugging.

:::quiz
A CronJob has `schedule: '0 8 * * 1-5'`. When does it run?

**Answer:** Every weekday (Monday through Friday) at 08:00. The `1-5` in the day-of-week field selects days 1 through 5, which correspond to Monday through Friday.
:::

## History limits and cleanup

By default, a CronJob retains the last 3 successful Jobs and the last 1 failed Job. As runs accumulate, older Jobs and their Pods are garbage-collected automatically.

You can control these limits:

```yaml
spec:
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 3
```

Setting `successfulJobsHistoryLimit: 0` keeps no history at all: completed Jobs and Pods are deleted immediately. This reduces cluster noise but means you lose access to logs from past runs. For debugging, keep at least the last 1 or 2 successful runs.

## Concurrency and missed schedules

Two fields handle edge cases in scheduling:

**`concurrencyPolicy`** controls what happens if a Job is still running when the next trigger fires:
- `Allow` (default): a new Job starts regardless of the previous one's status.
- `Forbid`: the new run is skipped if the previous Job is still active.
- `Replace`: the current Job is terminated and a new one starts.

**`startingDeadlineSeconds`** handles missed triggers. If the CronJob controller was down for a period, Kubernetes counts how many triggers were missed. If the count exceeds 100, the CronJob stops trying to catch up. Setting `startingDeadlineSeconds: 300` tells Kubernetes to only attempt a missed run if less than 300 seconds have passed since the scheduled time.

:::warning
If a CronJob misses more than 100 scheduled runs (which can happen if the controller is stopped for a long period), it will stop scheduling entirely and log a warning. You would need to inspect the CronJob with `kubectl describe cronjob <name>` to see the `TooManyMissedStartTimes` condition, and manually trigger a one-off Job if needed.
:::

```bash
kubectl create job manual-backup --from=cronjob/backup-cron
```

This creates an immediate Job from the CronJob's `jobTemplate`, outside the normal schedule. Useful for testing the Job template or triggering a run on demand.

:::quiz
A CronJob has `concurrencyPolicy: Forbid`. The 9:00 AM Job is still running at 9:05 AM when the next trigger fires. What happens?

**Answer:** The 9:05 AM run is skipped entirely. The CronJob controller sees an active Job and does not create a new one. The 9:00 AM Job continues running undisturbed. The skipped run is recorded in the CronJob status.
:::

```bash
kubectl delete cronjob backup-cron
```

CronJobs add scheduling on top of Jobs without changing the Job semantics you already know. The `schedule` field follows standard cron syntax, `concurrencyPolicy` handles overlapping runs, and the history limits keep the cluster tidy. The next module covers `commands-and-args`, which controls exactly what a container runs when it starts.
