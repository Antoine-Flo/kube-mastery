---
seoTitle: 'Why Kubernetes, Container Orchestration, Scheduling, Self-Healing'
seoDescription: 'Understand why Kubernetes exists, what problems it solves, and the core capabilities it provides for running containerized workloads at scale.'
---

# Why Kubernetes?

It is 3am. Your web server container crashed on one of your six machines. Another machine is out of memory. A new version of your API is waiting to deploy, but you cannot afford downtime. You have 15 services spread across those machines, and the on-call engineer is you.

Managing containers manually at this scale is not a career, it is a series of incidents. Kubernetes exists to make this problem disappear.

## The Orchestration Problem

Containers are excellent at packaging and isolating applications. A single container on a single machine is easy to run. The challenge appears as soon as you have more than a handful of them.

Consider a typical web application: frontend, backend API, database, cache, background workers. Each service needs multiple copies for redundancy. Those copies need to land on machines with enough CPU and memory. They need to find each other on the network. When one crashes, something must restart it. When traffic spikes, something must spin up more instances. When you ship a new version, the old ones must come down in a controlled sequence that avoids downtime.

Doing all of that by hand requires constant attention, deep knowledge of which machine has what capacity, and near-perfect timing. It does not scale.

@@@
graph LR
    Problem["Manual ops:<br/>15 services, 6 nodes,<br/>crashes, deploys, scaling"]
    K8s["Kubernetes:<br/>schedules, heals,<br/>scales, routes"]
    You["You:<br/>declare desired state"]

    You -->|"kubectl apply -f app.yaml"| K8s
    K8s -->|"handles the rest"| Problem
@@@

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
