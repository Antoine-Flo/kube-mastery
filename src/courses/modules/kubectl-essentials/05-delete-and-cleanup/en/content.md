---
seoTitle: 'Delete Kubernetes Resources, graceful termination, cascade'
seoDescription: 'Understand how Kubernetes handles graceful pod termination, cascade deletion, and force delete to safely clean up cluster resources.'
---

# Delete and Cleanup

You have finished testing a Deployment and its Pods. How do you cleanly remove everything? Deleting a Pod alone does not work if a ReplicaSet immediately recreates it. And does deleting a Deployment also remove its Pods? This lesson answers both questions and covers the different ways to delete resources in Kubernetes.

## Cascade deletion: ownership matters

When you delete a Deployment, Kubernetes does not stop at the Deployment object itself. It follows the chain of ownership: the Deployment owns its ReplicaSet, and the ReplicaSet owns its Pods. Each level is deleted in order.

@@@
graph TD
DEL["kubectl delete deployment web"]
DEP["Deployment web\n(deleted)"]
RS["ReplicaSet\n(deleted, cascade)"]
P1["Pod 1\n(deleted, cascade)"]
P2["Pod 2\n(deleted, cascade)"]
DEL --> DEP --> RS --> P1
RS --> P2
@@@

This ownership is stored in each object's `ownerReferences` field. The garbage collector reads those references and triggers deletions downstream. Because of this, deleting a Pod that belongs to a Deployment is pointless: the ReplicaSet notices the count is wrong and creates a replacement immediately.

```bash
kubectl create deployment web --image=nginx:1.28 --replicas=2
kubectl get pods
kubectl delete deployment web
kubectl get pods
```

After the last command, the Pods are gone too. You did not delete them explicitly: the cascade took care of it.

:::quiz You delete a Pod that belongs to a Deployment. What happens next?
**Answer:** The ReplicaSet that owns the Pod detects that the actual count dropped below the desired count. It immediately schedules a new Pod to restore the replica count. The Pod you deleted is gone, but a replacement appears within seconds.
:::

## Graceful termination

Kubernetes does not kill Pods immediately. By default, it sends a `SIGTERM` signal to the container's main process and waits up to 30 seconds. That window gives the application time to finish ongoing requests, flush buffers, or close connections cleanly. After the grace period, Kubernetes sends `SIGKILL` and the container is force-stopped.

```bash
kubectl create deployment web --image=nginx:1.28 --replicas=2
kubectl get pods
```

Copy the name of one of the Pods, then:

```bash
kubectl delete pod <pod-name>
```

The Pod enters `Terminating` status during the grace period, then disappears. On a real cluster with a well-written application, no request is dropped during that window.

To skip the graceful shutdown and delete immediately:

```bash
kubectl delete pod <pod-name> --force --grace-period=0
```

:::warning `--force --grace-period=0` bypasses the graceful shutdown entirely. On a real cluster, this can leave open connections hanging or corrupt unsaved state in a database or message queue. Use it only when a Pod is stuck in `Terminating` for a long time and you are certain the process inside is already frozen or dead.
:::

## Deleting by label

Labels make it easy to target a group of resources without listing them individually.

```bash
kubectl delete pods -l app=web
```

This deletes every Pod whose `app` label equals `web` in the current namespace. Since the Deployment is still alive, the ReplicaSet will recreate those Pods. To permanently remove them, delete the Deployment itself.

## Deleting from a file

If you applied a resource from a YAML file, you can use the same file to delete it.

```bash
kubectl delete -f web-deployment.yaml
```

kubectl reads the `kind` and `name` from the file and issues the corresponding delete. This is convenient when you want to undo exactly what you applied, without remembering resource names.

:::quiz What is the difference between `kubectl delete pods --all` and `kubectl delete all`?

- `delete pods --all` removes all Pods in the current namespace
- `delete all` removes Pods, Services, Deployments, and ReplicaSets
- They are equivalent
  **Answer:** `kubectl delete pods --all` targets only Pods. `kubectl delete all` removes all common resource types (Pods, Services, Deployments, ReplicaSets) in the current namespace. Using `delete all` carelessly in a shared namespace can destroy running Services.
  :::

## Observing cascade in action

:::quiz Create a Deployment with 2 replicas, delete one of its Pods, then check what happened. What do you observe?
**Try it:**

```bash
kubectl create deployment demo --image=nginx:1.28 --replicas=2
kubectl get pods
```

Then copy a Pod name and run:

```bash
kubectl delete pod <pod-name>
kubectl get pods
```

**Answer:** A new Pod appears to replace the deleted one. The ReplicaSet reconciles the actual state toward the desired replica count of 2. Deleting a Pod owned by a Deployment never reduces the running replica count.
:::

```bash
kubectl delete deployment demo
kubectl delete deployment web
```

Deletion in Kubernetes respects ownership. Once you understand cascade and graceful termination, cleanups become predictable. The next lesson moves to the other end of the workflow: extracting exactly the information you need from `kubectl get` using output formatting flags.
