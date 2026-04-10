---
seoTitle: 'Why Kubernetes, Container Orchestration, Scheduling, Self-Healing'
seoDescription: 'Understand why Kubernetes exists, what problems it solves, and the core capabilities it provides for running containerized workloads at scale.'
---

# Why Kubernetes?

## Before We Begin

Welcome. Your cluster is ready and waiting. Let's make sure you can talk to it before anything else:

In the terminal, run:
```bash
kubectl get nodes
```

You should see one control plane node and two worker nodes, all in `Ready` status. The control plane is the brain of the cluster, it makes decisions. The worker nodes are where your application containers will actually run. If you see `Ready` on all three, everything is working.

```bash
kubectl cluster-info
```

This shows the address of the API server, the single entry point through which all cluster communication flows. Every command you run goes through it.

Now that you can see your cluster, let's talk about why it exists in the first place.

## The Problem Kubernetes Solves

Managing containers manually at scale is a series of incidents: crashed containers nobody noticed, machines running out of memory at 3am, deploys that required careful timing to avoid downtime. Kubernetes exists to make that operational work disappear.

> **In one line:** you declare the desired state, the cluster keeps reconciling reality until it matches.

| Without an orchestrator | With Kubernetes |
| --- | --- |
| You restart failed containers yourself | Controllers recreate Pods to match the desired replica count |
| You decide which machine runs each workload | The scheduler places Pods using capacity and policy |
| IPs and wiring break whenever things move | Services expose stable DNS names and cluster IPs |
| Rolling upgrades are a manual checklist | Deployments roll out with surge and availability rules |

## The Orchestration Problem

Containers are excellent at packaging and isolating applications. A single container on a single machine is easy to run. The challenge appears as soon as you have more than a handful of them.

Consider a typical web application: frontend, backend API, database, cache, background workers. Each service needs multiple copies for redundancy. Those copies need to land on machines with enough CPU and memory. They need to find each other on the network. When one crashes, something must restart it. When traffic spikes, something must spin up more instances. When you ship a new version, the old ones must come down in a controlled sequence that avoids downtime.

Doing all of that by hand requires constant attention, deep knowledge of which machine has what capacity, and near-perfect timing. It does not scale.

Kubernetes replaces manual container management with a control loop: you describe what you want, and the cluster continuously works to make reality match your description.

:::quiz
You have three replicas of a web server running. One container crashes. What does Kubernetes do without any human intervention?

**Answer:** The controller detects that the actual count (2) no longer matches the desired count (3) and creates a replacement container automatically. You never need to notice the crash.
:::

## What Kubernetes Actually Does

Kubernetes is a **container orchestrator**. Given a fleet of machines and a set of container workloads, it handles the operational work that would otherwise fall on you.

**Scheduling** places each container on a node that has enough CPU and memory for it. You do not pick the machine, Kubernetes picks it based on resource requests and node capacity.

**Self-healing** watches your workloads continuously. If a container exits unexpectedly, it is restarted. If a node fails, its workloads are rescheduled elsewhere. You declare the desired count; the cluster maintains it.

**Scaling** adjusts the number of running containers up or down, either manually with a single command or automatically based on metrics like CPU utilization.

**Rolling updates** let you ship a new container image version without downtime. Kubernetes replaces old instances gradually, keeping a minimum number of healthy replicas available throughout the transition.

**Service discovery** gives every group of Pods a stable DNS name and a virtual IP. Containers find each other by name, not by IP address, so the network stays coherent even as Pods come and go.

:::quiz
A container crashes. Which outcome does Kubernetes guarantee?

- You get paged and restart it manually
- A replacement container starts within seconds, automatically
- You receive an alert and decide whether to restart it

**Answer:** The second option. Kubernetes detects the failure and acts on it immediately, without waiting for human input. The other two still require a person to make a decision.
:::

## What Kubernetes Does Not Do

Kubernetes is sometimes described as a Platform-as-a-Service. It is not. It is a lower-level foundation on which platforms are built.

Kubernetes does not build your container images. That is the job of Docker, Buildah, or a CI pipeline. You bring images; Kubernetes runs them.

It does not handle application-level observability by default. Logs are accessible per container, but a full pipeline with storage, search, and dashboards requires additional tools.

It does not make your application cloud-native. If your app crashes when its database is unavailable, Kubernetes will keep restarting it until the database comes back, but it will not fix the application's error handling.

:::warning
A common mistake is expecting Kubernetes to solve problems that belong to the application layer: retry logic, graceful shutdown, secret rotation, or multi-region failover. These require changes to the application itself or dedicated tooling. Kubernetes is the foundation, not the entire building.
:::

## Your First Contact

Check that your cluster is reachable and see what the control plane exposes:

```bash
kubectl cluster-info
```

You should see the API server address. Now list every resource type Kubernetes knows about:

```bash
kubectl api-resources
```

Each row is a kind of object you can create, inspect, or delete. Pods, Deployments, Services, ConfigMaps, each corresponds to a concept you will meet in the lessons ahead. You do not need to memorize this list. Run it whenever you want to discover what is available.

Kubernetes automates the hardest parts of running containers at scale: scheduling, self-healing, rolling updates, and service discovery. In the next lesson, you will look inside the cluster to understand the components that make all of this work.
