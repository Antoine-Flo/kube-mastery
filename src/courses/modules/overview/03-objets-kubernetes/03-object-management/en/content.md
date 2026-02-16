# Object Management

## Three Approaches, One Rule

Now that you understand what Kubernetes objects are and how spec and status work, the next question is: how do you actually create and manage those objects in practice? Kubernetes offers three distinct approaches, each suited to different situations. But before we explore them, here is the most important rule: **use only one technique per object**. Mixing approaches on the same object leads to conflicts and surprises.

Think of it like editing a shared document. If one person edits in Google Docs while another edits a local copy and pastes it back, changes will be lost. The same principle applies here — pick one method and stick with it.

## The Three Techniques

### 1. Imperative Commands

You type a single command, and Kubernetes acts immediately. No files involved.

```bash
kubectl create deployment nginx --image nginx
kubectl scale deployment nginx --replicas=3
kubectl delete deployment nginx
```

**Best for:** Learning, quick experiments, one-off tasks. You get immediate feedback, and the barrier to entry is low.

**Tradeoff:** There is no file to version, review, or share. If you need to recreate something, you have to remember the exact commands.

### 2. Imperative Object Configuration

You write YAML or JSON files, but you explicitly choose the operation — `create`, `replace`, or `delete`. You control each step.

```bash
kubectl create -f nginx.yaml
kubectl replace -f nginx.yaml
kubectl delete -f nginx.yaml
```

**Best for:** Situations where you want file-based definitions but need full control over each operation.

**Tradeoff:** `replace` overwrites the entire object, which can unintentionally remove fields that Kubernetes added (like a Service's `clusterIP`).

### 3. Declarative Object Configuration

You provide YAML files describing the desired state, and `kubectl apply` figures out what needs to change. It compares the cluster state to your files and applies only the differences using the patch API.

```bash
kubectl apply -f configs/
kubectl diff -f configs/
```

**Best for:** Production, team collaboration, GitOps, and infrastructure-as-code. Your files become the source of truth.

**Tradeoff:** Slightly more complex to understand initially, but it pays off in safety and reproducibility.

:::info
Declarative configuration uses the **patch API** rather than replacing the entire object. This means changes made by Kubernetes itself — like automatically assigned IPs or resource versions — are preserved when you apply your files.
:::

## Why Mixing Causes Problems

Here is a concrete example. Suppose you scale a Deployment with an imperative command:

```bash
kubectl scale deployment nginx --replicas=5
```

The cluster now has 5 replicas. But your manifest file still says `replicas: 3`. The next time someone runs `kubectl apply -f deployment.yaml`, the replica count drops back to 3 — because the file is the source of truth for declarative management. Neither person did anything wrong, but mixing approaches created an unexpected result.

:::warning
A Kubernetes object should be managed using only one technique. Mixing imperative commands with declarative configuration on the same object is a common source of confusion — especially on teams.
:::

## Try It: Preview Before You Apply

One of the most powerful features of declarative management is the ability to see what *would* change before actually changing anything:

```bash
kubectl diff -f configs/
```

This shows the difference between what your files describe and what currently exists in the cluster. You can also use dry-run mode to validate without applying:

```bash
kubectl apply -f configs/ --dry-run=client
```

Together, `diff` and `--dry-run` form a safety net that helps you catch mistakes before they reach the cluster.

## Choosing the Right Approach

| Situation | Recommended Approach |
|---|---|
| Learning and experimenting | Imperative commands |
| One-off changes or debugging | Imperative commands |
| Small teams, simple deployments | Imperative object configuration |
| Production, GitOps, CI/CD | Declarative configuration |

Most teams settle on declarative configuration for anything that matters, and use imperative commands only for quick, throwaway experiments.

## Wrapping Up

Kubernetes gives you flexibility in how you manage objects, but that flexibility comes with a responsibility: stay consistent. Whether you choose imperative commands for speed or declarative configuration for safety, the key is to pick one approach per object and stick with it. In the next lessons, you will get hands-on practice with imperative commands and declarative configuration so you can see the differences firsthand.
