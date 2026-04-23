---
seoTitle: 'kubectl exec and logs, Inspect Running Kubernetes Containers'
seoDescription: 'Learn how to use kubectl exec to run commands inside a running Pod, inspect filesystems and environment variables, and when to reach for kubectl logs.'
---

# Inspecting Running Containers

`kubectl get pods` shows Running. `kubectl describe` shows a clean startup, no image pull errors, no scheduling failures. But the application is still not doing what you expect. Kubernetes has told you everything it knows about the object from the outside. To go further, you need to look inside the container.

Two commands give you that view. `kubectl logs` reads what the container wrote to its output. `kubectl exec` runs a command directly inside the container's environment. This lesson introduces both and focuses on where each one applies.

Create the Pod you will use throughout:

```bash
nano inspect-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: inspect-pod
spec:
  containers:
    - name: web
      image: nginx:1.28
```

```bash
kubectl apply -f inspect-pod.yaml
```

## A quick look at `kubectl logs`

Kubernetes does not manage log files inside containers. It captures what the container writes to standard output and standard error, and makes that stream available through the API. `kubectl logs` reads it:

```bash
kubectl logs inspect-pod
```

A freshly started nginx with no incoming traffic produces near-empty output. That silence is informative: the container is alive, but nothing has reached it yet.

Two flags cover most situations. `--tail` limits output to the last N lines. `-f` follows the stream live:

```bash
kubectl logs inspect-pod --tail=20
```

:::quiz
You run `kubectl logs inspect-pod` and see no output. What does that most likely mean?

- The container is not running
- The container has not written anything to stdout or stderr yet
- kubectl logs requires a Deployment, not a bare Pod

**Answer:** The container has not written anything yet. kubectl logs only captures stdout and stderr. An app that logs to a file, or a server waiting for its first request, produces no output here.
:::

That covers the essentials. `kubectl logs` has more depth, including how to debug `CrashLoopBackOff` with `--previous` and how to target individual containers with `-c`. All of that is in the Logging and Monitoring module, where it belongs.

## Running commands inside a container with `kubectl exec`

Logs show what the application wrote. They cannot tell you whether a configuration file was mounted at the right path, which environment variables were actually injected, or whether a binary the app depends on exists in the image. For those questions, you run a command inside the container directly.

@@@
graph LR
CLI["Your terminal\nkubectl exec"]
API["API server"]
KL["kubelet\non the node"]
CNT["Container\n(nginx)"]
CLI --> API --> KL --> CNT
@@@

`kubectl exec` opens a connection from your terminal to the API server, which forwards it to the kubelet on the node hosting the Pod. The kubelet runs the command inside the container's own process namespace and filesystem. You see the result as if you had typed the command inside the container itself.

The syntax always separates the kubectl arguments from the container command with `--`:

```bash
kubectl exec inspect-pod -- ls
```

The `--` is not optional. Without it, kubectl tries to interpret every word after the Pod name as its own flags, which produces confusing errors.

:::quiz
Why is the `--` required in `kubectl exec inspect-pod -- ls`?

**Answer:** kubectl needs to know where its own arguments end and the container command begins. Without `--`, kubectl tries to parse `ls` as a kubectl flag, which fails. The separator makes the boundary explicit.
:::

### Checking environment variables

A more useful target than listing files is reading the container's environment. ConfigMaps mounted as env vars, Service discovery variables, and any values from your Pod spec all appear here:

```bash
kubectl exec inspect-pod -- env
```

Look at the output. You will see standard variables like `PATH` and `HOSTNAME`. You will also see `KUBERNETES_SERVICE_HOST` and `KUBERNETES_PORT`, which Kubernetes injects into every Pod automatically. This is the actual environment your application runs in, not the one you wrote in the manifest.

:::warning
Not every container image ships with a shell or common utilities. Minimal images, particularly distroless ones, may not have `ls`, `cat`, or `env`. If `kubectl exec pod -- ls` fails with `executable file not found`, the image does not include that binary. The Observability and Troubleshooting module covers `kubectl debug`, which attaches a separate debug container with a full toolset to those minimal images.
:::

### Targeting a specific container

A Pod can run more than one container. When it does, `kubectl exec` needs to know which one to target. Use `-c` with the container name:

```bash
kubectl exec inspect-pod -c web -- env
```

Without `-c`, kubectl defaults to the first container in the Pod spec. On a single-container Pod this is fine. On a multi-container Pod, always name the container explicitly to avoid reading from the wrong context.

:::quiz
You have a Pod with two containers named `app` and `sidecar`. You run `kubectl exec my-pod -- ls` and get an unexpected filesystem layout. What is the likely cause?

- The Pod is not running
- kubectl exec defaulted to the first container, which may not be `app`
- The `--` separator is missing

**Answer:** kubectl defaulted to the first container in the spec. If `sidecar` is listed first, you inspected `sidecar` rather than `app`. Use `-c app` to be explicit.
:::

## The debugging funnel

@@@
graph TB
A["kubectl get pods\nStatus, READY, RESTARTS at a glance"]
B["kubectl describe pod NAME\nEvents, conditions, full spec"]
C["kubectl logs NAME\nWhat the container printed"]
D["kubectl exec NAME -- command\nWhat the container contains"]
A -->|"something is wrong"| B
B -->|"container is failing"| C
C -->|"need to inspect internals"| D
@@@

Each step in this sequence costs more than the last. `kubectl get` covers every Pod in the namespace in milliseconds. `kubectl exec` opens a live connection to a running process. Starting broad and narrowing down means you spend the minimum effort needed to find the root cause. Save `kubectl exec` for the cases where logs and describe have not given you enough.

Clean up before the next lesson:

```bash
kubectl delete pod inspect-pod
```

You now have four levels of observation: cluster-wide status with `get`, object history with `describe`, application output with `logs`, and direct internal inspection with `exec`. The next lesson covers how to create and edit resources efficiently, including how to modify live objects without deleting them.
