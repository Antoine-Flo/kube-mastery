---
seoTitle: 'Editing Kubernetes Pods, Immutability, replace, set image'
seoDescription: 'Understand Kubernetes Pod spec immutability, when kubectl edit fails, and how to update Pods using replace --force or kubectl set image.'
---

# Editing Pods

Your Pod is running. You want to update the image to a newer version. You open `kubectl edit pod first-pod`, change `nginx:1.27` to `nginx:1.28`, save the file, and Kubernetes responds with an error: `Forbidden: updates to pod spec for fields other than...`. What is going on?

## Why Pods are mostly immutable

The error is not a bug. It is a deliberate design decision. Once a Pod is created, most fields in its spec are frozen. The container runtime launched your containers with a specific configuration: this image, these ports, these volume mounts. Changing those fields on a running Pod would be like swapping the engine of a car while it is driving. The result would be undefined and almost certainly broken.

Kubernetes enforces immutability at the Pod level to keep behavior deterministic. If you need a different spec, you create a new Pod with that spec, and the old one disappears cleanly. This is not a limitation, it is the model.

@@@
graph TD
POD["Pod (running)"]
POD --> IMMUT["Immutable after creation\nspec.containers image, ports, env\nspec.volumes\nspec.nodeName\nspec.serviceAccountName"]
POD --> LABELS["Mutable via kubectl label or patch\nmetadata.labels\nmetadata.annotations"]
POD --> NOTE["Containers image: mutable\nonly via force replace"]
@@@

The fields that are immutable after creation include most of `spec.containers` (env vars, ports, volume mounts), `spec.volumes`, `spec.nodeName`, and `spec.serviceAccountName`. Labels and annotations on `metadata` are mutable at any time through `kubectl label` or `kubectl annotate`.

## The correct workflow for changing a Pod

The right approach is straightforward: edit your YAML file locally, delete the old Pod, and apply the new one.

Start by modifying the file. For example, if `first-pod.yaml` contains `image: nginx:1.27`, open it and change the version:

```bash
nano first-pod.yaml
```

Then delete the running Pod and create the new one:

```bash
kubectl delete pod first-pod
kubectl apply -f first-pod.yaml
```

There is a gap between deletion and the new Pod reaching `Running`. For bare Pods, that gap is real: no traffic, no process. This is one of the main reasons production workloads use Deployments instead of bare Pods.

## Force replace: a shortcut

`kubectl replace --force -f first-pod.yaml` combines deletion and recreation into one command. It is equivalent to the two-step workflow above, but more convenient when you are iterating quickly during debugging.

```bash
kubectl replace --force -f first-pod.yaml
```

This is a destructive operation. The running Pod is deleted immediately, without waiting for a graceful shutdown. Use it in a learning context or when the downtime does not matter, not for production services.

:::quiz
You change the image in a running Pod using `kubectl edit pod`. Kubernetes returns: `Forbidden: updates to pod spec for fields other than...`. What is the correct next step?

- Use `kubectl patch pod` instead, which has fewer restrictions
- Delete the Pod and recreate it from the modified manifest
- Modify the Pod directly through the Kubernetes API, which bypasses validation

**Answer:** Delete the Pod and recreate it from the modified manifest. `kubectl patch` has the same immutability constraints for Pod spec fields. Bypassing the API is not possible in the simulator and would violate the same rules in a real cluster. The only correct path for immutable fields is delete and recreate.
:::

:::warning
Do not confuse editing a bare Pod with editing a Deployment. When you run `kubectl edit deployment my-app` and change the image in the Pod template, Kubernetes does a rolling update: new Pods are created with the new spec, old Pods are terminated progressively. No downtime, no manual deletion. This is exactly why Deployments exist. Editing a bare Pod directly is something you do when debugging, not when running production workloads.
:::

:::quiz
If Pods are this difficult to modify, why not use Deployments for everything from the start?

**Answer:** You should. Bare Pods are useful in two situations: learning the primitives without the abstraction layer getting in the way, and debugging where you want full control over a single Pod. In production, every workload should be managed by a controller, a Deployment, a StatefulSet, a DaemonSet. Controllers handle recreation, rolling updates, and self-healing automatically. A bare Pod has none of those guarantees. Once you understand Pods well enough to feel their limitations, you are ready for Deployments.
:::

This lesson closes out the Pods module. You have now seen how Pods are created, what phases they move through, how restart policies control their recovery, and why editing them in place is not possible for most fields. The next module goes deeper into `kubectl` itself, covering the full set of patterns for reading, modifying, and cleaning up any kind of Kubernetes resource.
