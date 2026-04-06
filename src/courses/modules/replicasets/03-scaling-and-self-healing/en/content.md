---
seoTitle: 'Kubernetes ReplicaSets, Scaling, Self-Healing, Pod Adoption'
seoDescription: 'Explore how Kubernetes ReplicaSets scale replicas up and down, automatically self-heal from Pod failures, and handle unexpected Pod adoption.'
---

# Scaling and Self-Healing with ReplicaSets

A ReplicaSet is a living controller that continuously responds to cluster state. In this lesson you'll see two of its most powerful behaviors: scaling replicas up or down on demand, and automatically healing from Pod failures. You'll also encounter a surprising behavior called adoption, a direct consequence of how ReplicaSets find their Pods.

## The Reconciliation Loop

:::info
The reconciliation loop is simple: compare **desired** (`spec.replicas`) to **observed** (Pods currently matching the selector). Too few → create. Too many → delete. Equal → do nothing. This loop runs continuously and reacts to any change automatically.
:::

If those numbers differ for any reason, the controller takes immediate action to make them equal. This reactive design is what makes controllers robust.

## Scaling Up

Scaling up to handle more load is a single command:

```bash
kubectl scale rs web-rs --replicas=5
```

The ReplicaSet's `spec.replicas` field is updated to 5. The controller sees that desired (5) exceeds actual (3) and creates two new Pods from the same template in parallel. Within seconds, all five Pods are running.

You can also scale by editing the YAML file and re-applying it:

```bash
# Edit web-rs.yaml, change replicas from 3 to 5, then:
kubectl apply -f web-rs.yaml
```

`kubectl scale` is faster for quick adjustments; updating the file is better for changes you want to commit to version control.

## Scaling Down

Scaling down works the same way:

```bash
kubectl scale rs web-rs --replicas=2
```

The ReplicaSet now sees that actual (5) exceeds desired (2), so it needs to delete three Pods. It selects which Pods to delete based on a deterministic ordering that favors removing the most recently created or least ready Pods, in most cases you should treat the selection as approximately random, and never depend on a specific Pod surviving a scale-down.

The deleted Pods are terminated gracefully: Kubernetes sends a SIGTERM to the containers and waits for the `terminationGracePeriodSeconds` (default 30 seconds) before force-killing them. During this window, the Pod is removed from any Service's Endpoints list, so it stops receiving new traffic before it's shut down.

@@@
graph LR
    CMD1["kubectl scale --replicas=5"] --> RS
    CMD2["kubectl scale --replicas=2"] --> RS

    RS["ReplicaSet<br/>Desired: variable"]
    RS -->|"desired > actual<br/>create Pods"| CREATE["Create Pods<br/>(reconcile up)"]
    RS -->|"desired < actual<br/>delete Pods"| DELETE["Delete Pods<br/>(reconcile down)"]
    RS -->|"desired == actual<br/>do nothing"| NOOP["No action"]

    CREATE --> P1["Pod 1"] & P2["Pod 2"] & P3["Pod 3"] & P4["Pod 4"] & P5["Pod 5"]
    DELETE --> GONE["Pods terminated"]
@@@

## Self-Healing

Delete a Pod that belongs to a ReplicaSet, and the controller replaces it almost immediately.

```bash
# With 3 replicas running, delete one Pod manually
kubectl delete pod web-rs-x7k2p

# Run immediately after:
kubectl get pods -l app=web
```

You'll see one Pod in `Terminating` status and a new Pod already in `ContainerCreating`. Within a few seconds, the count is back to three.

This same mechanism handles node failures. When a Node becomes unreachable, the node lifecycle controller eventually marks the Pods on that node as `Unknown`. After a configurable timeout, those Pods are forcibly deleted from the API server, which causes the ReplicaSet to detect the shortfall and create replacements on healthy nodes.

:::info
The default timeout before failed Pods are evicted from unreachable nodes is controlled by `--pod-eviction-timeout` on the controller manager (default 5m0s). This means there's a delay of several minutes between a node failing and the ReplicaSet creating replacement Pods. For workloads where even a few minutes of reduced capacity is unacceptable, you might tune this setting or use Pod Disruption Budgets alongside multiple replicas.
:::

## Pod Adoption

Here's a behavior that often surprises newcomers: if you create a bare Pod with labels that match an existing ReplicaSet's selector, the ReplicaSet will **adopt** that Pod and count it toward the desired replica count.

Imagine you have a ReplicaSet with `replicas: 3` and `selector: app=web`. Three Pods are running. Now you create a fourth Pod independently with the label `app=web`:

```bash
kubectl run extra-pod --image=nginx:1.28 --labels="app=web"
```

The ReplicaSet controller sees this new Pod match its selector. Its count goes from 3 to 4, but it only wants 3. So it selects one Pod to delete, possibly your `extra-pod`, possibly one of the original three, and terminates it. The result is still three Pods.

The reverse is also true: if you manually remove a label from one of the ReplicaSet's Pods so it no longer matches the selector, the ReplicaSet "releases" it and creates a new replacement to restore the count. The relabeled Pod becomes a free-floating bare Pod. This technique is occasionally used for debugging, you extract one Pod from the herd by changing its label so you can inspect it in isolation while the ReplicaSet keeps the fleet at full strength.

:::warning
Label collisions between different ReplicaSets can cause chaotic behavior. If two ReplicaSets in the same namespace have overlapping selectors, they'll fight over the same Pods, each one trying to maintain its own desired count, randomly adopting and deleting Pods that the other considers its own. Always make sure each ReplicaSet's selector uniquely identifies its Pods. A label like `instance: web-rs-prod` that includes the ReplicaSet's own name is a good way to ensure uniqueness.
:::

## Watching the Reconciliation in Real Time

The `-w` flag streams live updates as events occur, and is the best way to observe the reconciliation loop in real time:

```bash
kubectl get pods -l app=web -w
```

Leave this running while you operate in another terminal. You'll see each state transition stream in: `Pending`, `ContainerCreating`, `Running`, `Terminating`.

## Hands-On Practice

Start with a running ReplicaSet and work through scaling and self-healing exercises.

**1. Create the ReplicaSet**

```yaml
#web-rs.yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.28
```

Check the ReplicaSet:

```bash
kubectl get rs web-rs
```

**2. Scale up to 5 replicas**

```bash
kubectl scale rs web-rs --replicas=5
kubectl get pods -l app=web
kubectl get rs web-rs
```

**3. Scale down to 2 replicas**

```bash
kubectl scale rs web-rs --replicas=2
kubectl get pods -l app=web
# Notice: only 2 remain, 3 were terminated
```

**4. Demonstrate self-healing**

```bash
# First scale back to 3 for a clear demo
kubectl scale rs web-rs --replicas=3
kubectl get pods -l app=web

# Delete a Pod and watch it be replaced in the visualizer
kubectl delete pod <pod-name>
```

**5. Demonstrate Pod adoption**

```bash
# Create an extra Pod with the matching label and watch it be replaced in the visualizer
kubectl run intruder --image=nginx:1.28 --labels="app=web"
```

**6. Extract a Pod from the fleet by changing its label**

```bash
# Pick one Pod name from this command output
kubectl get pods -l app=web

# Remove the label that the RS watches
kubectl label pod <pod-name> app-

# The RS will create a replacement, you now have 4 pods total:
# 3 managed by the RS + 1 free-floating
kubectl get pods --show-labels

# The extracted Pod is now a bare Pod you can inspect safely
# Re-attach the label if you want the RS to reclaim it:
kubectl label pod <pod-name> app=web
```

**7. Clean up**

```bash
kubectl delete rs web-rs
```
