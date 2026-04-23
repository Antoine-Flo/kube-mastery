---
seoTitle: 'DaemonSet Use Cases, Log Agents, Monitoring, kube-proxy, CNI'
seoDescription: 'Explore why DaemonSets power kube-proxy, CNI plugins, log collectors, and monitoring agents, and what makes node-scoped workloads different from application workloads.'
---

# Typical DaemonSet Use Cases

You already saw kindnet listed as a DaemonSet when you explored kube-system in the earlier architecture lessons. It was not the only one. Look at what is actually running:

```bash
kubectl get daemonsets -n kube-system
```

You will see entries for `kube-proxy` and `kindnet` at minimum, both with one Pod per node. These are not application workloads. They are infrastructure services. Understanding why they use DaemonSets, rather than Deployments, explains exactly when a DaemonSet is the right choice.

## The three patterns that require DaemonSets

@@@
graph LR
subgraph node1 ["Every node"]
  NW["Networking agent\nkube-proxy / CNI"]
  LOG["Log collector\nFluentd / Filebeat"]
  MON["Metrics agent\nnode-exporter"]
end
note["Each agent reads\nlocal node resources:\n/var/log, network stack,\ncgroups, kernel metrics"]
node1 --- note
@@@

**Node-local networking.** kube-proxy programs iptables rules that make Service ClusterIPs work. Those rules live in the kernel of each node. A centralized kube-proxy running on one node cannot program the iptables of another. It must run locally. The CNI plugin has the same constraint: it sets up Pod network interfaces in the local kernel, something only code running on that specific node can do.

**Log collection.** A log agent's job is to read the stdout and stderr buffers of every container on its node. Those buffers are files on the local filesystem, typically under `/var/log/pods/`. A log agent running on `node-3` cannot read the log files on `node-1`. One agent per node is not optional, it is the only architecture that works.

**Node-level metrics.** Prometheus node-exporter reads CPU usage, memory consumption, disk I/O, and network statistics directly from kernel interfaces like `/proc` and `/sys`. These interfaces expose the state of the local machine only. Centralizing node-exporter would give you metrics for one node, not the cluster.

:::quiz
Why can't a single centralized Deployment replace kube-proxy?

**Answer:** kube-proxy programs iptables rules in the Linux kernel of each node. Kernel-level networking changes are strictly local. A Pod running on node-1 has no access to the kernel of node-2. The only way to manage local networking on every node is to run an agent on every node.
:::

## What these workloads have in common

Each of the three patterns shares the same structural requirement: the workload must access something that is local to the node and not available remotely. This is the test for whether a DaemonSet is appropriate.

If your workload could run on any node and needs network access to other Pods or services, use a Deployment. If your workload must access a resource that is physically local to each node, or must run exactly once per node for correctness reasons, use a DaemonSet.

## Accessing host resources from a DaemonSet Pod

A typical log agent needs to read log files that are on the node's filesystem. The Pod running inside a container does not see the host filesystem by default. It uses a `hostPath` volume to mount a specific directory from the node into the container.

```bash
nano log-agent-full.yaml
```

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent-full
spec:
  selector:
    matchLabels:
      app: log-agent-full
  template:
    metadata:
      labels:
        app: log-agent-full
    spec:
      containers:
        - name: agent
          image: busybox:1.36
          volumeMounts:
            - name: varlog
              mountPath: /host-logs
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
```

```bash
kubectl apply -f log-agent-full.yaml
kubectl get pods -o wide
```

The `hostPath` volume makes the node's `/var/log` directory available inside the container at `/host-logs`. Every DaemonSet Pod on every node mounts the log directory of its own node. No Pod ever sees another node's files.

:::warning
`hostPath` volumes grant the container direct access to the node's filesystem. A misconfigured or compromised log agent with a `hostPath` mount could read sensitive files outside its intended directory. In production, always set `readOnly: true` and restrict the mounted path to exactly what the workload needs. The pod-security module covers the broader security constraints that apply to workloads with host access.
:::

:::quiz
A DaemonSet Pod mounts `/var/log` via `hostPath`. Which node's `/var/log` does it see?

**Answer:** Its own node's `/var/log`. A `hostPath` volume mounts a directory from the node where the Pod is scheduled. Each DaemonSet Pod runs on a different node, so each Pod mounts its own node's directory. No Pod sees another node's files.
:::

```bash
kubectl delete daemonset log-agent-full
```

The common thread across all DaemonSet use cases is locality: the workload exists to serve or observe the specific node it runs on. The next lesson covers how the DaemonSet controller places Pods on nodes and how to target only a subset of nodes when full coverage is not what you need.
