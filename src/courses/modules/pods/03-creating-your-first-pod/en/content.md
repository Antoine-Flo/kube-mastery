---
seoTitle: 'Create a Kubernetes Pod, kubectl apply, get, describe'
seoDescription: 'Learn how to create your first Kubernetes Pod using kubectl apply, monitor its status with kubectl get and describe, and understand what each field means.'
---

# Creating Your First Pod

You have seen the structure of a Pod manifest, field by field. Now it is time to write one, apply it to the simulated cluster, and watch what actually happens. The simulator behaves like a real cluster: the Pod gets scheduled, the image gets pulled, and the container starts. Each of those steps is visible if you know where to look.

## Writing the manifest

Open a new file in the virtual filesystem:

```bash
nano first-pod.yaml
```

Write the following manifest:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: first-pod
spec:
  containers:
    - name: web
      image: nginx:1.28
      ports:
        - containerPort: 80
      resources:
        requests:
          cpu: '100m'
          memory: '64Mi'
        limits:
          cpu: '200m'
          memory: '128Mi'
```

This is a complete, valid Pod manifest. Every field here is something you already know: `name` identifies the Pod in the cluster, `image` picks the container image, `containerPort` documents the port, and `resources` tells the scheduler what to reserve. Save the file and exit nano.

## Applying the manifest


```bash
kubectl apply -f first-pod.yaml
```

The simulator will respond with:

```
pod/first-pod created
```

That single line confirms that the API server accepted the manifest, stored it, and handed it off to the scheduler. The Pod does not necessarily run at this exact moment. The scheduler still has to pick a node, and the node still has to pull the image.

## Checking Pod status

```bash
kubectl get pod first-pod
```

You will see output with five columns: `NAME`, `READY`, `STATUS`, `RESTARTS`, and `AGE`. The `READY` column shows `running containers / total containers`. For a single-container Pod, it will show `0/1` briefly while the container starts, then `1/1` when it is up. The `STATUS` column moves through `Pending`, then `ContainerCreating`, and finally `Running`. If you run the command fast enough, you might catch one of the intermediate states.

To see more detail, add the `-o wide` flag:

```bash
kubectl get pod first-pod -o wide
```

This adds two useful columns: `NODE`, which tells you which worker node in the simulated cluster accepted the Pod, and `IP`, which is the internal IP address assigned to the Pod within the cluster network. That IP is reachable from inside the cluster but not from outside.

:::quiz
What node is `first-pod` running on, and what is its cluster IP?

**Try it:** `kubectl get pod first-pod -o wide`

**Answer:** The `NODE` column shows the worker node the scheduler chose. In the simulator there is a single worker node, so the answer is always that node. The `IP` column shows the Pod's internal address, assigned from the cluster's Pod CIDR range. This IP is only reachable from within the cluster network.
:::

## Reading the full picture with describe

`kubectl get` gives you a summary. `kubectl describe` gives you the full story:

```bash
kubectl describe pod first-pod
```

The output is long, but three sections matter most. The `Containers` section lists each container with its image, state, ports, and resource reservations. The `Conditions` section shows boolean flags like `PodScheduled`, `Initialized`, and `Ready`, each reflecting a phase the Pod passed through. The `Events` section at the bottom is the most useful for understanding what happened and in what order: you will see `Scheduled`, then `Pulling image`, then `Pulled`, then `Created`, then `Started`. That trace is also the first place to look when something goes wrong.

## When things go wrong

:::warning
If the image name has a typo or the tag does not exist, the Pod will get stuck in `ErrImagePull` and then switch to `ImagePullBackOff`. Kubernetes tries to pull the image, fails, waits, and retries with an exponentially increasing delay. The `kubectl describe` Events section will show a line like "Failed to pull image: ... not found". The fix is to delete the Pod and recreate it with the correct image name. You cannot change the image of a running Pod in place, that limitation is covered in lesson 06.
:::

To see this in action, you can try creating a Pod with a made-up image name and observe how the simulator reports the failure in `kubectl describe`.

:::quiz
If you delete `first-pod` and recreate it from the exact same manifest, is the new Pod the same as the old one?

**Answer:** No. The name is the same, the spec is the same, but Kubernetes creates a brand-new object with a new UID. The old Pod and the new Pod have no relationship. This is the ephemeral nature of Pods you saw in lesson 01: controllers work by replacing dead Pods with new ones, not by reviving old objects.
:::

## Cleaning up

```bash
kubectl delete pod first-pod
```

The Pod is removed from the simulated cluster. Because you created it directly (without a controller), nothing will bring it back.

You can now create, inspect, and delete a Pod with confidence. The next lesson digs into what happens after a Pod starts: the lifecycle phases it moves through, and what each phase means for your application.
