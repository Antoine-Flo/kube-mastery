---
seoTitle: 'kubectl logs and exec, Debug Kubernetes Pods'
seoDescription: 'Learn how to use kubectl logs to read container output and kubectl exec to run commands inside a running Pod for live debugging in Kubernetes.'
---

# Logs and Exec

A Pod is in Running status but the application is not behaving as expected. The STATUS column looks fine. `kubectl describe` shows the container started without errors. But something is still wrong. At this point, the cluster itself has told you everything it knows about scheduling and lifecycle. To go further, you need to read what the application itself is saying. That is what `kubectl logs` is for.

Start by creating a Pod to work with:

```bash
nano log-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: log-pod
spec:
  containers:
    - name: web
      image: nginx:1.28
```

```bash
kubectl apply -f log-pod.yaml
```

## Reading logs with `kubectl logs`

`kubectl logs` reads the standard output and standard error of a container, which is exactly what the application writes when it runs. Every language runtime, every web server, every database writes its errors and access records there.

```bash
kubectl logs log-pod
```

nginx writes an access log line for every HTTP request it receives. If the container just started and has not served any requests yet, the output will be nearly empty. That silence is itself informative: the container is up, but no traffic has reached it yet.

To follow logs in real time as new lines appear, add `-f`. This works like `tail -f` in a regular shell. Press Ctrl+C to stop:

```bash
kubectl logs log-pod -f
```

When you only want the most recent output, use `--tail` with a line count:

```bash
kubectl logs log-pod --tail=20
```

For time-based filtering, `--since` accepts a duration like `5m`, `1h`, or `30s`:

```bash
kubectl logs log-pod --since=5m
```

:::info
In a real Kubernetes cluster, container logs are typically collected by dedicated tools like Fluentd, Loki, or an Elasticsearch pipeline. `kubectl logs` reads directly from the kubelet on the node where the Pod is running. This is ideal for live debugging but does not give access to logs from before the Pod was scheduled to the current node. The simulator handles logs the same way: `kubectl logs` reads current container output only.
:::

## The previous container flag

When a container crashes and restarts, the new process starts fresh. The logs of the crashed instance are stored separately on the node. To read them, use the `-p` flag:

```bash
kubectl logs log-pod -p
```

:::warning
`kubectl logs -p` fails if the container has never restarted. If you try it on a Pod that has been running cleanly since creation, Kubernetes responds with `previous terminated container "web" not found in pod "log-pod"`. The flag only works if there is at least one completed previous container to read from.
:::

:::quiz
You want to read the last 20 lines of logs from `log-pod`. Which flag do you need?
**Try it:** `kubectl logs log-pod --tail=20`
**Answer:** `--tail=N` limits the output to the last N lines, reading from the end of the log. Without it, `kubectl logs` prints every line since the container started, which on a long-running container can be thousands of lines. Combine `--tail` with `-f` to stream only recent output.
:::

## Running commands inside a container with `kubectl exec`

Sometimes reading logs is not enough. You need to look at the filesystem, check environment variables, or verify that a configuration file was mounted correctly. `kubectl exec` runs a command inside a running container, giving you a direct view into its environment.

:::warning
`kubectl exec` in this simulator supports a limited subset of commands. There is no full interactive shell, and pipes are not available. On a real cluster, `kubectl exec -it <pod> -- /bin/bash` gives you a full interactive shell session. For most debugging in this simulator, `kubectl logs` and `kubectl describe` will take you further.
:::

A simple read-only command that works well in the simulator:

```bash
kubectl exec log-pod -- ls
```

This lists the files in the root directory of the container. You can verify that configuration files exist, check which binaries are available, or confirm that a volume was mounted at the expected path.

## Debugging as a funnel

@@@
graph TB
L1["kubectl get pods\nGlobal status, READY / STATUS / RESTARTS columns"]
L2["kubectl describe pod NAME\nConditions, Events, detailed configuration"]
L3["kubectl logs NAME\nContainer output, application errors"]
L4["kubectl exec NAME -- command\nDirect inspection inside the container"]
L1 -->|"something looks wrong"| L2
L2 -->|"container is failing"| L3
L3 -->|"need to inspect internals"| L4
@@@

Why structure debugging as a funnel? Because each level is more expensive than the previous one. `kubectl get` responds in milliseconds and covers every Pod in a namespace. `kubectl logs` requires targeting a specific Pod and reading potentially large streams of data. `kubectl exec` opens a connection to a running process. Starting broad and narrowing down means you spend the minimum effort needed to find the problem.

A Pod stuck in `CrashLoopBackOff` is a good example of why the sequence matters. Start with `kubectl get pods` to see the restart count climbing. Move to `kubectl describe` to check if the failure is in image pulling or container startup. Then use `kubectl logs -p` to read what the crashed container printed before it exited. That log output almost always tells you exactly what went wrong.

:::quiz
Why does `kubectl logs -p` read the previous container rather than a historical log stream from the current container?
**Answer:** When a container restarts, a new process is spawned. Kubernetes treats it as a distinct container instance. The logs from the previous run are stored separately on the node as a rotated file. `-p` instructs kubectl to fetch that archived output rather than the current container's stdout. Without this distinction, you would only ever see logs from the latest restart, which may start clean with no errors even if the crash happened moments before.
:::

Clean up your work:

```bash
kubectl delete pod log-pod
```

You now have a complete toolkit for observing what is happening in the simulator at every level: from cluster-wide status, to object history, to container output, to filesystem inspection. The next lesson goes in the other direction and covers how to create and edit resources efficiently, including how to modify live objects without deleting them first.
