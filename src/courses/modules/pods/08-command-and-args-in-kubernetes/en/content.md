---
seoTitle: 'Kubernetes command and args Fields, Override ENTRYPOINT and CMD'
seoDescription: 'Learn how Kubernetes command and args fields map to Docker ENTRYPOINT and CMD, and how to override them in a Pod spec with practical examples.'
---

# command and args in Kubernetes

The previous lesson established the Docker model: `ENTRYPOINT` is the executable, `CMD` is its default arguments. Kubernetes uses two Pod spec fields that map one-to-one onto those Docker fields. The mapping is exact and the names are counterintuitive, so it is worth memorizing the table once.

| Docker field | Kubernetes field | Effect |
|---|---|---|
| `ENTRYPOINT` | `command` | Overrides the executable |
| `CMD` | `args` | Overrides the default arguments |

`command` in Kubernetes replaces `ENTRYPOINT` in Docker. `args` in Kubernetes replaces `CMD` in Docker. The names do not match the intuition you might have from the command line, but the mapping is fixed.

## Overriding args only

The most common override is changing just the arguments while keeping the same executable. This is equivalent to overriding Docker's `CMD`.

```bash
nano args-only.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: args-only
spec:
  containers:
    - name: app
      image: busybox:1.36
      args: ['sh', '-c', 'echo Hello from args']
  restartPolicy: Never
```

```bash
kubectl apply -f args-only.yaml
kubectl logs args-only
```

The output shows `Hello from args`. The `busybox` image has no `ENTRYPOINT` set, so setting `args` in Kubernetes provides the full command.

:::quiz
A Docker image has `ENTRYPOINT ["python"]` and `CMD ["app.py"]`. In a Kubernetes Pod, you set `args: ["other.py"]`. What command runs?

**Answer:** `python other.py`. The `args` field overrides Docker's `CMD`. The `ENTRYPOINT` (`python`) is unchanged because you did not set `command`. The result is the ENTRYPOINT followed by your new args.
:::

## Overriding command and args together

When you set `command` in Kubernetes, you replace the Docker `ENTRYPOINT` entirely. If you also want to pass arguments to your new command, set both `command` and `args`.

```bash
nano command-and-args.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: command-and-args
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh']
      args: ['-c', 'echo Running with custom command && sleep 2']
  restartPolicy: Never
```

```bash
kubectl apply -f command-and-args.yaml
kubectl logs command-and-args
```

`command: ['sh']` replaces the Docker `ENTRYPOINT`. `args: ['-c', 'echo...']` provides the shell flags and the script to run. The final process is: `sh -c 'echo Running with custom command && sleep 2'`.

@@@
graph LR
subgraph kube ["Kubernetes Pod spec"]
  CMD["command: ['sh']"]
  ARGS["args: ['-c', 'echo hello']"]
end
subgraph result ["Container runs"]
  R["sh -c 'echo hello'"]
end
kube --> result
@@@

## What happens when you omit one field

Three cases to know:

**Only `args` set:** Kubernetes overrides Docker `CMD`, Docker `ENTRYPOINT` runs as-is. Final command: `<ENTRYPOINT> <your-args>`.

**Only `command` set:** Kubernetes overrides Docker `ENTRYPOINT`. Docker `CMD` is ignored entirely (not appended). Final command: `<your-command>` with no arguments unless the `command` array includes them.

**Both `command` and `args` set:** Both Docker fields are ignored. Final command: `<command> <args>`.

:::warning
When you set `command` in a Kubernetes Pod spec, Docker's `CMD` is dropped and is not appended automatically. If you override only `command` and expect Docker's `CMD` to provide default arguments, the Pod will start with no arguments. Always set `args` explicitly when overriding `command` if the executable requires arguments to start correctly.
:::

```bash
kubectl delete pod args-only command-and-args
```

:::quiz
A Pod spec has `command: ['node']` but no `args` field. The Docker image has `CMD: ["index.js"]`. What runs inside the container?

**Answer:** `node` with no arguments. Setting `command` overrides Docker's ENTRYPOINT and causes Docker's CMD to be ignored entirely. The node process starts but receives no filename argument and will likely fail immediately. Always include `args` when setting `command`.
:::

The mapping is: `command` overrides `ENTRYPOINT`, `args` overrides `CMD`. The next lesson applies this with practical override patterns you will encounter in CKA scenarios.
