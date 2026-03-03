# Node-Level Logging

In the previous lesson, you used `kubectl logs` to read container output. But where does that data actually live? Understanding node-level logging helps you troubleshoot scenarios where `kubectl logs` isn't enough — and prepares you for setting up production log aggregation.

## Where Container Logs Live on the Node

When a container writes to stdout or stderr, the container runtime stores that output as files on the node's filesystem. The typical location is:

```
/var/log/pods/<namespace>_<pod-name>_<pod-uid>/<container-name>/0.log
```

Each container gets its own directory, and log files are numbered (`0.log`, `1.log`, etc.) as they rotate. The exact path depends on the container runtime and kubelet configuration, but this pattern is standard across most clusters.

Think of the node as a filing cabinet. Each Pod gets a folder, each container gets a subfolder, and the runtime acts as a clerk who writes everything the container says into that folder.

## Log Rotation: Keeping Nodes Healthy

Logs can grow quickly — a busy application can generate gigabytes of output. Without management, logs would fill up the node's disk and cause serious problems. The kubelet handles this with two configuration options:

- **`--container-log-max-size`:** Maximum size of each log file before rotation (default: 10Mi)
- **`--container-log-max-files`:** Maximum number of rotated files to keep (default: 5)

When a log file exceeds the max size, the kubelet rotates it — the current file becomes `1.log`, and a new `0.log` starts. Older files beyond the max count are deleted.

:::info
Log rotation is automatic and managed by the kubelet. You don't need to configure logrotate or any external tool. However, the defaults may not be enough for high-volume workloads — adjust them based on your application's output rate and your node's disk capacity.
:::

## Exploring Logs on the Node

Sometimes you need to look at the raw log files on the node — for example, when debugging kubelet issues or investigating a node that's not responding properly. Here's how:

```bash
# List all Pod log directories on the node
ls /var/log/pods/

# Look at a specific Pod's logs
ls -la /var/log/pods/default_my-pod_abc123/app/

# View kubelet logs (on systemd-based nodes)
journalctl -u kubelet -f
```

If you can't SSH into the node, you can use `kubectl debug` to create a debug container with access to the host filesystem:

```bash
kubectl debug node/my-node -it --image=busybox -- sh
# Inside the debug container:
ls /host/var/log/pods/
cat /host/var/log/pods/default_my-pod_abc123/app/0.log
```

## System Component Logs

It's not just application containers that produce logs. Kubernetes system components write logs too:

- **kubelet:** Managed by systemd on most distributions; use `journalctl -u kubelet`
- **kube-proxy:** Also a systemd service or runs as a DaemonSet Pod
- **Container runtime** (containerd, CRI-O) — Check with `journalctl -u containerd`
- **Static Pods** (API server, etcd, scheduler, controller-manager) — These write to the same `/var/log/pods/` structure in the `kube-system` namespace

```bash
# Kubelet logs
journalctl -u kubelet --since "10 minutes ago"

# containerd runtime logs
journalctl -u containerd -f
```

## The Ephemeral Nature of Node Logs

Here's the critical thing to understand: **node-level logs are temporary**. When a Pod is rescheduled to a different node, its logs on the original node stay there — but the Pod is gone. When a node is replaced (autoscaling, maintenance, failure), all logs on that node disappear.

```mermaid
flowchart LR
  Pod["Pod writes to stdout"] --> Runtime["Runtime captures to /var/log/pods/"]
  Runtime --> Rotate["Kubelet rotates files"]
  Rotate --> Gone["Node replaced = Logs lost"]
```

:::warning
Node-level logs are ephemeral by design. For any production environment, you need a log aggregation system that ships logs off the node before they're lost. The next lesson covers exactly how to set this up.
:::

---

## Hands-On Practice

### Step 1: Explore System Component Logs

Kubernetes system components write logs to the same node-level log structure. Inspect control plane Pod logs:

```bash
kubectl get pods -n kube-system
kubectl logs -n kube-system -l component=kube-apiserver --tail=20
kubectl logs -n kube-system -l component=kube-scheduler --tail=20
```

## Wrapping Up

Container logs live on the node under `/var/log/pods/`, organized by Pod and container. The kubelet handles rotation to prevent disk exhaustion. System components write logs too, accessible via `journalctl` or through the same Pod log structure. The key takeaway: these logs are temporary. Once you move to production, you'll need a way to collect and store them centrally — and that's exactly what we'll cover next.
