# The Evolution of Deployment

To truly appreciate Kubernetes, you need to understand the journey that led to it. The way we deploy software has changed dramatically over three decades, driven by a relentless search for better resource utilization, faster delivery, and greater reliability. Each era solved the problems of the previous one, and introduced new ones, pushing the industry toward the next evolution.

Think of it like the history of human accommodation: early travellers had to buy an entire house just to have a place to sleep, then apartments allowed sharing a building, then hostels sharing a room, then co-living spaces where every resource is shared intelligently. Software deployment has followed a strikingly similar arc.

## Era 1 Bare Metal: One App Per Server

In the beginning, deploying software meant running it directly onto physical servers, bare metal machines sitting in data centers or server rooms. The model was simple: one application, one server. No competition for resources, no isolation worries, but the cost was enormous.

Servers are expensive to purchase, house, power, cool, and maintain, and most were wildly underutilized:

- A web server handling moderate traffic might use only **15% of its CPU** on average
- The remaining 85% was simply wasted, burning electricity and sitting idle
- Scaling required physically acquiring new hardware, racking it, cabling it, installing an OS, and deploying the app, a process taking days or weeks
- There was no elasticity: either you had enough hardware, or you did not

:::info
"Bare metal" is still used today for workloads demanding maximum performance with zero virtualization overhead, such as high-frequency trading or high-performance computing. For general application workloads, it has largely been replaced by the approaches that followed.
:::

## Era 2 Virtualization: Better Density, Still Heavyweight

The virtual machine changed everything. The key insight was simple: if a server only uses 15% of its resources, why not run multiple isolated operating systems on that same hardware simultaneously? Hypervisors like VMware and later KVM made this possible, one physical server could host ten, twenty, or more VMs, and provisioning a new environment went from weeks to minutes.

But virtual machines carry significant overhead. Each VM runs a full operating system, its own kernel, init system, and background processes, in addition to the application you care about:

- A VM for a simple Node.js API might consume **2 GB of memory** just for the OS, even if the app only needs 200 MB
- Booting a VM takes minutes; copying a VM image across a network moves gigabytes of data
- Density improved enormously over bare metal, but there was still a great deal of weight to carry

## Era 3 Containers: Lightweight and Portable

Containers took a radically different approach to isolation. Rather than virtualizing the hardware, containers share the host operating system's kernel but isolate the application's view of the filesystem, processes, and network using kernel features called **namespaces** and **cgroups**.

The result is dramatically lighter than a VM. A container image for the same Node.js API might be 150 MB instead of 2 GB, start in milliseconds, and run identically on a developer's laptop, a CI/CD server, and a production machine, the "it works on my machine" problem largely disappears. Docker, launched in 2013, made containers accessible to ordinary developers and accelerated their adoption enormously.

But a new problem emerged. With hundreds of containers spread across many machines, manual management became chaos: which containers are on which hosts? How do you recover when a host goes down? How do you roll out new versions without downtime? How do containers find each other across different hosts? The technology to run containers had outpaced the technology to manage them.

:::warning
Containers are not inherently secure just because they are isolated. A misconfigured container can still be exploited to affect the host or other containers. Security in a containerized environment is an active discipline, not a property you get automatically.
:::

## Era 4 Orchestration: Kubernetes Answers the Question

The fourth era answers the question containers raised: who manages hundreds of containers across many machines?

**Kubernetes.** An orchestrator treats your cluster of machines as a single pool of resources. You stop thinking about individual machines and start thinking about desired states. Instead of "start this container on server 12," you say "I want three replicas of this web server, always running, with at least 512 MB of memory each." Kubernetes figures out the rest, and keeps figuring it out continuously, even as machines fail, traffic spikes, and new versions are deployed.

Kubernetes brought together the best ideas from a decade of Google's internal experience with Borg and Omega, adding cluster-level networking, standardized APIs, a rich extension model, and a vibrant ecosystem of tooling.

```mermaid
timeline
    title Evolution of Deployment
    1990s : Bare Metal
          : One app per server
          : High cost, low utilization
    2000s : Virtualization
          : Multiple VMs per server
          : Better density, full OS overhead
    2013  : Containers
          : Shared kernel, lightweight images
          : Fast, portable, but hard to manage at scale
    2014+ : Orchestration
          : Kubernetes manages containers across a cluster
          : Scheduling, self-healing, scaling, service discovery
```

## The Analogy in Full

The accommodation analogy maps neatly to each era:

- **Bare metal** → buying a whole house: you have everything to yourself, but most rooms sit empty and the cost is enormous
- **Virtualization** → apartments: you share the building's infrastructure but have your own front door and walls
- **Containers** → a hostel: you share far more (kitchen, bathrooms), which is cheaper and more flexible, but someone needs to coordinate who sleeps in which bed
- **Kubernetes** → the co-living operator: the intelligent system that manages coordination, allocates resources fairly, handles maintenance, and ensures everyone has what they need, without anyone managing it manually

:::info
The "eras" of deployment are not mutually exclusive. Many real-world environments today run all four simultaneously: bare metal for performance-critical workloads, VMs for legacy systems, containers for modern applications, and Kubernetes to orchestrate the containers. Understanding all four helps you navigate these mixed environments.
:::

## Hands-On Practice

Let's observe how Kubernetes abstracts away the notion of individual machines. When you deploy a workload, you do not choose which node it runs on, Kubernetes does.

Create a simple deployment with three replicas:

```
kubectl create deployment web --image=nginx --replicas=3
```

Expected output:

```
deployment.apps/web created
```

Now list the pods and see which nodes they were placed on:

```
kubectl get pods -o wide
```

Expected output:

```
NAME                   READY   STATUS    RESTARTS   AGE   IP            NODE     NOMINATED NODE   READINESS GATES
web-6d6b4f8d5-2xk4p   1/1     Running   0          15s   10.244.1.3    node01   <none>           <none>
web-6d6b4f8d5-9hbf7   1/1     Running   0          15s   10.244.1.4    node01   <none>           <none>
web-6d6b4f8d5-tnq8v   1/1     Running   0          15s   10.244.0.5    controlplane   <none>     <none>
```

Kubernetes distributed the three pods across available nodes automatically, the scheduler made that decision, not you. Open the cluster visualizer (telescope icon) to see this placement rendered visually.

Now delete one of the pods by name (use one of the names from your output):

```
kubectl delete pod web-6d6b4f8d5-2xk4p
```

Wait a few seconds, then list the pods again:

```
kubectl get pods -o wide
```

Kubernetes has automatically created a replacement pod. The self-healing mechanism noticed that the desired state (three replicas) did not match the actual state (two replicas) and corrected it. This is the core value proposition of orchestration.

Clean up when you are done:

```
kubectl delete deployment web
```

## Wrapping Up

The journey from bare metal to orchestration reflects a continuous push toward better resource efficiency, faster deployment cycles, and higher reliability. Each era solved the key problems of the previous one and introduced new challenges that drove the next innovation. In the next lesson, we zoom into the architecture of a Kubernetes cluster itself and explore what the control plane and worker nodes actually are.
