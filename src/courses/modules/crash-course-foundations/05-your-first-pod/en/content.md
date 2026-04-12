---
seoTitle: 'Your First Kubernetes Pod, Create, Inspect, Exec, Lifecycle Phases'
seoDescription: 'Create your first Kubernetes Pod from a manifest, understand its lifecycle phases, exec into it, and learn why bare Pods are the foundation of all workloads.'
---

# Your First Pod

A Pod is the smallest deployable unit in Kubernetes. Not a container, a Pod. You do not tell Kubernetes to run a container directly. You tell it to run a Pod, and the Pod runs one or more containers together on the same node, sharing the same network and the same lifecycle.

Think of a Pod as a logical host. Just as a process on a Linux machine can communicate with other processes on the same machine through localhost, containers in the same Pod share a network namespace and can reach each other on `127.0.0.1`. They also share mounted volumes. From the containers' perspective, they are co-located, even though they are processes in a shared kernel.

@@@
flowchart TB
subgraph Pod["Pod (one schedulable unit)"]
direction TB
C["Container(s)<br/>each has name + image"]
N["Shared network namespace<br/>one Pod IP, localhost between containers"]
V["Shared volumes<br/>optional"]
end
C --> N
C -.-> V
@@@

## Writing the Manifest

Pod manifests are built from four required top-level fields. Start with the most basic structure:

```yaml
# illustrative only
apiVersion: v1
kind: Pod
```

`apiVersion: v1` means this resource type exists in the core Kubernetes API. `kind: Pod` is the resource type.

@@@
flowchart TB
Root["Pod manifest (YAML)"]
Root --> AV["apiVersion"]
Root --> K["kind"]
Root --> MD["metadata<br/>(name, labels, ...)"]
Root --> SP["spec<br/>(containers, ports, volumes, ...)"]
@@@

Add `metadata` with a name:

```yaml
# illustrative only
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
```

Add `spec.containers` with one container:

```yaml
# illustrative only
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
    - name: web
      image: nginx:1.28
```

Every container needs a `name` (used for logging and exec targeting) and an `image`. Here the image is `nginx:1.28`, a stable web server you can always rely on for practice.

Here is the complete manifest. Create the file:

```bash
nano my-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  labels:
    app: web
spec:
  containers:
    - name: web
      image: nginx:1.28
      ports:
        - containerPort: 80
```

Apply it:

```bash
kubectl apply -f my-pod.yaml
```

## Observing the Lifecycle

Pods move through a sequence of phases as they start up. List your Pod and watch the phase change:

```bash
kubectl get pod my-pod --watch
```

Press Ctrl+C once it reaches `Running`. The phases you might see are:

`Pending` means the Pod has been accepted by the API server but its containers have not started yet. The scheduler is assigning a node and the kubelet is pulling the image.

`Running` means at least one container is running. The container processes are alive.

`Succeeded` and `Failed` appear when all containers have exited, with zero or non-zero exit codes respectively.

`Unknown` means the node the Pod was on stopped reporting to the control plane.

@@@
stateDiagram-v2
[*] --> Pending: accepted by API server
Pending --> Running: scheduled, at least one container starts
Pending --> Failed: cannot be scheduled (terminal)
Running --> Succeeded: all containers exit with code 0
Running --> Failed: fatal container exit (no more restarts)
Running --> Unknown: node stops reporting
Unknown --> Running: node visible again (sometimes)
Succeeded --> [*]
Failed --> [*]
@@@

:::quiz
A Pod is in `Pending` state for 3 minutes. Its image is `nginx:1.28`. What are the two most likely causes?

**Try it:** `kubectl describe pod my-pod`

**Answer:** Look at the Events section. The most common causes are: no node has enough CPU or memory to schedule the Pod (you will see a scheduler message), or the image cannot be pulled (you will see an `ErrImagePull` or `ImagePullBackOff` event). Both are readable from `describe`.
:::

## Inspecting the Running Pod

The same Pod object in the API can be viewed at different levels of detail:

@@@
flowchart LR
Obj["Pod in API / etcd"]
Obj --> G["kubectl get pod"]
Obj --> W["kubectl get pod -o wide<br/>adds node + Pod IP"]
Obj --> Y["kubectl get pod -o yaml<br/>full object + status"]
Obj --> D["kubectl describe pod<br/>events + readable summary"]
@@@

Get a summary of the Pod's current state:

```bash
kubectl get pod my-pod -o wide
```

The `-o wide` flag adds the node name and Pod IP. Note the IP address, it is unique within the cluster network and routable from other Pods.

Get the full Pod object as YAML, including all the fields Kubernetes populated at runtime:

```bash
kubectl get pod my-pod -o yaml
```

Notice the `status` field in the output. Kubernetes fills this in as the Pod progresses. It contains the phase, conditions, container states, and the Pod IP.

Describe the Pod to see its event history:

```bash
kubectl describe pod my-pod
```

## Executing Commands Inside a Pod

Once the Pod is running, you can open a shell inside the container:

```bash
kubectl exec -it my-pod -- /bin/sh
```

The `-it` flags allocate an interactive terminal. The `--` separates kubectl flags from the command you are running inside the container. From inside, you can explore the filesystem, check the network, or run diagnostics.

@@@
flowchart LR
You["Your terminal"] --> K["kubectl exec"]
K --> API["API Server"]
API --> KL["Kubelet on the node"]
KL --> CTR["Container process<br/>(e.g. /bin/sh)"]
@@@

Exit the shell:

```bash
exit
```

If a Pod has multiple containers, specify which one with `-c`:

```bash
kubectl exec -it my-pod -c web -- /bin/sh
```

:::warning
`kubectl exec` is a diagnostic tool, not a way to make changes to a running application. Any file you write inside a container's filesystem is lost when the container restarts. Configuration changes made via exec are invisible to Kubernetes and will be overwritten on the next deploy. Use exec to look, not to change.
:::

## Reading Logs

Fetch the container's stdout and stderr:

```bash
kubectl logs my-pod
```

Follow logs in real time with `-f`:

```bash
kubectl logs my-pod -f
```

Press Ctrl+C to stop following. For Pods with multiple containers, use `-c` to specify which container's logs you want:

```bash
kubectl logs my-pod -c web
```

## Deleting the Pod

```bash
kubectl delete pod my-pod
```

The Pod is gone. There is no controller watching it, so nothing recreates it. This is the fundamental limitation of bare Pods: they are not self-healing. If the node fails or the Pod is accidentally deleted, it stays deleted.

@@@
flowchart LR
Del["kubectl delete pod"] --> Gone["Pod removed"]
Gone -->|no controller| Stay["Stays deleted"]
subgraph Later["Later: Workloads module"]
Dep["Deployment"] --> RS["ReplicaSet"]
RS --> Pods["Pods replaced if deleted"]
end
@@@

In production, you almost never create bare Pods. You create Deployments, which manage Pods for you. But every Deployment's Pod follows the exact same lifecycle you just observed: the same manifest fields, the same phases, the same exec and logs commands. Understanding a bare Pod means understanding every workload on top of it.

You have now created, inspected, exec'd into, read logs from, and deleted a Pod. These five operations cover the majority of day-to-day diagnostic work on a running cluster. The Foundations module ends here. In the Workloads module, you will build on this base and create Deployments that manage Pods automatically.
