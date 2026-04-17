---
seoTitle: 'Container Security Linux Primitives Namespaces Capabilities'
seoDescription: 'Understand how Linux namespaces and capabilities shape container isolation, and why running as root inside a container is dangerous on the host.'
---

# Container Security: Linux Primitives

You deploy a container and it runs your application. But what does "a container" actually mean at the OS level? It is not a virtual machine. There is no separate kernel, no hypervisor, no hard memory boundary. A container is a Linux process, or a group of processes, isolated from the rest of the host by a set of kernel features. Understanding those features is what makes `securityContext` settings in Kubernetes meaningful rather than arbitrary checkbox ticking.

## Linux namespaces: the walls of the container

The first kernel feature is **namespaces**. A namespace wraps a global resource and makes it look private to a set of processes. When Docker or the container runtime creates a container, it places the container process inside several namespaces at once.

@@@
graph TB
  K["Host Linux Kernel"]
  K --> PID["PID namespace\n(process IDs)"]
  K --> NET["Net namespace\n(network interfaces, IPs)"]
  K --> MNT["Mount namespace\n(filesystem mounts)"]
  K --> UTS["UTS namespace\n(hostname)"]
  K --> IPC["IPC namespace\n(shared memory, semaphores)"]
  PID --> P["Container process\n(e.g. nginx)"]
  NET --> P
  MNT --> P
  UTS --> P
  IPC --> P
@@@

The PID namespace gives the container its own process table. Inside the container, your app runs as PID 1. On the host, it has a completely different PID. The network namespace gives the container its own network interfaces and IP address. The mount namespace gives it its own view of the filesystem. The container cannot see the host's mounts, the host's other processes, or the host's network interfaces, unless the runtime explicitly grants that access.

This is the structural answer to "what makes a container a container": a set of namespaces applied to an otherwise ordinary Linux process.

```bash
kubectl get pods -o wide
```

Run that command in the simulator. The `NODE` column shows which node each Pod was scheduled to. Every Pod on the same node shares that node's kernel. The namespaces are the only separation between them.

:::quiz
Why does a container see PID 1 as its own process, while the host kernel sees a completely different PID for the same process?

**Answer:** The container runs inside a PID namespace. Each namespace maintains its own mapping of process IDs. The process is the same, but the kernel presents a different identifier depending on which namespace you observe from. This is the illusion of isolation: the process exists once on the host, but appears isolated inside the namespace.
:::

## Linux capabilities: finer-grained than root

The second kernel feature is **capabilities**. Historically, Unix had two privilege levels: root and non-root. Either you had everything, or you had nothing. Linux capabilities broke "root" into about 40 distinct privileges. `CAP_NET_ADMIN` lets a process configure network interfaces. `CAP_CHOWN` lets it change file ownership. `CAP_SYS_TIME` lets it set the system clock.

@@@
graph LR
  FULL["Full root privileges\n(all capabilities)"]
  FULL --> SUBSET["Container default set\n(reduced capabilities)"]
  SUBSET --> C1["CAP_NET_RAW"]
  SUBSET --> C2["CAP_CHOWN"]
  SUBSET --> C3["CAP_SETUID"]
  SUBSET --> C4["... ~14 more"]
@@@

When a container runtime creates a container, it does not grant all capabilities, even if the container runs as root. It grants a reduced default set. Most applications need zero of the capabilities in that default set. A web server serving static files needs neither `CAP_CHOWN` nor `CAP_NET_RAW`. Yet those capabilities sit there, available to any code that runs inside the container.

Kubernetes `securityContext` lets you drop them. That is the direct connection between what you just read and what you will configure in the next lessons.

```bash
kubectl describe pod <pod-name>
```

Look at the `Containers` section of the describe output. A Pod deployed without any `securityContext` fields will show no capability overrides. A Pod with a hardened security context will list dropped or added capabilities explicitly. This is how you verify what was applied.

## Root inside a container is root on the host

Here is the part that surprises people. When a container runs as UID 0 (root), and the container runtime does not use user namespace remapping (most do not, by default), that UID 0 inside the container maps directly to UID 0 on the host.

The namespaces provide process and filesystem isolation. They do not remap user identities by default. If an attacker finds a vulnerability that lets them break out of the container's namespace, they arrive on the host as root.

:::warning
Running a container as root is not just an internal concern. A container escape with a root process gives the attacker full root access to the host node, to every other container on that node, and to the host's filesystem. This is not a theoretical risk. It is how real-world container escape exploits work.
:::

:::quiz
If a container runs as root (UID 0) and a container escape vulnerability exists, what can an attacker do on the host?

**Answer:** Anything root can do on the host. The container's UID 0 maps directly to the host's UID 0 without user namespace remapping. The attacker gains full control of the host node, including access to other containers running on that node and the ability to read or modify any file on the host filesystem. Running as non-root is the single most effective defense against this class of attack.
:::

The principle that emerges from these two kernel features is: containers should run as non-root wherever possible, and with the smallest capability set the application actually needs. Kubernetes gives you the tools to enforce both. Start by inspecting what your Pods are actually doing:

```bash
kubectl describe pod <pod-name>
```

The `Security Context` lines in the describe output reveal the runtime identity of every container. If those lines are absent or show no restrictions, the container is running with default settings, which means a reduced but non-zero capability set and potentially as root.

The next two lessons translate this kernel-level knowledge into concrete `securityContext` fields. You will see exactly which fields map to which behaviors, and you will apply them to running Pods in the simulator.
