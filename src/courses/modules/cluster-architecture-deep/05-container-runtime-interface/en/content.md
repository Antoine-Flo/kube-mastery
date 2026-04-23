---
seoTitle: 'Container Runtime Interface, CRI, containerd, runc, Pause Container'
seoDescription: 'Understand how the CRI decouples Kubernetes from container runtimes, what the pause container does, and how containerd, shims, and runc work together to start a Pod.'
---

# Container Runtime Interface

The kubelet knows what containers to start. It has the Pod spec, the image names, the resource limits. But it does not know how to pull an image from a registry, create Linux namespaces, or manage cgroups. That knowledge belongs to the container runtime. The Container Runtime Interface is the contract that connects the two.

```bash
kubectl get nodes -o yaml
```

Find the `status.nodeInfo.containerRuntimeVersion` field. It shows something like `containerd://1.7.x`. That version string tells you which runtime is running on the node and which version the kubelet negotiated with at startup.

## Why CRI exists

Before CRI was introduced in 2016, the kubelet contained direct integration code for Docker. Any team wanting to use a different runtime had to modify the kubelet itself. CRI replaced that tight coupling with a standard gRPC interface. Any runtime that implements the CRI spec can plug in without touching the kubelet.

@@@
graph LR
KL["kubelet"]
CRI["CRI gRPC interface"]
RT["Container runtime\n(containerd / CRI-O)"]
SHIM["containerd-shim"]
RUNC["runc\n(OCI runtime)"]
KL --> CRI --> RT --> SHIM --> RUNC
@@@

The CRI defines two services: `RuntimeService` for managing Pods and containers (create, start, stop, remove, exec), and `ImageService` for managing images (pull, list, remove). The kubelet calls these services over a Unix socket, typically at `/run/containerd/containerd.sock`.

## The pause container and network namespaces

A Pod can hold multiple containers that all share the same network. For two processes to share a network namespace, one of them has to create it first and the other has to join it. If application containers created their own namespaces, they would have to coordinate in complex ways. Kubernetes avoids this with a dedicated infrastructure container called the pause container.

When the kubelet asks the runtime to create a Pod, the runtime starts the pause container first. The pause container does nothing except hold the network namespace open. Every application container in the Pod then joins that namespace. If an application container crashes and restarts, it rejoins the pause container's namespace. The network identity, the IP address and the port bindings, never changes.

:::quiz
An nginx container in a Pod crashes and is restarted by the kubelet. Does the Pod's IP address change?

**Answer:** No. The pause container is still running and still holds the network namespace. The restarted nginx container rejoins the existing namespace. The IP address is stable for the lifetime of the Pod, not the lifetime of any individual container inside it.
:::

## From kubelet call to running container

Trace the full sequence of a single container start:

1. The kubelet calls `RuntimeService.RunPodSandbox` to create the Pod sandbox (the pause container and its namespace).
2. The CNI plugin assigns an IP to the sandbox's network interface.
3. The kubelet calls `ImageService.PullImage` for each container image that is not yet on the node.
4. The kubelet calls `RuntimeService.CreateContainer` for each application container, attaching it to the sandbox.
5. The kubelet calls `RuntimeService.StartContainer`.
6. `containerd-shim` forks `runc`, which reads the OCI bundle (the container filesystem + config) and executes the process.
7. `runc` exits. The shim remains running as the container's parent process, keeping the container alive and collecting its exit code.

```bash
kubectl get pods
```

The transition from `ContainerCreating` to `Running` corresponds to steps 1 through 6 completing. If the Pod stays in `ContainerCreating`, one of those steps failed, most often an image pull error or a missing volume mount.

:::warning
A Pod stuck in `ContainerCreating` will show the failure reason in Events, not in the STATUS column. `kubectl describe pod <name>` and read the Events section. Common causes are `ImagePullBackOff` (image name is wrong or registry credentials are missing), `MountVolume.SetUp failed` (a PersistentVolumeClaim is not bound), and `Failed to create pod sandbox` (a CNI configuration problem).
:::

## The shim and why it matters for upgrades

The `containerd-shim` process sits between containerd and the running container. It keeps the container alive even if containerd itself restarts. This architecture is what makes it safe to restart the container runtime without killing all running containers, which is a requirement for live upgrades.

:::quiz
You upgrade containerd on a worker node without draining it first. What happens to the containers already running on that node?

**Answer:** They continue running. Each container is managed by its own `containerd-shim` process, which survives the containerd restart. The containers are only affected if the shim itself is killed, which does not happen during a normal containerd upgrade. This is why containerd upgrades are generally safe to perform on live nodes.
:::

```bash
kubectl describe node sim-worker
```

Look at the `Addresses`, `Capacity`, and `Allocatable` fields. The difference between `Capacity` and `Allocatable` represents resources reserved for system processes, including the runtime itself. The scheduler only considers `Allocatable` when filtering nodes, which is why a node's schedulable capacity is always slightly less than its raw hardware capacity.

The CRI turns a general-purpose Linux system into a Kubernetes node. Every container that runs in the cluster passed through this interface, from the first `RunPodSandbox` call to the final `RemoveContainer` when the Pod is deleted.
