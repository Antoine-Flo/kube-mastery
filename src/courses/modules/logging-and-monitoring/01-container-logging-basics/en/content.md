---
seoTitle: Kubernetes Logging, stdout, kubectl logs, CrashLoopBackOff
seoDescription: Learn how Kubernetes container logging works, how to stream and filter logs with kubectl logs, and how to debug CrashLoopBackOff with --previous.
---

# Container Logging Basics

Your Pod just restarted and you have no idea why. The status shows `Running` again, but something went wrong. Where do you look?

In a traditional server setup, you would check `/var/log/app.log` or connect to syslog. Kubernetes takes a different approach. It does not manage log files inside containers. Instead, it captures everything the container writes to standard output and standard error, and makes that available through the API. Nothing in `/var/log`. No syslog integration. Just stdout and stderr.

This design keeps containers stateless and portable. A container that writes logs to a file creates a hidden dependency on the filesystem. A container that writes to stdout can run anywhere and be observed from the outside without being modified.

@@@
graph LR
    A[Container<br/>stdout / stderr] --> B[kubelet<br/>log driver]
    B --> C[Node log buffer<br/>on disk]
    C --> D[kubectl logs]
@@@

When your container prints a line to stdout, kubelet captures it through the container runtime's log driver and stores it in a buffer on the node. `kubectl logs` reads from that buffer and streams the output back to your terminal.

Run this now to see logs from a Pod:

```
kubectl logs <pod-name>
```

This returns the full stdout and stderr output from the main container since it last started. If your Pod has only one container, that is all you need.

:::quiz
You run `kubectl logs my-app` and get no output. What is the most likely reason?

- The Pod is not running
- The container has not written anything to stdout or stderr yet
- kubectl logs only works with Deployments

**Answer:** The container has not written anything to stdout or stderr yet - kubectl logs only captures what the container writes to those two streams, so an app that logs to a file produces no output here.
:::

## Filtering and Streaming Logs

Reading the full log history is not always useful. A busy Pod may produce thousands of lines. Three flags help you focus.

To see only the last 50 lines, pass `--tail`:

```
kubectl logs my-app --tail=50
```

To see only logs from the last five minutes, pass `--since`:

```
kubectl logs my-app --since=5m
```

To follow logs in real time as the container writes them, pass `-f`:

```
kubectl logs my-app -f
```

This works like `tail -f` on a local file. New lines appear as they arrive. Press Ctrl+C to stop the stream.

When a Pod runs more than one container, you must specify which one you want. Without `-c`, kubectl logs returns an error asking you to choose:

```
kubectl logs my-app -c sidecar-container
```

:::quiz
You want to see the last 20 lines of logs from the `proxy` container inside a Pod named `gateway`. What command do you run?

**Try it:** `kubectl logs gateway -c proxy --tail=20`

**Answer:** The `-c` flag selects the container by name and `--tail=20` limits output to 20 lines. Without `-c`, kubectl would ask you to specify a container.
:::

## Debugging CrashLoopBackOff

Your Pod is in `CrashLoopBackOff`. This means the container starts, crashes immediately, and Kubernetes restarts it repeatedly. The wait between restarts grows longer each time - that is the backoff.

Here is where beginners get stuck: if you run `kubectl logs` while the Pod is in the middle of a restart cycle, you may see only a few lines or nothing at all. The container just started and has not had time to log anything meaningful yet.

The crash happened in the previous run. Use `--previous` (or `-p`) to read the logs from the container that just exited:

```
kubectl logs my-app --previous
```

@@@
graph LR
    A[Container crashes] --> B[kubelet saves<br/>last log buffer]
    B --> C[kubectl logs --previous]
    D[Container restarts] --> E[kubectl logs<br/>current run]
@@@

Why does Kubernetes keep logs from the previous container? Because crash debugging is a very common task, and losing the evidence the moment a container exits would make root-cause analysis nearly impossible. Kubelet retains the log buffer from the last terminated container specifically for this reason.

:::warning
If you delete the Pod entirely and create a new one, the previous container's logs are gone. Kubernetes does not persist logs beyond the life of the Pod on that node. For long-term log retention you need an external log collector such as Fluentd or Loki, but that is outside the scope of this simulator.
:::

:::quiz
Your Pod is in `CrashLoopBackOff` and `kubectl logs my-app` shows only one line before stopping. How do you see what caused the crash?

- kubectl describe pod my-app
- kubectl logs my-app --previous
- kubectl get pod my-app -o yaml

**Answer:** `kubectl logs my-app --previous` - `describe` shows events but not log output, and `-o yaml` shows the Pod spec and status, not logs.
:::

:::info
In the simulator, `kubectl logs` returns the simulated container output. The `--previous` flag returns the last simulated crash output when available for the Pod scenario.
:::

When you know a Pod is misbehaving, combine what you have learned. First check what happened with `--previous` to find the crash reason, then follow the current run with `-f` to watch whether the fix worked. These two flags together cover most logging-based debugging workflows.

Logs are your first signal when something goes wrong. Kubernetes keeps them close and accessible precisely because they are the fastest path to understanding a failure.
