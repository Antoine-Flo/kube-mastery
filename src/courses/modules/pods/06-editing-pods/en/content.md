# Editing and Modifying Pods

You've created a Pod, it's running, and now you need to change something, update the container image, fix a typo in an environment variable, or add a resource limit. Your first instinct might be to open the manifest, change the field, and run `kubectl apply -f pod.yaml` again. In many cases this will work, but for Pods specifically, you're going to run into a surprising limitation.

:::important
Most fields in a Pod's `spec` are **immutable after creation**. This is by design, understanding why, and knowing the correct workarounds, is what this lesson is about.
:::

## Pod Spec Fields Are Mostly Immutable

Once a Pod is running, you cannot change the container image, environment variables, ports, volume mounts, or the container list. If you try, the API server will reject your request with an error like:

```
The Pod "my-pod" is invalid: spec.containers[0].image: Forbidden: pod updates may not change fields other than ...
```

:::info
This limitation is one of the primary reasons Deployments exist. A Deployment doesn't try to modify running Pods in place, it follows the rolling update strategy: creates new Pods with the new spec, waits for them to become ready, then deletes the old ones. The immutability of Pod specs is what makes this clean, safe, and predictable.
:::

## What You Can Change with `kubectl edit`

The `kubectl edit pod <name>` command opens the Pod's live manifest in your default terminal editor. You can make changes and save the file, and `kubectl` will try to apply them. However, for most fields, the API server will reject the change with the "Forbidden" error.

A small number of fields are mutable on a live Pod:

- `spec.containers[*].image`, the container image
- `spec.initContainers[*].image`, init container images
- `spec.activeDeadlineSeconds`, used by Jobs
- `spec.tolerations`, can be extended (but not reduced)

For any other field, `kubectl edit` will let you type the change and then reject it when you save, which can be confusing the first time you encounter it.

## The Standard Workaround: Export, Edit, Delete, Apply

When you need to change an immutable field, the correct approach involves a few manual steps:

**Step 1**: Export the current Pod manifest to a file:

```bash
kubectl get pod my-pod -o yaml > pod.yaml
```

**Step 2**: Edit the file with your desired changes:

```bash
vim pod.yaml
```

**Step 3**: Delete the existing Pod:

```bash
kubectl delete pod my-pod
```

**Step 4**: Apply the modified manifest to create the new Pod:

```bash
kubectl apply -f pod.yaml
```

The new Pod will have a new UID and will go through the full creation process (Pending → Running). There will be a brief window of downtime between the deletion and the new Pod becoming ready. In production, this is why you use Deployments, they handle this transition gracefully, with zero downtime, using rolling updates.

## The Shortcut: `kubectl replace --force`

If you want to collapse Steps 3 and 4 into a single command, Kubernetes provides a way:

```bash
kubectl replace --force -f pod.yaml
```

The `--force` flag instructs Kubernetes to delete the existing Pod and immediately recreate it from the provided file. It's equivalent to running `kubectl delete pod` followed by `kubectl apply -f pod.yaml`, but in one command. The same brief downtime applies.

:::warning
`kubectl replace --force` is a destructive operation. It deletes the existing Pod immediately, without waiting for a graceful shutdown. Use it carefully, especially in production. For production changes, always prefer managing Pods through a Deployment, where rolling updates ensure continuity.
:::

## Changing the Image with `kubectl set image`

There is one shortcut for the very common operation of updating a container image. The `kubectl set image` command can update the image of a running container directly:

```bash
kubectl set image pod/my-pod web=nginx:1.26
```

Here `web` is the container name (as defined in `spec.containers[*].name`) and `nginx:1.26` is the new image. Because the Pod spec changes, the kubelet will stop the old container and start a new one with the new image, causing a brief restart.

In practice, you'll almost always use `kubectl set image` on a Deployment rather than directly on a Pod:

```bash
kubectl set image deployment/my-deploy web=nginx:1.26
```

On a Deployment, this triggers a rolling update, new Pods are created with the new image, old Pods are gracefully removed.

## Why This Limitation Exists

The immutability of Pod specs is a deliberate design decision. Pods are the atomic unit of scheduling: the scheduler made a placement decision based on the Pod's spec, its resource requests, node selectors, affinity rules. Allowing arbitrary spec changes mid-life would invalidate those decisions and create inconsistency between what the scheduler decided and what is actually running.

More fundamentally, the Kubernetes model is built around **replacement, not mutation**. When you need a different Pod, you create a new one and delete the old one. Higher-level objects like Deployments, DaemonSets, and StatefulSets automate this pattern, which is why raw Pods are a low-level primitive for advanced use cases, not the primary unit of deployment.

## When Editing Pods Directly Makes Sense

Most of the time, you should manage workloads through a Deployment and never edit Pods directly. But there are legitimate use cases:

- **Debugging**: Temporarily change a container's command to drop into a shell, or add an environment variable to enable verbose logging.
- **One-off Jobs**: A standalone Pod running a batch task you created for a specific purpose.
- **Learning and Experimentation**: Understanding how Pods behave when edited directly builds intuition that helps you understand Deployments later.

In all production scenarios, the answer to "how do I update this?" is almost always: update the Deployment manifest and apply it.

## Hands-On Practice

Let's experience Pod immutability first-hand and practice the correct workarounds.

**1. Create a Pod:**

```bash
kubectl run edit-demo --image=nginx:1.28 --env="LOG_LEVEL=info"
kubectl get pod edit-demo
```

**2. Try to edit an immutable field:**

```bash
kubectl edit pod edit-demo
```

In the editor, find the `image` field and change it to `nginx:1.26`, then save. You'll see an error message at the bottom: the change is rejected. Press `:q!` in vim (or `Ctrl+X` in nano) to exit without saving.

**3. Export the manifest:**

```bash
kubectl get pod edit-demo -o yaml > edit-demo.yaml
```

**4. Edit the exported file:**

Open `edit-demo.yaml` and change the image from `nginx:1.28` to `nginx:1.26`. Also add a new environment variable:

```yaml
env:
  - name: LOG_LEVEL
    value: 'debug'
  - name: NEW_VAR
    value: 'added'
```

Save the file.

**5. Use `kubectl replace --force` to recreate:**

```bash
kubectl replace --force -f edit-demo.yaml
```

Watch the Pod be deleted and recreated:

```bash
kubectl get pods --watch
```

Press `Ctrl+C` when the new Pod is `Running`.

**6. Verify the changes took effect:**

```bash
kubectl exec edit-demo -- env | grep -E "LOG_LEVEL|NEW_VAR"
kubectl get pod edit-demo -o jsonpath='{.spec.containers[0].image}'
```

**7. Try `kubectl set image` directly on the Pod:**

```bash
kubectl set image pod/edit-demo edit-demo=nginx:1.27
kubectl get pod edit-demo -o jsonpath='{.spec.containers[0].image}'
```

Note: this will cause the container to restart briefly.

**8. Clean up:**

```bash
kubectl delete pod edit-demo
```

The key insight from this lesson is not just _how_ to edit Pods, it's _why_ the limitation exists and why the correct production answer is almost always to use a Deployment. Direct Pod editing is a useful skill for debugging and learning, but the moment your workload needs reliability and zero-downtime updates, you reach for a Deployment and let the controller handle the rest.
