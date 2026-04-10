---
seoTitle: KubeMastery, Navigate the Terminal and Cluster Interface
seoDescription: Learn how to use the KubeMastery platform, including the terminal panel, cluster visualizer, reset button, and how to navigate course lessons.
---

# Welcome

Welcome to KubeMastery. This first lesson takes two minutes. By the end of it you will have deployed a workload to a simulated cluster and watched it come alive in real time.

:::info
On mobile, not every keyboard works well with the terminal. <a href="https://play.google.com/store/apps/details?id=com.google.android.inputmethod.latin&hl=en" target="_blank">**Gboard**</a> works reliably if you need to practice on the go.
:::

## How the Platform Works

The terminal is connected to a simulated Kubernetes cluster running entirely in your browser. It is not a real cluster, but the commands, the outputs, and the cluster behavior are designed to match what you would see on a real one. Every `kubectl` command you type reaches that simulation, and changes persist within the session. Pods move through phases like `Pending`, `ContainerCreating`, and `Running` just as they would on a live cluster.

Alongside the terminal, a cluster visualizer shows those transitions live. Open it by clicking the telescope icon below the terminal.

## Your First Deployment

Let's see both in action. Open the visualizer now, then run this command in the terminal:

```bash
nano deployment.yaml
```

Paste the following manifest into the editor:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.28
```

Save and close with **Ctrl+S**. Now apply it:


```bash
kubectl apply -f deployment.yaml
```

The terminal prints `deployment.apps/nginx created`. In the visualizer, three Pods appear and move from `Pending` to `Running`. Hover any Pod to inspect its labels and status.

:::quiz
You applied a Deployment with `replicas: 3`, but the terminal shows only one confirmation line, not three. Why does `kubectl apply` not print one line per Pod?

**Answer:** Kubernetes creates the Deployment object first. The ReplicaSet and Pods are created asynchronously by controllers running in the background. The `apply` command confirms the Deployment was accepted by the API, not that all Pods are ready.
:::

## Resetting the Cluster

When you want to start over, click the reload icon below the terminal. This resets both the cluster and the filesystem to their initial state. Use it freely: nothing here has real consequences.

:::warning
Resetting discards every file you created in the terminal session. If you wrote a manifest you want to keep, copy its content somewhere before clicking reset.
:::

That is the full loop: write a manifest, apply it, observe the result, reset when done. Every lesson on KubeMastery follows this same pattern. You are ready to begin.
