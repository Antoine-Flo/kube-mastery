# Deleting and Cleaning Up Resources

Creating resources is only half of the story. Eventually, you need to remove them, to clean up experiments, decommission old services, free resources, or reset a namespace to a clean state. Kubernetes provides a thoughtful deletion mechanism that prioritizes graceful application shutdown. Understanding how it works, and when to deviate from the defaults, will help you avoid both stuck resources and unexpected downtime.

## The Basic Delete Commands

The most straightforward way to delete a resource is by specifying its type and name:

```bash
kubectl delete pod my-pod
kubectl delete deployment my-deployment
kubectl delete service my-service
```

You can delete multiple resources at once, or mix types in a single command:

```bash
kubectl delete pod pod-one pod-two pod-three
kubectl delete pod my-pod service my-service
```

### Deleting from a Manifest File

Just as you can create resources with `kubectl apply -f`, you can delete them using the same file with `kubectl delete -f`:

```bash
kubectl delete -f deployment.yaml
kubectl delete -f ./manifests/
```

This is a natural complement to the declarative workflow. Kubernetes reads the resource type and name from the file and deletes the matching objects, you do not need to remember the exact names.

:::info
`kubectl delete -f <file>` is the cleanest way to tear down resources you created declaratively, because the manifest file serves as the record of what was created.
:::

## How Kubernetes Deletes: Graceful Termination

When you delete a pod, Kubernetes does not simply kill it instantly. It follows a graceful termination sequence that gives your application time to finish in-flight requests, close connections, and clean up, just like a well-run restaurant that lets you finish your meal even after closing time.

Here is what happens step by step when a pod is deleted:

1. The pod's status is set to `Terminating`.
2. Kubernetes sends a **SIGTERM** signal to the main process inside each container, a polite request to shut down.
3. A grace period timer starts (default: 30 seconds).
4. If the process exits before the grace period ends, the pod is deleted immediately.
5. If the process is still running when the grace period expires, Kubernetes sends **SIGKILL**, an immediate, forceful termination.
6. The pod is removed from the cluster.

```mermaid
sequenceDiagram
    participant kubectl
    participant API as API Server
    participant Pod
    participant Container

    kubectl->>API: DELETE pod
    API->>Pod: Set status = Terminating
    API->>Container: Send SIGTERM
    Note over Container: App begins graceful shutdown
    alt Process exits within grace period
        Container-->>API: Exited (clean)
        API->>Pod: Remove pod
    else Grace period expires (default 30s)
        API->>Container: Send SIGKILL
        Container-->>API: Killed
        API->>Pod: Remove pod
    end
```

Your application should handle SIGTERM by stopping new work and finishing current work. If it does this well, graceful termination means zero dropped requests, which is why well-designed containerized applications always implement a SIGTERM handler.

## Force Deletion: Skipping the Grace Period

Sometimes a pod gets stuck in `Terminating` state and will not go away. This can happen if a node becomes unresponsive, a finalizer is blocking deletion, or the application completely ignores SIGTERM. In those situations, you can force Kubernetes to delete the pod immediately:

```bash
kubectl delete pod my-stuck-pod --grace-period=0 --force
```

This tells Kubernetes to remove the pod from its records immediately without waiting for the container to exit.

:::warning
`--force --grace-period=0` is a blunt instrument. It bypasses the graceful shutdown sequence, which can lead to dropped connections and data corruption if the application was mid-processing. Use it only when a pod is genuinely stuck and normal deletion is not working. Never use it routinely as a "faster delete" shortcut.
:::

## Cascade Deletion: How Deletions Propagate

Kubernetes resources often have parent-child relationships. A Deployment owns ReplicaSets, which own Pods. By default, Kubernetes uses **cascade deletion**: deleting a parent resource also deletes all of the resources it owns.

```bash
# Deletes the Deployment AND all its ReplicaSets and Pods
kubectl delete deployment my-app
```

This is the behavior you almost always want, because orphaned pods with no owner would consume resources without being managed by anything.

### Orphan Mode: Keeping Child Resources

There is a special case where you might want to delete a parent without deleting its children: `--cascade=orphan`. This removes the owner object but leaves the pods running, unattached to any controller.

```bash
# Deletes the Deployment but leaves the Pods running
kubectl delete deployment my-app --cascade=orphan
```

This is occasionally useful for controlled migrations, for example, when transferring ownership of pods from one controller to another. It is a niche use case, but good to know it exists.

:::warning
Orphaned pods are no longer managed by any controller. If they crash, they will not be restarted. If the node they live on dies, they will not be rescheduled. Use `--cascade=orphan` only with a clear plan for what happens next.
:::

## Deleting Namespaces: All or Nothing

Deleting a namespace is the nuclear option. When you delete a namespace, Kubernetes deletes every single resource inside it:

- Every pod, service, deployment, replicaset
- Every ConfigMap, Secret, PersistentVolumeClaim
- Every other namespaced resource, without exception

```bash
kubectl delete namespace staging
```

:::warning
**Deleting a namespace is irreversible and destroys everything inside it.** Double-check you have the right namespace before running this command. There is no "are you sure?" prompt. In production, namespace deletion should be a carefully considered, team-approved action.
:::

The deletion is not instant for large namespaces, Kubernetes works through the contained resources methodically, and the namespace itself will sit in a `Terminating` state until everything is cleaned up. If a namespace is stuck in `Terminating`, it is usually because a finalizer on one of its resources is not completing.

## Deleting Resources by Label

You can delete all resources matching a label selector, which is useful for cleaning up an entire application that spans multiple resource types:

```bash
# Delete all pods with the label app=my-app
kubectl delete pods -l app=my-app

# Delete all resources (of any type) with the label app=my-app
kubectl delete all -l app=my-app
```

## Hands-On Practice

Work through these commands in the terminal. Take particular note of how the termination grace period works, watch the pod status transitions in real time.

```bash
# Create some resources to clean up
kubectl create deployment cleanup-demo --image=nginx --replicas=3
kubectl expose deployment cleanup-demo --port=80

# Check what was created
kubectl get all

# --- Delete by name ---

# Delete a pod, watch the Deployment immediately create a replacement
kubectl delete pod <POD_NAME>

# --- Watch the termination grace period ---
# Run a pod that ignores SIGTERM (sleep runs for a long time)
kubectl run grace-demo --image=busybox -- sleep 3600

# Delete it and watch, you will see it in Terminating state
kubectl delete pod grace-demo

# --- Force delete a stuck pod ---
kubectl run stuck-demo --image=busybox -- sleep 3600
kubectl get pods

kubectl delete pod stuck-demo --grace-period=0 --force
kubectl get pods

# --- Cascade behavior ---
# See the ReplicaSets owned by the deployment
kubectl get replicasets

# Delete the deployment, watch ReplicaSets and Pods go too
kubectl delete deployment cleanup-demo
kubectl get all

# --- Delete by label ---
kubectl create deployment label-demo --image=nginx
kubectl label deployment label-demo tier=experiment

kubectl delete all -l tier=experiment
```

Pay attention to the pod status transitions in the visualizer. Watching a pod move from `Running` to `Terminating` to disappearing gives you a concrete feel for the termination lifecycle, knowledge that will serve you well when troubleshooting stuck deletions.
