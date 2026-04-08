---
seoTitle: 'Why Kubernetes, Container Orchestration, Scheduling, Self-Healing'
seoDescription: 'Understand why Kubernetes exists, what problems it solves, and the core capabilities it provides for running containerized workloads at scale.'
---

# Why Kubernetes?

It is 3am. Your web server container crashed on one of your six machines. Another machine is out of memory. A new version of your API is waiting to deploy, but you cannot afford downtime. You have 15 services spread across those machines, and the on-call engineer is you.

Managing containers manually at this scale is not a career, it is a series of incidents. Kubernetes exists to make this problem disappear.

> **In one line:** you declare the desired state, the cluster keeps reconciling reality until it matches.

| Without an orchestrator | With Kubernetes |
| --- | --- |
| You restart failed containers yourself | Controllers recreate Pods to match the desired replica count |
| You decide which machine runs each workload | The scheduler places Pods using capacity and policy |
| IPs and wiring break whenever things move | Services expose stable DNS names and cluster IPs |
| Rolling upgrades are a manual checklist | Deployments roll out with surge and availability rules |

Day to day, Kubernetes focuses on **placement** (enough CPU and memory on healthy nodes), **recovery** (replace unhealthy instances without a runbook step), and **rollouts** (ship new versions without taking the app down).

## Where Kubernetes came from

Kubernetes did not appear in a vacuum. It grew out of large-scale scheduling experience at Google, at a moment when containers were becoming the default packaging format.

@@@
flowchart TB
    Y1["2003: Borg at Google<br/>Internal cluster scheduler, ideas that shaped Kubernetes"]
    Y2["2013: Containers go mainstream<br/>Portable images, ops must work cluster-wide"]
    Y3["2014: Kubernetes open sourced<br/>Public project, vendors and community contribute"]
    Y4["2015: Kubernetes 1.0 and CNCF<br/>Stable API baseline, neutral Linux Foundation home"]
    Y5["2018: CNCF graduation<br/>Mature governance, broad ecosystem adoption"]
    Y1 --> Y2 --> Y3 --> Y4 --> Y5
@@@

:::info
**Borg is not Kubernetes.** Borg is an internal Google system. Kubernetes reused concepts (desired state, controllers, scheduling at scale), not Borg’s source code. You learn Kubernetes as it exists in the open source project.
:::

:::info
**2014 and 2015 together** mark the shift from experiment to platform: the code became public in 2014, then 1.0 and the Cloud Native Computing Foundation (CNCF) gave the project a stable API promise and a vendor-neutral foundation.
:::

:::info
**CNCF graduation** (2018) means the project met CNCF criteria for adoption, contributors, and governance. It is a milestone for the ecosystem, not a feature release. Releases still ship on a regular cadence today.
:::

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
