---
seoTitle: 'Docker ENTRYPOINT vs CMD, Container Start Command Explained'
seoDescription: 'Understand the difference between Docker ENTRYPOINT and CMD, how they combine, and why this matters before overriding commands in Kubernetes.'
---

# Docker ENTRYPOINT and CMD

Every container has a process that starts when it runs. That process is defined in the container image, but Kubernetes lets you override it. Before you can do that effectively, you need to understand how Docker defines the default command, because Kubernetes maps directly onto those two Docker fields: `ENTRYPOINT` and `CMD`.

Pull up a simple container to observe the behavior:

```bash
kubectl run inspect-cmd --image=busybox:1.36 --restart=Never --command -- sh -c 'sleep 3600'
kubectl exec -it inspect-cmd -- sh
```

Inside the container, run:

```bash
cat /proc/1/cmdline | tr '\0' ' '
```

This prints the command that PID 1 is running. PID 1 is the main process of the container. Whatever command started the container is PID 1. Exit the container:

```bash
exit
kubectl delete pod inspect-cmd
```

## What ENTRYPOINT and CMD do in a Dockerfile

@@@
graph LR
subgraph dockerfile ["Dockerfile"]
  EP["ENTRYPOINT [\"python\"]"]
  CMD["CMD [\"app.py\"]"]
end
subgraph result ["Container starts with"]
  R["python app.py"]
end
dockerfile --> result
@@@

`ENTRYPOINT` defines the executable that runs. It is the fixed part of the command. `CMD` provides default arguments to that executable. When both are present, the final command is: `ENTRYPOINT` followed by `CMD`. When only `CMD` is set (no `ENTRYPOINT`), the container runs whatever `CMD` specifies directly.

Two common patterns:

**Pattern 1: ENTRYPOINT only**
```dockerfile
ENTRYPOINT ["nginx", "-g", "daemon off;"]
```
The container runs nginx. There is no `CMD`, so no default arguments are appended. You cannot add arguments without overriding `ENTRYPOINT`.

**Pattern 2: ENTRYPOINT + CMD**
```dockerfile
ENTRYPOINT ["python"]
CMD ["app.py"]
```
Default behavior: `python app.py`. But you can run `python other.py` by overriding `CMD` without touching `ENTRYPOINT`.

**Pattern 3: CMD only**
```dockerfile
CMD ["sh"]
```
The container runs `sh` with no entrypoint wrapper. You can override this completely by passing a different command.

:::quiz
A Dockerfile has `ENTRYPOINT ["node"]` and `CMD ["index.js"]`. What command runs when you start the container with no overrides?

**Answer:** `node index.js`. The final command is always ENTRYPOINT followed by CMD when both are set. The ENTRYPOINT provides the executable, and CMD provides its default arguments.
:::

## The exec form vs the shell form

Both `ENTRYPOINT` and `CMD` support two forms. The exec form uses a JSON array: `["executable", "arg1", "arg2"]`. The shell form uses a plain string: `executable arg1 arg2`.

The difference matters for signal handling. With the shell form, the container starts `/bin/sh -c "your command"`. The `sh` process becomes PID 1. Your actual process is a child. When Kubernetes sends a termination signal, it sends it to PID 1 (the shell), which may not forward it to your process. This causes slow or unclean shutdowns.

The exec form runs your executable directly as PID 1. Signals reach it immediately.

:::warning
If you see containers that take 30 seconds to terminate when you run `kubectl delete pod`, the shell form is often the cause. The shell at PID 1 does not forward `SIGTERM` to the child process. After 30 seconds, Kubernetes sends `SIGKILL`. Use the exec form (`["command", "arg"]`) in Dockerfiles and in Kubernetes `command` fields for clean termination behavior.
:::

:::quiz
A container uses `CMD "python app.py"` (shell form). Which process is PID 1 inside the container?

- `python`
- `/bin/sh`
- `app.py`

**Answer:** `/bin/sh`. The shell form wraps the command in `/bin/sh -c "python app.py"`. The shell becomes PID 1. Python runs as a child process of the shell. Signals sent to PID 1 go to the shell, not to Python.
:::

Understanding `ENTRYPOINT` and `CMD` in Docker maps directly onto how Kubernetes overrides container commands. The next lesson shows exactly which Kubernetes fields correspond to each Docker field and how they interact.
