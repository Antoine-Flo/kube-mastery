# kubectl logs and kubectl exec — Looking Inside Containers

So far you have learned to observe Kubernetes resources from the outside — listing pods, reading their status, examining their conditions and events. But sometimes the outside view is not enough. You need to look *inside* the container itself: what is the application printing to the console? What does the filesystem look like? Is a configuration file in the right place?

That is where `kubectl logs` and `kubectl exec` come in. They are your windows directly into the running container, and they are indispensable tools for debugging application-level problems.

## kubectl logs: Reading What Your Application Says

Every well-behaved application writes its output to stdout and stderr. In a traditional server environment, those streams go to log files. In Kubernetes, the container runtime captures them, and `kubectl logs` makes them available to you.

```bash
kubectl logs my-pod
```

This command streams the standard output and error of the main container in the pod straight to your terminal. If your application prints startup messages, request logs, error stack traces, or anything else, you will see it here.

### Following Logs in Real Time

The `-f` flag (short for "follow") keeps the connection open and streams new log lines as they are produced, similar to `tail -f` on a traditional log file. This is extremely useful when you are watching a pod start up or trying to catch a sporadic error.

```bash
kubectl logs -f my-pod
```

Press `Ctrl+C` to stop following.

### Limiting the Output

In production, containers can produce enormous volumes of logs. Running a bare `kubectl logs` on a busy pod might dump thousands of lines to your terminal. Two flags help you control the output.

`--tail=N` shows only the last N lines:

```bash
kubectl logs --tail=50 my-pod
```

`--since=<duration>` shows only logs produced within the specified duration. The duration format uses Go duration strings: `1h` for one hour, `30m` for thirty minutes, `5s` for five seconds.

```bash
kubectl logs --since=1h my-pod
kubectl logs --since=30m my-pod
```

### Multi-Container Pods

A pod can contain more than one container. If it does, `kubectl logs` will complain that you need to specify which container you want. Use the `-c` flag:

```bash
# List the containers in the pod first
kubectl get pod my-pod -o jsonpath='{.spec.containers[*].name}'

# Then read the logs of a specific container
kubectl logs my-pod -c sidecar-container
```

### Logs from a Crashed Container

This is one of the most important flags: `--previous`. When a container crashes and restarts, Kubernetes starts a fresh container — and the logs of the previous run are gone from the live view. The `--previous` flag retrieves the logs from the *last terminated* instance of the container, which is exactly what you need when debugging a crash.

```bash
kubectl logs --previous my-pod
```

:::info
`kubectl logs` can only show you logs from the most recent container run and, with `--previous`, the one before that. For long-term log retention and querying across restarts, teams typically deploy a log aggregation stack like the EFK stack (Elasticsearch, Fluentd, Kibana) or Loki with Grafana.
:::

## kubectl exec: Running Commands Inside a Container

`kubectl exec` lets you execute a command *inside a running container*. This is conceptually similar to SSH-ing into a server, but instead of connecting to a machine, you are reaching into a container's isolated process namespace.

The general form is:

```bash
kubectl exec <pod-name> -- <command>
```

The double dash `--` is the separator between kubectl's arguments and the command you want to run inside the container. Everything after `--` is passed directly to the container's shell.

```bash
# Check environment variables inside the container
kubectl exec my-pod -- env

# See if a file exists
kubectl exec my-pod -- ls /etc/config

# Read a file inside the container
kubectl exec my-pod -- cat /etc/config/app.properties

# Check network connectivity from inside the container
kubectl exec my-pod -- wget -qO- http://other-service:8080/health
```

### Interactive Shell Sessions

For deeper exploration, you can open a full interactive shell inside the container using the `-i` (interactive) and `-t` (TTY) flags, usually combined as `-it`:

```bash
kubectl exec -it my-pod -- /bin/sh
```

Once inside, you have a shell prompt and can explore the container's filesystem, check running processes, test network connections, inspect environment variables, and much more — just as if you were logged into a traditional server.

To exit, type `exit` or press `Ctrl+D`.

If the container runs a bash shell, you can use that instead:

```bash
kubectl exec -it my-pod -- /bin/bash
```

### Multi-Container Exec

Just like with logs, if a pod has multiple containers, you need to specify which one to exec into:

```bash
kubectl exec -it my-pod -c my-container -- /bin/sh
```

:::warning
Not all container images include a shell. Minimal images built on distroless base images or the `scratch` layer deliberately exclude shells, package managers, and other tools to reduce the attack surface and image size. If you run `kubectl exec -it my-pod -- /bin/sh` and get an error like "executable file not found," that is why. In those cases, you may be able to use `kubectl debug` (covered in a later lesson) to attach a debug container to the pod.
:::

:::warning
`kubectl exec` gives you direct access to a running container in your cluster. In a production environment, treat this capability with the same care you would give to SSH access to a production server. Avoid making changes inside containers directly — container filesystems are ephemeral and changes will be lost when the container restarts. Use exec for observation and diagnosis, not for making permanent changes.
:::

## The Debugging Flow: From Outside to Inside

These tools slot into a natural diagnostic sequence. You start with the broad cluster view and progressively zoom in until you find the problem.

```mermaid
flowchart TD
    A["kubectl get pods\n(identify the troubled pod)"] --> B["kubectl describe pod\n(read events, conditions)"]
    B --> C{Container running?}
    C -- No, CrashLoopBackOff --> D["kubectl logs --previous my-pod\n(read the last crash output)"]
    C -- Yes, but misbehaving --> E["kubectl logs -f my-pod\n(watch live output)"]
    D --> F{Problem found?}
    E --> F
    F -- No --> G["kubectl exec -it my-pod -- /bin/sh\n(explore the container directly)"]
    F -- Yes --> H["Fix the root cause in the manifest"]
    G --> H
```

Most production issues are diagnosed without ever needing `kubectl exec`. The events from `kubectl describe` and the output from `kubectl logs` are usually enough. But when they are not, the ability to drop into a shell inside the container is invaluable.

## Hands-On Practice

Open the terminal on the right and follow along. First, create a simple pod to work with:

```bash
# Create a test pod
kubectl run log-demo --image=busybox -- /bin/sh -c "while true; do echo 'Hello from log-demo' $(date); sleep 2; done"

# Wait a moment for it to start
kubectl get pods -w

# Once it's Running, press Ctrl+C to stop watching

# Read its logs
kubectl logs log-demo

# Follow the logs live (press Ctrl+C to stop)
kubectl logs -f log-demo

# Read only the last 5 lines
kubectl logs --tail=5 log-demo

# Read logs from the last 1 minute
kubectl logs --since=1m log-demo

# Execute a one-off command inside the container
kubectl exec log-demo -- env

kubectl exec log-demo -- ls /

# Open an interactive shell
kubectl exec -it log-demo -- /bin/sh

# Inside the shell, explore:
#   ls /
#   cat /etc/hostname
#   env
#   exit

# Now simulate a crash to see --previous in action
kubectl run crash-demo --image=busybox -- /bin/sh -c "echo 'Starting up'; sleep 2; echo 'About to crash'; exit 1"

# Watch it enter CrashLoopBackOff
kubectl get pods -w

# Read the logs from the previous (crashed) run
kubectl logs --previous crash-demo

# Clean up
kubectl delete pod log-demo crash-demo
```

The combination of `kubectl logs` and `kubectl exec` puts you in a strong position to diagnose virtually any application-level problem in your cluster. Practice these commands until they feel natural — they will be part of your daily workflow.
