---
seoTitle: "Why Kubernetes? Self-Healing, Scheduling, Reconciliation"
seoDescription: "Learn how Kubernetes solves container orchestration at scale through reconciliation, self-healing, and automated scheduling across a cluster."
---

# Why Kubernetes?

Running one containerized application is manageable, write a Dockerfile, build an image, run a container. Real systems are usually multiple services that must run together, stay available under load, recover from failure, and roll out updates without downtime. At that point, the challenge is no longer containers themselves, it is orchestration, and that is what Kubernetes is built for.

## What Kubernetes Actually Does

At its core, Kubernetes continuously compares what you want with what is actually running, then closes the gap. You declare a desired state, "I want three copies of this service, using this image, with these environment variables", and Kubernetes is responsible for making and keeping that state true.

If a container crashes, Kubernetes restarts it. If a node goes offline, it reschedules Pods on healthy nodes. If you push a new image, it replaces old containers gradually and waits for readiness before continuing. You declare the outcome, Kubernetes keeps working toward it.

This loop of observation and correction is called **reconciliation**, and it is the key mental model for Kubernetes. The system never "finishes", it keeps reconciling actual state with desired state for the lifetime of the cluster.

## Beyond Self-Healing

Self-healing is the most visible benefit, but growth depends on more. The scheduler uses CPU and memory requests to place containers on nodes with enough capacity, automatically across the cluster. Services provide stable DNS names and IP addresses, so components can reach each other by name even when Pods are replaced. Storage can be provisioned and attached on demand. Configuration and secrets can be injected at runtime without rebuilding images.

Together, these features let today's infrastructure absorb tomorrow's load without rewriting your operational model.

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
