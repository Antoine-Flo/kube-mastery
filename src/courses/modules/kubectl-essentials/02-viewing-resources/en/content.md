---
seoTitle: 'kubectl get and describe, View Kubernetes Resources'
seoDescription: 'Master kubectl get and describe to list and inspect Kubernetes resources, using flags like -o wide, --watch, -l for labels, and -n for namespaces.'
---

# Viewing Resources

You have Pods running in the simulator. You want to know their current status, which node they landed on, how long they have been up, and what happened since they were created. Two commands cover almost everything you need: `kubectl get` for the broad view, and `kubectl describe` for the detailed view. Knowing when to use each one will save you a lot of time when debugging.

Start by creating a Pod you can observe throughout this lesson:

```bash
nano demo-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: demo-pod
  labels:
    app: demo
spec:
  containers:
    - name: web
      image: nginx:1.28
```

```bash
kubectl apply -f demo-pod.yaml
```

## `kubectl get`: the wide-angle lens

`kubectl get` lists resources in a tabular format. It is your first stop for any question that starts with "what is the current state of...".

```bash
kubectl get pods
```

The output shows each Pod's name, the number of ready containers over total containers, the status, the restart count, and the age. This fits on one line per Pod, which makes it easy to scan dozens of resources at once.

Add `-o wide` to get the node name and the Pod IP address:

```bash
kubectl get pods -o wide
```

If you want to watch resources update in real time without re-running the command, use `--watch`. Kubernetes streams changes as they happen. Press Ctrl+C to stop.

```bash
kubectl get pods --watch
```

You already know about labels from the previous module. You can filter the list by label to focus on a subset:

```bash
kubectl get pods -l app=demo
```

Try listing more than just Pods. `kubectl get all` shows Pods, Services, Deployments, and ReplicaSets in one pass:

```bash
kubectl get all
```

:::warning
Despite the name, `kubectl get all` does not show everything. ConfigMaps, Secrets, PersistentVolumes, ServiceAccounts, and many other resource types are excluded. To list a specific type you do not see, use `kubectl get <resource-type>` explicitly. If you are unsure what types exist, `kubectl api-resources` gives you the full list.
:::

:::quiz
You want to list all Pods that have the label `app=demo`. You have already seen the flag to use. Which command is correct?

- `kubectl get pods --label=app=demo`
- `kubectl get pods -l app=demo`
- `kubectl get pods --filter app=demo`
  **Answer:** `-l app=demo` is the correct flag. `-l` (short for `--selector`) filters resources by label selector. The other two options are not valid kubectl flags.
  :::

## `kubectl describe`: the magnifying glass

`kubectl get` tells you something is wrong. `kubectl describe` tells you why.

@@@
graph TD
GET["kubectl get pods\nTabular view\nAll resources at once\nCurrent status at a glance"]
DESC["kubectl describe pod NAME\nDetailed view\nOne resource at a time\nEvents + conditions + full spec"]
GET -->|"something looks wrong"| DESC
@@@

`kubectl describe pod` returns a full breakdown of the object: its labels and annotations, the node it was scheduled on, the container specs, the current conditions, and most importantly, the Events section at the bottom.

```bash
kubectl describe pod demo-pod
```

Spend a moment reading the output. The Events section is a chronological timeline of everything that happened to this Pod: when the scheduler assigned it to a node, when the kubelet pulled the image, when the container was created and started. If anything went wrong during startup, that failure appears here, often before the STATUS column in `kubectl get` even reflects the problem.

:::quiz
How many restarts has `demo-pod` had since it started?
**Try it:** `kubectl get pod demo-pod`
**Answer:** Look at the RESTARTS column. A value of 0 means the container has never crashed. A higher value indicates the container restarted at least once, which is often the first sign of a `CrashLoopBackOff`.
:::

## Choosing between `get` and `describe`

The two commands complement each other. Use `kubectl get` when you want a snapshot of many resources at once and need to find which one needs attention. Once you have identified the problematic resource, switch to `kubectl describe` to dig into its full history and conditions.

A typical debugging session starts with `kubectl get pods` to find a Pod in an unexpected state, then `kubectl describe pod <name>` to read the Events and understand what Kubernetes tried to do and where it stopped.

:::quiz
Why does `kubectl describe` show Events while `kubectl get -o yaml` does not?
**Answer:** Events are separate Kubernetes objects stored in etcd with a reference back to the resource they describe. `kubectl describe` makes an additional API call to fetch all Events related to the target object and includes them in its output. `kubectl get -o yaml` returns only the object itself, not the objects that reference it. Events are effectively a separate log, not embedded in the resource spec or status.
:::

Clean up before the next lesson:

```bash
kubectl delete pod demo-pod
```

Now that you can observe the state of your resources, the next step is to look inside them. The next lesson covers `kubectl logs` and `kubectl exec`, the two tools for reading what is actually happening inside a running container.
