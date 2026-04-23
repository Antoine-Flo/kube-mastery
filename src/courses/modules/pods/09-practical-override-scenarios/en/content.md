---
seoTitle: 'Kubernetes Command Override Patterns, CKA Exam Scenarios'
seoDescription: 'Practice command and args overrides in realistic Kubernetes scenarios: debug containers, Job tasks, and CLI-generated overrides with kubectl run.'
---

# Practical Override Scenarios

The command override syntax is tested directly on the CKA exam. You will be asked to create a Pod that runs a specific command, often something like "run a container with the sleep command" or "create a Job that echoes a value". This lesson builds muscle memory for the three most common patterns.

## Pattern 1: Quick one-liner with kubectl run

The `kubectl run` command has a `--command` flag that sets the Pod's `command` field, and any arguments after `--` become the `args`:

```bash
kubectl run sleeper --image=busybox:1.36 --restart=Never --command -- sleep 3600
```

Check the result:

```bash
kubectl get pod sleeper -o yaml
```

Look at the container spec. You will see:

```yaml
command:
  - sleep
args:
  - '3600'
```

`kubectl run` with `--command` and `-- <args>` produces the correct YAML structure. This is the fastest way to create an overriding Pod on the exam.

:::quiz
You run `kubectl run test --image=busybox:1.36 --restart=Never --command -- sh -c 'echo hi'`. What are the `command` and `args` fields in the generated Pod spec?

**Answer:** `command: ['sh']` and `args: ['-c', 'echo hi']`. The `--command` flag marks everything after `--` as a command override. The first element after `--` becomes `command` and the rest become `args`.
:::

## Pattern 2: Generating YAML with --dry-run

For multi-container Pods or when you need to add other fields, generate the YAML first and edit it:

```bash
kubectl run sleeper --image=busybox:1.36 --restart=Never --command --dry-run=client -o yaml -- sleep 3600 > sleeper.yaml
```

Open the file:

```bash
cat sleeper.yaml
```

Edit it to add additional containers or other fields, then apply:

```bash
kubectl apply -f sleeper.yaml
```

This is the exam workflow: generate a skeleton, edit, apply. Do not write the full YAML from scratch if `kubectl run` can produce the structure for you.

## Pattern 3: Overriding command in a Job

Jobs often need a specific command to run the task. The pattern is the same as in a regular Pod:

```bash
nano hash-job.yaml
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: hash-job
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: hasher
          image: busybox:1.36
          command: ['sh', '-c', 'echo "data to hash" | sha256sum']
```

```bash
kubectl apply -f hash-job.yaml
kubectl logs job/hash-job
```

The Job runs the `sha256sum` command on a string and prints the result. The `command` field replaces whatever the busybox image would normally run.

:::warning
On CKA, you may see images with non-obvious default commands. If you set `args` on a Nginx image expecting to run a shell script, the Nginx `ENTRYPOINT` runs your script as an argument to Nginx, which is almost certainly not what you want. When in doubt, set both `command` and `args` together so you control the full invocation regardless of what the image defines.
:::

## Diagnosing command-related failures

A Pod stuck in `CrashLoopBackOff` immediately after creation often means the command failed to start. Two diagnostic steps:

```bash
kubectl describe pod <pod-name>
```

Look at `State` under the container section. If `Reason: Error` appears with `Exit Code: 127`, the executable was not found. Exit code 126 means found but not executable. Exit code 1 is a general runtime error.

```bash
kubectl logs <pod-name>
```

If the process started but crashed, the logs contain the error output. If the container fails before producing any output, the logs will be empty and the `describe` output is the primary signal.

```bash
kubectl delete pod sleeper
kubectl delete job hash-job
```

:::quiz
A Pod has `command: ['pythonn']` (typo). After creation, `kubectl describe pod` shows `Exit Code: 127`. What does this mean and how do you fix it?

**Answer:** Exit code 127 means the shell could not find the executable `pythonn`. The binary does not exist in the container image. Fix the typo by updating the Pod spec (`command: ['python']`) and recreating the Pod. You cannot edit the `command` field of a running Pod; you must delete and recreate it.
:::

`kubectl run --command` for quick Pods, `--dry-run=client -o yaml` for editing before applying, and explicit `command`+`args` in Job templates: these three patterns cover the vast majority of command override scenarios you will encounter. The next module covers ConfigMaps, which provide a structured way to inject configuration into containers without baking it into the image.
