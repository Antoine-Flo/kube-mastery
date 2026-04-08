---
seoTitle: 'Kubernetes Cluster Architecture, Control Plane, Worker Nodes, Components'
seoDescription: 'Learn how a Kubernetes cluster is structured: the control plane components that make decisions and the worker nodes that run your workloads.'
---

# Cluster Architecture

You tell Kubernetes "I want three copies of this web server running." Seconds later, three containers are up across your machines. But between your instruction and that result, a chain of components had to read it, validate it, pick which machines to use, and actually start the containers. Understanding that chain means you can reason about failures, delays, and unexpected behavior instead of treating the cluster as a black box.

@@@
graph TB
    subgraph CP["Control Plane"]
        API["API Server"]
        ETCD["etcd"]
        SCH["Scheduler"]
        CCM["Controller Manager"]
    end

    subgraph N1["Worker Node 1"]
        KL1["kubelet"]
        KP1["kube-proxy"]
        C1["Pods"]
    end

    subgraph N2["Worker Node 2"]
        KL2["kubelet"]
        KP2["kube-proxy"]
        C2["Pods"]
    end

    API <--> ETCD
    API --> SCH
    API --> CCM
    KL1 --> API
    KL2 --> API
    KP1 --> API
    KP2 --> API
@@@

A Kubernetes cluster is a group of machines working together. Each machine in the cluster is called a **node**. A node can be a physical server in a data center, a virtual machine in a cloud provider, or even a container on your laptop. From Kubernetes' perspective, a node is just a machine with CPU, memory, and a network connection.

Kubernetes does not run containers on a node directly. Instead, it groups one or more containers into a **Pod**, the smallest unit it can schedule. Every container inside it shares the same network and the same lifecycle. It's the wrapper Kubernetes puts around your containers before placing them on a node.

:::quiz
Two containers need to share a file on disk without any network call. What is the minimum Kubernetes structure that makes this possible?

- Two Pods on the same node, since they share the node's filesystem
- One Pod containing both containers, since containers in the same Pod share volumes
- Two Pods connected by a Service, since Services route traffic between workloads

**Answer:** One Pod containing both containers. Containers in the same Pod share the same network namespace and can mount the same volumes, so a shared file is possible with a single volume declaration. Two separate Pods, even on the same node, have completely isolated filesystems and cannot share files directly.
:::

A cluster has two distinct roles: the **worker nodes** that host your Pods, and the **control plane**, a dedicated set of nodes that make all the decisions about the cluster.

## The Control Plane

The control plane is the brain of the cluster. In a production setup it runs on dedicated machines, separate from your workloads.

@@@
graph TB
    ETCD["etcd<br/>source of truth"]
    API["API Server"]
    SCH["Scheduler"]
    CCM["Controller Manager"]

    API -->|"write state"| ETCD
    ETCD -->|"read state"| API
    SCH -->|"watch & assign"| API
    CCM -->|"watch & reconcile"| API
@@@

**The API Server** (`kube-apiserver`) is the single entry point for everything. Every `kubectl` command, every controller update, every kubelet heartbeat goes through the API server. It validates requests, applies authorization, and persists accepted objects to etcd. Nothing in the cluster talks to anything else directly, every component talks to the API server.

**etcd** is the cluster's source of truth. It is a distributed key-value store that holds the entire cluster state: every object you have ever created, every status update, every label. If etcd is unavailable, the API server cannot persist state, and the cluster stops accepting changes. etcd does not run your workloads, it is a database.

**The Scheduler** watches for newly created Pods that have no assigned node. When it finds one, it evaluates every available node against the Pod's requirements: CPU requests, memory requests, node selectors, taints, and affinity rules. It picks the best fit and writes the node name into the Pod object. The scheduler does not start containers, it only makes the placement decision.

**The Controller Manager** runs a collection of control loops, one for each resource type that needs reconciliation. The Deployment controller watches Deployments and creates or scales ReplicaSets. The ReplicaSet controller watches ReplicaSets and creates or deletes Pods. Each controller continuously compares the desired state stored in etcd to the actual state it observes, and acts to close any gap.

:::quiz
Why does every cluster component talk to the API server instead of talking to each other directly?

**Answer:** The API server is the single source of truth. All reads and writes go through it, so every component sees the same consistent view of the cluster. Direct component-to-component communication would create inconsistency and make authorization impossible to enforce centrally.
:::

## Worker Nodes

Worker nodes are the machines that run your containers. Each node runs a small set of components that report to the control plane and execute its instructions.

@@@
graph LR
    API["API Server"]

    subgraph N1["Worker Node 1"]
        KL1["kubelet"] --> P1["Pod"] & P2["Pod"]
        KP1["kube-proxy"]
    end

    subgraph N2["Worker Node 2"]
        KL2["kubelet"] --> P3["Pod"]
        KP2["kube-proxy"]
    end

    KL1 <-->|"status / instructions"| API
    KL2 <-->|"status / instructions"| API
    KP1 & KP2 -->|"watch services"| API
@@@

**The kubelet** is the agent running on every worker node. It watches the API server for Pods that have been scheduled to its node, and it ensures those Pods are running. If a container inside a Pod crashes, the kubelet restarts it. It also reports node health and container status back to the API server, which is how the control plane knows whether workloads are healthy.

**kube-proxy** maintains network rules on the node. It enables Services to work by setting up the routing rules that forward traffic destined for a Service IP to one of its backing Pods. You never interact with kube-proxy directly, but every time you hit a Service, kube-proxy is what delivers your request.

**The container runtime** is the software that actually pulls images and starts containers. Kubernetes supports any runtime that implements the Container Runtime Interface (CRI). The most common is `containerd`. The kubelet tells the runtime what to run; the runtime handles the low-level details.

:::quiz
A Pod is scheduled but its containers never start. Which component is most likely failing?

- The API server, which cannot accept the Pod
- The scheduler, which cannot find a node
- The kubelet on the assigned node, which is not starting the containers

**Answer:** The kubelet. Once the scheduler has assigned a node, starting the containers is the kubelet's job. If the kubelet is crashing, disconnected, or the container runtime is broken, the Pod will be stuck in a pending or unknown state despite having a node assignment.
:::

## Seeing the Cluster

List your nodes:

```bash
kubectl get nodes
```

You should see one or more nodes with a `Ready` status. The `ROLES` column shows which nodes are part of the control plane and which are workers.

Now inspect a node in detail:

```bash
kubectl describe node <NODE-NAME>
```

The output has several sections worth knowing. `Conditions` shows whether the node is under memory pressure or disk pressure and whether it is ready to accept Pods. `Capacity` and `Allocatable` show total and available CPU and memory. `Non-terminated Pods` lists every Pod currently running on that node.

:::warning
If a node's condition shows `Ready: False` or `Ready: Unknown`, Pods on that node stop reporting status to the control plane. Kubernetes will eventually evict those Pods and reschedule them on healthy nodes, but this takes time. The cluster does not assume a node has failed until a timeout passes, to avoid unnecessary rescheduling during brief network hiccups.
:::

```bash
kubectl get nodes -o wide
```

The `-o wide` flag adds the node's internal IP address and the container runtime version. Both are useful when debugging scheduling or connectivity issues.

The control plane decides, the worker nodes execute. Every component communicates through the API server, which keeps etcd as the authoritative record of everything happening in the cluster. In the next lesson, you will use `kubectl` to navigate this state and inspect resources at every level.
