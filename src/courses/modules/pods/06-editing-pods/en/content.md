# Editing and Modifying Pods

You've created a Pod, it's running, and now you need to change something. Maybe you want to update the container image to a newer version. Maybe you realize the environment variable you set has a typo. Maybe you forgot to add a resource limit. Your first instinct might be to open the manifest, change the field, and run `kubectl apply -f pod.yaml` again. In many cases, this will work — but for Pods specifically, you're going to run into a surprising limitation.

## Pod Spec Fields Are Mostly Immutable

Unlike many other Kubernetes objects, most fields in a Pod's `spec` are **immutable after creation**. Once a Pod is running, you cannot change the container image, environment variables, ports, volume mounts, or the container list. If you try, the API server will reject your request with an error like:

```
The Pod "my-pod" is invalid: spec.containers[0].image: Forbidden: pod updates may not change fields other than ...
```

This might seem frustrating at first, but it makes sense when you think about it. A running Pod represents a container process executing on a specific node. Changing the container image mid-run would mean stopping the current process and starting a new one with a different binary — which is essentially creating a new container, not modifying an existing one. Kubernetes is being honest with you: you can't change these things without replacing the Pod entirely.

:::info
This limitation is one of the primary reasons Deployments exist. A Deployment doesn't try to modify running Pods in place — it follows the rolling update strategy: creates new Pods with the new spec, waits for them to become ready, then deletes the old ones. The immutability of Pod specs is what makes this clean, safe, and predictable.
:::

## What You Can Change with `kubectl edit`

The `kubectl edit pod <name>` command opens the Pod's live manifest in your default terminal editor (usually vim or nano). You can make changes and save the file, and `kubectl` will try to apply them. However, for most fields, the API server will reject the change immediately with the "Forbidden" error described above.

A small number of fields are mutable on a live Pod:

- `spec.containers[*].image` — the container image (though this is almost always done via Deployments in practice)
- `spec.initContainers[*].image` — init container images
- `spec.activeDeadlineSeconds` — used by Jobs
- `spec.tolerations` — pod tolerations can be extended (but not reduced)

For any other field, `kubectl edit` will let you type the change and then reject it when you save. This can be confusing the first time you encounter it — you've edited the file, saved it, and then received an error. The Pod is unchanged.

## The Standard Workaround: Export, Edit, Delete, Apply

When you need to change an immutable field, the correct approach involves a few manual steps:

**Step 1**: Export the current Pod manifest to a file:

```bash
kubectl get pod my-pod -o yaml > pod.yaml
```

**Step 2**: Edit the file with your desired changes:

```bash
# Open with your editor
vim pod.yaml
# or
nano pod.yaml
```

Make your changes — for example, update the container image or add an environment variable.

**Step 3**: Delete the existing Pod:

```bash
kubectl delete pod my-pod
```

**Step 4**: Apply the modified manifest to create the new Pod:

```bash
kubectl apply -f pod.yaml
```

The new Pod will have a new UID and will go through the full creation process (Pending → Running). There will be a brief window of downtime between the deletion and the new Pod becoming ready. In production, this is why you use Deployments — they handle this transition gracefully, with zero downtime, using rolling updates.

## The Shortcut: `kubectl replace --force`

If you want to collapse Steps 3 and 4 into a single command, Kubernetes provides a way:

```bash
kubectl replace --force -f pod.yaml
```

The `--force` flag instructs Kubernetes to delete the existing Pod and immediately recreate it from the provided file. It's equivalent to running `kubectl delete pod` followed by `kubectl apply -f pod.yaml`, but in one command. The same brief downtime applies — there will be a moment where the old Pod is gone and the new one hasn't started yet.

:::warning
`kubectl replace --force` is a destructive operation. It deletes the existing Pod immediately, without waiting for a graceful shutdown. Use it carefully, especially in production. For production changes, always prefer managing Pods through a Deployment, where rolling updates ensure continuity.
:::

## Changing the Image with `kubectl set image`

There is one shortcut for the very common operation of updating a container image. The `kubectl set image` command can update the image of a running container directly:

```bash
kubectl set image pod/my-pod web=nginx:1.26
```

Here `web` is the container name (as defined in `spec.containers[*].name`) and `nginx:1.26` is the new image. This works on live Pods — the container image is one of the few fields the API server allows to be mutated. However, because the Pod spec changes, the kubelet will stop the old container and start a new one with the new image, causing a brief restart.

In practice, you'll almost always use `kubectl set image` on a Deployment rather than directly on a Pod:

```bash
kubectl set image deployment/my-deploy web=nginx:1.26
```

On a Deployment, this triggers a rolling update — new Pods are created with the new image, old Pods are gracefully removed. Much safer.

## Why This Limitation Exists

The immutability of Pod specs is a deliberate design decision, not an oversight. Pods are the atomic unit of scheduling. The scheduler made a decision about where to place this Pod based on its spec — its resource requests, node selectors, affinity rules, and so on. Allowing arbitrary spec changes mid-life would invalidate those decisions and create a mess of inconsistency between what the scheduler decided and what is actually running.

More importantly, the Kubernetes model is built around **replacement, not mutation**. When you need a different Pod, you create a new one and delete the old one. Higher-level objects like Deployments, DaemonSets, and StatefulSets automate this replacement pattern, which is why raw Pods are considered a low-level primitive for advanced use cases, not the primary unit of deployment.

Think of it like a contract. When you submitted the Pod spec, you and Kubernetes entered an agreement: "Run this, exactly as described, on this node." Kubernetes honored its end. If you want something different, you need to submit a new contract — a new Pod with a new UID.

## When Editing Pods Directly Makes Sense

Most of the time, you should manage your workloads through a Deployment and never edit Pods directly. But there are legitimate use cases for direct Pod interaction:

- **Debugging**: You might temporarily change a container's command to drop you into a shell, or add an environment variable to enable verbose logging. In these cases, you edit the Pod directly, knowing the change is temporary and you'll clean up afterward.
- **One-off Jobs**: A standalone Pod running a batch task that you created for a specific purpose — you might need to adjust it before it runs.
- **Learning and Experimentation**: This very lesson. Understanding how Pods behave when edited directly builds intuition that helps you understand Deployments later.

In all production scenarios, the answer to "how do I update this?" is almost always: update the Deployment manifest and apply it.

## Hands-On Practice

Let's experience Pod immutability first-hand and practice the correct workarounds.

**1. Create a Pod:**

```bash
kubectl run edit-demo --image=nginx:1.25 --env="LOG_LEVEL=info"
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

Open `edit-demo.yaml` and change the image from `nginx:1.25` to `nginx:1.26`. Also add a new environment variable:

```yaml
env:
  - name: LOG_LEVEL
    value: "debug"
  - name: NEW_VAR
    value: "added"
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
echo ""
```

**7. Try `kubectl set image` directly on the Pod:**

```bash
kubectl set image pod/edit-demo edit-demo=nginx:1.27
kubectl get pod edit-demo -o jsonpath='{.spec.containers[0].image}'
echo ""
```

Note: this will cause the container to restart briefly.

**8. Clean up:**

```bash
kubectl delete pod edit-demo
```

The key insight from this lesson is not just *how* to edit Pods — it's *why* the limitation exists and why the correct production answer is almost always to use a Deployment. Direct Pod editing is a useful skill for debugging and learning, but the moment your workload needs reliability and zero-downtime updates, you reach for a Deployment and let the controller handle the rest.
