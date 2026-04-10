---
seoTitle: 'Kubernetes Cluster Architecture, Control Plane, Worker Nodes'
seoDescription: 'Learn how a Kubernetes cluster is structured, with control plane components managing state and worker nodes running application containers.'
---

# Cluster Architecture Overview

Before understanding how a Kubernetes cluster is organized, you need to know what it actually runs. Every application in Kubernetes runs inside containers. But Kubernetes never schedules containers directly. It schedules **Pods**. And those Pods land on **Nodes**.

## Nodes: The Machines in Your Cluster

A **Node** is a machine where Pods run. That machine can be a physical server in a data center, a virtual machine in the cloud, or even a container on your laptop (which is exactly how tools like `kind` work internally). Kubernetes does not care about the physical form. It treats every node the same way: a place with CPU, memory, and a container runtime.

`kubectl get nodes`

Each entry shows a name, a status, and the Kubernetes version running on it. A node in `Ready` status means its local agent is healthy and the control plane can reach it.

:::quiz
What physical form can a Kubernetes Node take?

- Only physical servers in a data center
- A physical server, a virtual machine, or even a container on a laptop
- Only virtual machines in a cloud provider

**Answer:** A physical server, a virtual machine, or even a container. Kubernetes abstracts the underlying hardware and treats every node identically as long as it provides CPU, memory, and a container runtime.
:::

## Pods: The Real Unit of Deployment

@@@
graph TB
    subgraph pod ["Pod"]
        IP["Unique IP — e.g. 10.0.0.5"]
        subgraph containers
            C1["app container"]
            C2["sidecar container"]
        end
        VOL[("Shared Volume")]
        IP --> C1
        IP --> C2
        C1 --> VOL
        C2 --> VOL
    end
@@@

You might expect Kubernetes to schedule containers directly. It does not. The smallest unit Kubernetes can schedule is a **Pod**.

A Pod is a thin wrapper around one or more containers. Think of it as an isolated runtime envelope: everything inside shares the same network identity and can share storage volumes. Two containers in the same Pod communicate over `localhost` as if they were processes on the same machine. They share the same lifecycle: if the Pod is deleted, all its containers stop together.

Why does Kubernetes use Pods instead of raw containers? Because many real-world applications need two processes running side by side, a web server and a logging agent, for example. Grouping them in a Pod means Kubernetes schedules them as one atomic unit onto the same node, with no networking complexity between them. Each Pod gets a unique IP address inside the cluster.





:::quiz
Why does Kubernetes schedule Pods instead of containers directly?

**Answer:** Pods allow Kubernetes to group tightly coupled containers as a single schedulable unit. Containers inside a Pod share a network namespace and volumes, so they communicate over localhost without any extra configuration. Scheduling them together guarantees they always land on the same node.
:::

## The Two Cluster Roles

You have a fleet of Nodes and you know that Pods run on them. Who decides which Pod goes on which Node? Who notices when a Node goes offline and reschedules its Pods? That responsibility cannot be spread evenly across every machine. Kubernetes enforces a strict separation between the parts that make decisions and the parts that carry them out: the **control plane** and the **worker nodes**.

@@@
graph TB
    subgraph cp [Control Plane]
        API["kube-apiserver"]
        ETCD["etcd"]
        SCHED["kube-scheduler"]
        CM["kube-controller-manager"]
    end
    subgraph n1 [Worker Node 1]
        K1["kubelet"]
        KP1["kube-proxy"]
        P1["Pod A"]
        P2["Pod B"]
    end
    subgraph n2 [Worker Node 2]
        K2["kubelet"]
        KP2["kube-proxy"]
        P3["Pod C"]
    end
    API --> K1
    API --> K2
@@@

## The Control Plane

The control plane is the decision-making side of the cluster. It stores the desired state of everything, decides where each Pod runs, and continuously watches whether reality matches what you declared. It does not run your application containers. Its job is management, not execution.

`kubectl cluster-info`

This shows the address of the Kubernetes API server, the single entry point all cluster communication flows through. The next lesson opens the control plane and examines each of its four components individually.

## Worker Nodes

Worker nodes are where your Pods actually run. The control plane makes the decisions; the worker nodes carry them out. Each node runs a local agent that receives Pod assignments from the control plane and starts the corresponding containers.

`kubectl get nodes`

:::quiz
How many nodes does this cluster have?

**Try it:** `kubectl get nodes`

**Answer:** Two nodes. One shows the role `control-plane`, the other has no role label by default, which is normal for worker nodes. The `STATUS` column should show `Ready` for both, meaning the local agent on each node is healthy and connected to the control plane.
:::

## Production Differences

The simulated cluster has one control plane node and one worker node. Real production clusters look different in both directions.

:::info
In production, the control plane is typically replicated across three nodes to survive hardware failures. A cluster of any meaningful size also has many more worker nodes, sometimes dozens or hundreds, depending on workload demands.
:::

:::warning
Do not schedule application workloads on the control plane node in production. Kubernetes applies a **taint** to control plane nodes that prevents normal Pods from being scheduled there. Running application containers on the control plane risks destabilizing the components that manage the entire cluster. In this simulator, the taint is in place and matches production behavior.
:::

Nodes and Pods form the physical and logical foundation of every cluster. The control plane and worker node separation determines how decisions and execution stay cleanly apart. The next lesson goes one level deeper, examining the individual components inside the control plane and what each one is specifically responsible for.
