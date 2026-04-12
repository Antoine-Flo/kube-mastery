---
seoTitle: 'Kubernetes Spec vs Status, Reconciliation, Self-Healing'
seoDescription: 'Explore how Kubernetes separates desired state in spec from current state in status, and how the reconciliation loop drives self-healing across controllers.'
---

# Anatomy of a Manifest

## The Reconciliation Loop

@@@
graph LR
USER["You write spec\n(desired state)"]
API["API Server\nstores object in etcd"]
CTRL["Controller\nwatches API for changes"]
ACT["Controller acts\ncreates Pods, etc."]
STATUS["Controller updates\nstatus field"]
USER --> API --> CTRL --> ACT --> STATUS --> CTRL
@@@

The reconciliation loop is the engine behind Kubernetes self-healing. A controller watches the API server for objects of its type. When it sees a difference between `spec` and `status`, it acts. After acting, it writes what it observed back into `status`. Then it watches again. The loop never stops.

Why build it as a loop rather than a one-shot command? Because the cluster environment is unreliable. Nodes fail, network connections drop, containers crash. A loop that continuously compares desired state to observed state can recover from any failure, automatically, without you intervening.

## Creating a Pod to Observe

To see this in action in the simulator, start by creating a simple Pod. You will read its full manifest afterward to understand every section.

```bash
nano simple-pod.yaml
```

Build the manifest field by field. Start with identity:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: simple-pod
```

Then add the spec:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: simple-pod
spec:
  containers:
    - name: web
      image: nginx:1.28
```

```bash
kubectl apply -f simple-pod.yaml
```

## Reading the Full Manifest

Once the Pod is running, read its full object back from the API server:

```bash
kubectl get pod simple-pod -o yaml
```

The output is much longer than what you wrote. Kubernetes added a great deal to your original manifest. The key sections to understand are:

**`metadata`** now contains fields Kubernetes generated: `uid`, `resourceVersion`, `creationTimestamp`, and possibly annotations injected by admission controllers. You declared only `name`. Kubernetes filled the rest.

**`spec`** is largely what you wrote, but with defaults applied. Kubernetes added `dnsPolicy`, `restartPolicy`, `terminationGracePeriodSeconds`, and more. These are sane defaults you did not need to specify.

**`status`** is entirely Kubernetes-written. It contains the current observed state of the Pod. The most important subfields are:

- `status.phase`: the high-level lifecycle stage. It moves from `Pending` to `Running` once containers start.
- `status.conditions`: a list of named conditions. `PodScheduled` becomes `True` when a node is assigned. `Initialized` becomes `True` when init containers finish. `ContainersReady` and `Ready` become `True` when all containers pass their readiness checks.
- `status.containerStatuses`: per-container details including the image ID pulled, restart count, and the current state (`running`, `waiting`, or `terminated`).

:::quiz
In the `kubectl get pod simple-pod -o yaml` output, what does `status.phase` show when the Pod is running correctly?

**Try it:** `kubectl get pod simple-pod -o yaml`

**Answer:** `Running`. The `status.phase` field reflects the current stage as observed by the kubelet on the node. `Pending` means the Pod is waiting to be scheduled or the image is being pulled. `Running` means at least one container is active.
:::

## What Failure Looks Like in Status

:::warning
If the container image does not exist or cannot be pulled, the Pod does not error out and disappear. It stays alive in the API server, and `status` tells the full story. The `status.phase` will be `Pending`, and `status.containerStatuses[0].state.waiting.reason` will show `ErrImagePull` first, then `ImagePullBackOff` as Kubernetes backs off its retry attempts. The `waiting.message` field gives the exact error from the container runtime. When a Pod refuses to start, `kubectl get pod <name> -o yaml` is the first place to look.
:::

To watch the Pod status evolve in real time without reading the full YAML each time:

```bash
kubectl get pod simple-pod --watch
```

Press Ctrl+C to stop watching. You will see status columns update as the Pod transitions through phases. This is useful when waiting for a large image to pull.

:::quiz
Why is `status` stored inside the same object as `spec` rather than in a separate object?

**Answer:** Because the object is the unit of consistency. A single API request gives you the complete picture: what you asked for and what Kubernetes observed. Controllers use optimistic concurrency with `resourceVersion` to write `status` without ever overwriting the user-managed `spec`. Two fields in one object, two owners, no conflict.
:::

## Cleanup

```bash
kubectl delete pod simple-pod
```

The object is removed from etcd. The reconciliation loop for Pods has nothing left to reconcile. The slate is clean for the next exercise.

In the next lesson, you will learn how to generate valid manifests from the CLI instead of writing them from scratch, which eliminates a whole class of syntax errors before they reach the API server.
