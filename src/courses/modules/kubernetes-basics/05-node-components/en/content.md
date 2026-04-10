---
seoTitle: 'Kubernetes Worker Node Components, kubelet, kube-proxy, CRI'
seoDescription: 'Explore the three components on every Kubernetes worker node, kubelet for pod management, kube-proxy for networking, and the container runtime.'
---

# Node Components

The scheduler has made its decision. Your Pod's `nodeName` field is now set to `node-1`. The control plane moves on. But no one from the control plane connects to `node-1` to start the container. Something on the node has to go looking for that assignment. That something is the kubelet.

@@@
graph TB
    subgraph cp [Control Plane]
        API["kube-apiserver"]
    end
    subgraph node [Worker Node]
        KL["kubelet"]
        KP["kube-proxy"]
        CNI["CNI plugin (kindnet)"]
        CRI["Container Runtime (containerd)"]
        P1["Pod A"]
        P2["Pod B"]
        DNS["CoreDNS Pod"]
    end

    API -->|"Pod spec"| KL
    KL -->|"start"| CRI
    CRI --> P1
    CRI --> P2
    CRI --> DNS
    KL -->|"status"| API
    KP -->|"routing rules"| P1
    KP -->|"routing rules"| P2
    CNI -->|"assign IP"| P1
    CNI -->|"assign IP"| P2
    CNI -->|"assign IP"| DNS
    DNS -->|"name resolution"| P1
    DNS -->|"name resolution"| P2
@@@

Four components run on every worker node. One additional component runs as a cluster-wide addon. Each has a distinct role: managing Pods, assigning network identities, routing Service traffic, running containers, and resolving names inside the cluster.

## kubelet

The kubelet is the primary agent on every node. It runs as a process on the host itself, not as a Pod inside the cluster. Its job is to watch the API server for Pods assigned to its node, and to make sure those Pods are running and healthy.

When the kubelet detects a new Pod with its node's name, it reads the Pod spec and calls the container runtime to pull images and start containers. Once the containers are up, the kubelet monitors them and reports their status back to the API server: `Running`, `Succeeded`, or `Failed`. That reported status is exactly what you see when you run `kubectl get pods`.

To check which nodes are in your cluster and whether each kubelet is healthy:

```bash
kubectl get nodes
```

The `STATUS` column shows `Ready` when the kubelet is running and the node can accept new Pods. `NotReady` means the kubelet has stopped reporting in, usually indicating a problem on the node itself.

:::warning
When a node shows `NotReady`, the scheduler immediately stops placing new Pods there. If the node stays `NotReady` long enough (the default eviction timeout is five minutes), Kubernetes begins evicting the Pods on that node and rescheduling them elsewhere. This is one of the first failure patterns to recognize on a real cluster.
:::

To inspect a node in more detail:

```bash
kubectl describe node sim-worker
```

Look at the `Conditions` section: `Ready`, `MemoryPressure`, `DiskPressure`, and `PIDPressure` tell you the health of the node at the resource level. The `Allocated resources` section shows how much CPU and memory the currently running Pods are requesting in total.

:::quiz
What does it mean when a node shows `Ready` status?

**Answer:** The kubelet is running, has reported to the API server recently, and the node is eligible to receive new Pods. It does not mean the node is idle or that all Pods on it are healthy. It only reflects the kubelet's own health and the node's current availability.
:::

## kube-proxy

While the kubelet manages containers, kube-proxy manages network routing. It runs on every node and implements the Service abstraction at the Linux networking level.

When you create a Service, kube-proxy watches the API server for the new Service and its associated Endpoints. It then programs the local iptables rules (or IPVS rules, depending on cluster configuration) to redirect traffic destined for the Service's ClusterIP toward one of the backing Pods.

Why does kube-proxy run on every node instead of just one? Because the Pod sending a request and the Pod receiving it may be on different nodes. The routing decision happens locally, on the node where the traffic originates. If kube-proxy only ran on one central node, traffic from other nodes would have no local rules to redirect it.

:::quiz
A Service with ClusterIP `10.96.0.10` is created. Which component programs the network rules that make traffic to that IP reach the right Pods?

- kube-scheduler (handles routing decisions between nodes)
- kubelet (manages all networking on the node)
- kube-proxy (programs iptables rules for Service traffic)

**Answer:** kube-proxy. The kubelet manages container lifecycle. The scheduler makes placement decisions. Only kube-proxy touches the node's network rules to implement Services.
:::

## CNI Plugin

kube-proxy routes traffic to Services, but a more fundamental question comes first: how does each Pod get its own IP address in the first place?

That is the CNI plugin's responsibility. CNI stands for Container Network Interface. When the kubelet starts a new Pod, it calls the CNI plugin to set up the Pod's network: assign an IP address, configure a virtual network interface, and establish the routes that let the Pod communicate with other Pods across node boundaries.

In this simulated cluster, the CNI plugin is kindnet. On real clusters you will encounter Calico, Cilium, or Flannel. The plugin choice affects how Pod-to-Pod traffic is routed internally, but from your perspective as a user the result is always the same: every Pod gets a unique IP that is reachable from any other Pod in the cluster, regardless of which node each one is on.

```bash
kubectl get pods -n kube-system
```

The `kindnet-*` Pods in the output run as a DaemonSet, one instance per node. Each instance manages the network setup on its own node. This is the same pattern as kube-proxy: anything that must configure local node networking runs everywhere.

:::quiz
Why does the CNI plugin run on every node instead of just one?

**Answer:** Because Pod network setup is a local operation. When the kubelet starts a Pod, the CNI plugin has to configure virtual interfaces and IP routes on that specific node's network stack. A centralized CNI plugin would have no access to the local kernel networking on remote nodes.
:::

## Container Runtime

The kubelet decides what needs to run. But it does not pull images or create container processes itself. That is the container runtime's job.

Kubernetes does not talk to containerd or any runtime directly. It uses a standardized interface called the Container Runtime Interface, or CRI. The kubelet calls the CRI, and the runtime handles the rest: pulling the image from a registry, creating the container process, and managing its lifecycle.

The most common runtime today is containerd. Docker was used as a direct runtime in earlier Kubernetes versions but was removed in Kubernetes 1.24 because it added unnecessary indirection. Docker itself uses containerd internally, so the actual container execution did not change, only the interface Kubernetes used to reach it.

Why define a standard interface at all? Because the Kubernetes team did not want to be permanently dependent on one runtime vendor. Any runtime that implements the CRI spec can plug in without changes to the kubelet. The scheduler, controller manager, and kubelet all stay exactly the same regardless of which runtime is used.

:::quiz
The kubelet needs to start a container. Which sequence is correct?

- The kubelet starts the container directly, then reports to the API server
- The kubelet calls the CRI, the runtime starts the container, the kubelet reports status to the API server
- kube-proxy calls the CRI on behalf of the kubelet

**Answer:** The kubelet calls the CRI, the runtime starts the container, then the kubelet reports status. The kubelet never manipulates containers directly. kube-proxy plays no role in starting containers, it only manages network routing.
:::

## CoreDNS

Pod IPs change every time a Pod is restarted or moved to another node. To avoid hardcoding IPs, Kubernetes runs a DNS server inside the cluster: CoreDNS. When a Pod wants to reach another component by name, it queries CoreDNS, which returns the right IP.

CoreDNS runs as a Deployment in `kube-system`. You will learn what a Deployment is in a later lesson. For now, think of it as a way to run several copies of a Pod for redundancy.

```bash
kubectl get deployments -n kube-system
```

You will see a `coredns` Deployment with 2 replicas. Two copies means that if one restarts, name resolution keeps working through the other.

:::quiz
Why does CoreDNS run two replicas instead of one?

**Answer:** If a single CoreDNS Pod restarted, every Pod in the cluster would temporarily lose the ability to resolve names. Two replicas guarantee that at least one is always available to answer DNS queries during restarts or failures.
:::

## Interleaving: What Happens If the API Server Goes Down

You now know that the kubelet continuously watches the API server for Pod assignments. So what happens to running Pods if the API server becomes temporarily unavailable?

The kubelet can continue monitoring and restarting containers that were already running on its node. It caches the last known Pod spec locally. If a container crashes, the kubelet restarts it based on that local cache. What it cannot do is receive new Pod assignments, update status back to the API server, or pick up changes to existing Pods. The node keeps working, but it is isolated from the cluster's decision-making until the API server recovers.

:::quiz
The API server is down for two minutes. A container on node-1 crashes during that window. What does the kubelet do?

**Answer:** The kubelet restarts the container using its locally cached Pod spec. It does not wait for the API server. It cannot report the restart event or receive new assignments while the API server is down, but existing container management continues independently on the node.
:::

:::info
In the simulator, you interact with a single-node setup and see its Pods, but without access to the underlying host. On a real cluster, node-level debugging involves `systemctl status kubelet` and `journalctl -u kubelet` on the host machine to inspect what the kubelet is doing and why containers are failing to start.
:::

The full picture is now complete. When you declare desired state to the cluster, the API server receives and stores it, the controller manager creates Pods, the scheduler assigns a node, the CNI plugin gives each Pod an IP, the kubelet calls the container runtime to start the containers, kube-proxy programs the routing rules for Services, and CoreDNS makes those Services reachable by name. Every component has exactly one job, and they all communicate through the API server. The next module covers the Kubernetes object model, which is the language you use to express desired state to this entire system.
