# Why Kubernetes?

Running a single containerized application is manageable. You write a Dockerfile, build an image, and start a container on a server. But most real systems are not a single application: they're a collection of services that need to run together, stay available under load, recover from failures, and be updated without taking the whole thing down. Once you reach that point, you're no longer fighting the problem of running containers - you're fighting the problem of orchestrating them. That's exactly what Kubernetes is built for.

:::info
**Kubernetes** is an open-source container orchestration platform. It automates the deployment, scaling, self-healing, and management of containerized applications across a cluster of machines.
:::

## The Problem at Scale

Imagine you're running a small e-commerce platform with five microservices: a frontend, a product catalog, a cart service, an order processor, and a database. Each service runs as a container. On a single machine, this is fine. But as traffic grows, you add more servers and start running multiple copies of each service across them.

Now the questions multiply. Which copies are actually running right now? If one crashes at 2 AM, who restarts it? When you deploy a new version of the frontend, how do you replace the old containers gradually so users don't see downtime? How does the cart service know the current network address of the order processor, when that address changes every time a container is replaced? How do you prevent one runaway service from consuming all the CPU on a shared machine and starving its neighbors?

None of these problems are unsolvable on their own, but solving all of them together, reliably, continuously, across tens of machines, without waking up your team every night - that's the problem that containerized infrastructure runs into at scale. Kubernetes is the answer the industry converged on.

## What Kubernetes Actually Does

At its core, Kubernetes is a system that continuously compares what you want with what's actually running, and then works to close any gap between the two. You express your desired state - "I want three copies of this service running, using this image, with these environment variables" - and Kubernetes takes responsibility for making it true and keeping it true.

This means that if a container crashes, Kubernetes restarts it. If a node goes offline, Kubernetes reschedules its Pods onto the remaining healthy nodes. If you push a new image, Kubernetes replaces the old containers gradually, waiting for each new one to be ready before moving on. You don't supervise any of this. You declare the outcome you want, and Kubernetes loops forever trying to achieve it.

This continuous loop of observation and correction is called **reconciliation**, and it's the mental model that unlocks how Kubernetes works. The system never "finishes." It just keeps reconciling actual state against desired state, every few seconds, for the lifetime of the cluster.

## Beyond Self-Healing

Self-healing is the most visible benefit, but Kubernetes provides several other capabilities that become essential as a system grows. The scheduler knows how much CPU and memory each container needs, and it places containers on nodes that have enough capacity available - automatically, across the whole cluster. Services get stable DNS names and IP addresses, so one part of your system can always reach another by name, even as the underlying Pods are constantly replaced. Storage can be provisioned and attached to containers on demand. Configuration and secrets can be injected at runtime without rebuilding images.

Taken together, these features mean that the infrastructure you run today can handle tomorrow's load without rewriting how you operate it.

## Hands-On Practice

Let's explore what a running cluster looks like before writing a single manifest.

**1. Confirm that `kubectl` can reach the cluster:**

```bash
kubectl cluster-info
```

This command queries the API server and prints its address alongside the address of CoreDNS, the cluster's internal DNS service. If you see output instead of an error, your connection is working.

**2. List the nodes that make up the cluster:**

```bash
kubectl get nodes
```

Every row is a machine - real or virtual - that can run your workloads. The `STATUS` column should show `Ready` for each node. A node that shows `NotReady` cannot schedule new Pods, and its existing Pods will eventually be evicted and rescheduled elsewhere.

**3. Explore the system namespace:**

```bash
kubectl get pods -n kube-system
```

This is where Kubernetes runs its own internal components as Pods. You'll see CoreDNS, kube-proxy, and potentially others depending on the cluster. Everything you'll learn about Pods in this course applies equally to these system Pods.

**4. See all namespaces in the cluster:**

```bash
kubectl get namespaces
```

Namespaces are a way to logically divide the cluster. You're currently working in the `default` namespace. The next lessons will explain exactly what that means.

You've confirmed your cluster is alive and seen its basic shape. In the next lesson, you'll understand the architecture behind what you just observed.
