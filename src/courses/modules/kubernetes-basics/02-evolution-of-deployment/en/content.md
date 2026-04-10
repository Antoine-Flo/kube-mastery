---
seoTitle: 'Evolution of Deployment, Bare Metal, VMs, Containers, K8s'
seoDescription: 'Explore the evolution from bare metal servers through virtual machines to containers and Kubernetes orchestration, and why each era emerged.'
---

# The Evolution of Deployment

In 2005, deploying a web application meant ordering a physical server, waiting days for it to arrive in a rack, installing an operating system from a CD, configuring networking by hand, and then finally running your application on it. If your app consumed too much CPU during a traffic spike, every other process on that machine suffered. If you needed to deploy a second application alongside the first, you crossed your fingers that they would not conflict with each other's libraries or configuration.

That was the baseline. Every generation since has been a direct response to the problems of the one before.

## Bare Metal: One Server, One App

The safest way to run an application on a physical server was to dedicate that server entirely to it. No conflicts, no shared dependencies. But this came with a steep cost: most servers ran at 10 to 20 percent of their actual capacity. You were paying for the full machine and using a fraction of it. Adding a second application meant buying a second server.

Provisioning was also painfully slow. Infrastructure changes required human hands on physical hardware, often measured in days.

@@@
graph LR
    BM["Bare Metal\nOne app per server\nZero isolation"]
    VM["Virtual Machines\nMultiple apps\nIsolated OS per VM"]
    CT["Containers\nShared kernel\nLightweight isolation"]
    K8["Kubernetes\nOrchestrated containers\nat scale"]
    BM --> VM --> CT --> K8
@@@

## Virtual Machines: Isolation Arrives

Hypervisors changed the equation. A single physical server could now host multiple virtual machines, each with its own isolated operating system. You could run your Java app on one VM and your Python service on another, on the same physical hardware, without them interfering with each other.

Resource utilization improved significantly. Provisioning went from days to hours, or minutes if your team had automation in place.

But virtual machines carry overhead. Each VM runs a full guest OS: kernel, system libraries, background services. A VM that does almost nothing still consumes several gigabytes of disk and hundreds of megabytes of RAM just to exist. Boot times were measured in minutes, not seconds.

## Containers: Lightweight and Fast

Containers reuse the host machine's kernel. Instead of simulating an entire computer, a container gets its own isolated filesystem, process namespace, and network interface, while everything else is shared with the host. The result is startup times in milliseconds and memory footprints measured in megabytes, not gigabytes.

Docker made containers accessible in 2013. Teams started shipping their applications as container images that could run the same way in development, staging, and production. "It works on my machine" became a solvable problem.

:::quiz
What is the key technical difference between a container and a virtual machine?

- Containers run on a hypervisor, VMs run directly on hardware
- Containers share the host kernel, VMs include a full guest OS
- Containers are slower to start but use less memory than VMs

**Answer:** Containers share the host kernel, VMs include a full guest OS. This is why containers start in milliseconds and use far less memory, but it also means all containers on a host share the same kernel version.
:::

## The New Problem Containers Created

Once you had dozens of containers spread across multiple hosts, you needed answers to questions that Docker alone could not provide. Which host should run this container? What happens if that host goes offline? How do you update all instances of an image without downtime? How does container A find container B when containers move between hosts?

Why did this become a problem at scale but not at small scale? Because with one container on one machine, you can manage it yourself. With a hundred containers across ten machines, the coordination work exceeds what any human can do reliably. You need a system that watches, decides, and acts faster than any operations team can.

:::quiz
Why did containers make an orchestrator necessary?

**Answer:** A single container on a single host is easy to manage manually. But at scale, with dozens or hundreds of containers across multiple machines, you face scheduling, failure recovery, networking, and deployment coordination problems that compound faster than human operations can handle. The more containers you have, the less viable manual operation becomes.
:::

## Kubernetes: Orchestration at Scale

Kubernetes was released by Google in 2014, drawn from years of internal experience running containerized workloads at massive scale. It addresses exactly the problems that containers introduced: where things run, how they stay running, how they find each other, and how they update safely.

Where Docker manages a single container on a single host, Kubernetes manages fleets of containers across fleets of hosts, treating scheduling, self-healing, rolling updates, and service discovery as first-class concerns.

:::warning
Containers and virtual machines are not mutually exclusive. In most production environments, Kubernetes itself runs on virtual machines, not bare metal. VMs provide hardware isolation and cloud-provider integration that containers alone do not offer. The typical stack is: physical hardware, then a hypervisor, then VMs, then Kubernetes, then containers.
:::

Each era solved a real problem and created a new set of challenges. Kubernetes is where that chain currently lands. The next lesson looks at how a Kubernetes cluster is structured internally: which components are responsible for making decisions, and which ones carry those decisions out.
