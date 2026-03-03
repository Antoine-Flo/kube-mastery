# Container Logging Basics

When something goes wrong with an application — and something always goes wrong eventually — the first thing you'll want to see is the logs. In traditional environments, you'd SSH into a server and check a log file. In Kubernetes, the approach is a bit different, but arguably simpler once you understand how it works.

## How Container Logging Works in Kubernetes

Here's the key idea: containers write their output to **stdout** (standard output) and **stderr** (standard error), and the container runtime — such as <a target="_blank" href="https://containerd.io/">containerd</a> — captures those streams automatically. The kubelet and runtime store these logs as files on the node.

Think of it like a microphone in a conference room. As long as speakers talk into the microphone (stdout/stderr), the recording system captures everything. If someone whispers into a notebook instead (writes to a file inside the container), the recording misses it.

This is why the best practice in Kubernetes is straightforward: **write your application logs to stdout and stderr**. Don't write to files inside the container. When your app outputs to stdout, everything just works — `kubectl logs` can show you the output, the runtime handles rotation, and log aggregation tools can collect it.

:::info
Writing to stdout and stderr is the Kubernetes-native way to log. It requires zero configuration for `kubectl logs` to work, and it's what log collectors expect. Avoid writing logs to files inside the container whenever possible.
:::

## Viewing Logs with kubectl

The `kubectl logs` command is your primary tool for reading container logs. It supports several useful flags: `-f` to follow in real time (like `tail -f`), `--tail=N` to limit output to the last N lines, `--since=1h` to filter by time, and `--previous` to see logs from a previous container instance after a restart.

The `--previous` flag is particularly useful. When a container crashes and restarts, the current logs belong to the new instance. To see what happened before the crash, you need `--previous`.

## Working with Multi-Container Pods

When a Pod has more than one container — for example, an application container and a sidecar — you need to specify which container's logs you want:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-sidecar
spec:
  containers:
    - name: app
      image: myapp
    - name: log-collector
      image: fluent-bit
```

To read logs from a specific container, use `-c <container-name>`. To get logs from all containers at once, use `--all-containers=true`. Without `-c` on a multi-container Pod, kubectl will ask you to specify which container you want.

## Troubleshooting Common Issues

**"No logs available":** This usually means the Pod hasn't started yet or the container hasn't written any output. Check the Pod status first:

```bash
kubectl get pod my-pod
kubectl describe pod my-pod
```

Look at the Events section of `describe` — it often reveals why a Pod isn't starting (image pull failures, resource limits, scheduling issues).

**"--previous" doesn't work:** The `--previous` flag only works if the container has restarted at least once. If the Pod was deleted and recreated (rather than restarted), there's no "previous" to show.

**Init container logs:** Init containers run before the main containers and may hold important clues. Access them with `-c`:

```bash
kubectl logs my-pod -c init-container-name
```

:::warning
Node-level logs are temporary. When a Pod is rescheduled to a different node or the node is replaced, those logs are gone. For production environments, you'll need a log aggregation system (like Fluent Bit, Loki, or Elasticsearch) for long-term storage and search. We'll cover that in an upcoming lesson.
:::

---

## Hands-On Practice

### Step 1: Create a Test Pod and View Its Logs

```bash
kubectl run log-test --image=nginx
kubectl logs log-test
```

### Step 2: Follow Logs in Real Time

```bash
kubectl logs -f log-test
```

Press `Ctrl+C` to stop following.

### Step 3: Filter by Line Count and Time

```bash
kubectl logs log-test --tail=10
kubectl logs log-test --since=5m
```

### Step 4: View Previous Container Logs

If the container has restarted at least once:

```bash
kubectl logs log-test --previous
```

### Step 5: Target a Specific Container

For multi-container Pods, specify which container with `-c`:

```bash
kubectl logs log-test -c nginx --tail=5
kubectl logs log-test --all-containers=true
```

## Wrapping Up

Container logging in Kubernetes follows a simple pipeline: your application writes to stdout/stderr, the runtime captures it, and you read it with `kubectl logs`. It's a straightforward model that works well for debugging. For multi-container Pods, use `-c` to target a specific container, and remember `--previous` when a container has restarted. In the next lesson, we'll look at where these logs actually live on the node — and why that matters for production.
