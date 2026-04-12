---
title: Run Batch Workloads With Different Lifecycles
isDraft: true
description: Create a finite Job and a recurring CronJob, then validate logs and completion history.
tag: cluster_architecture_installation
environment: minimal
ckaTargetMinutes: 7
---

## Create namespace `batch`

### Solution

```bash
kubectl create namespace batch
```

Isolates batch workload objects for the exercise.

## Create a one-shot Job with deterministic output

### Solution

```bash
kubectl create job hello-job -n batch --image=busybox:1.36 -- sh -c 'echo job-start; sleep 2; echo job-done'
```

Deterministic logs make it easier to verify completion under pressure.

## Wait for Job completion and inspect logs

### Solution

```bash
kubectl wait --for=condition=complete job/hello-job -n batch --timeout=60s
kubectl logs -n batch job/hello-job
```

Combining wait and logs confirms both status and actual command execution.

### Validation

```yaml
- type: clusterResourceExists
  kind: Namespace
  name: batch
  onFail: "Le job `hello-job` n'est pas terminé avec succès."
```

## Create a CronJob that runs every 5 minutes

### Solution

```bash
kubectl create cronjob hello-cron -n batch --image=busybox:1.36 --schedule='*/5 * * * *' -- sh -c 'date; echo tick'
```

CronJob validates periodic execution patterns commonly tested in Kubernetes practice labs.

### Validation

```yaml
- type: clusterResourceExists
  kind: Namespace
  name: batch
  onFail: "Le CronJob `hello-cron` n'existe pas."
```

## Validate CronJob scheduling metadata and recent runs

### Solution

```bash
kubectl get cronjob hello-cron -n batch -o wide
kubectl get jobs -n batch --sort-by=.metadata.creationTimestamp
```

Use cron metadata plus job creation order to confirm periodic triggering.

## Optional clean up, delete namespace

### Solution

```bash
kubectl delete namespace batch
```

Removes all created batch resources.
