---
seoTitle: 'Kubernetes Control Plane, kube-apiserver, etcd, Controllers'
seoDescription: 'Understand the four core Kubernetes control plane components, kube-apiserver, etcd, kube-scheduler, and kube-controller-manager, and how they work together.'
---

# Control Plane Components

You tell the cluster you want three copies of your application running. A few seconds later, they are. It feels instant. But something had to receive that intention, validate it, persist it, decide which nodes would host each copy, and coordinate actually starting the containers. This lesson opens that black box and traces exactly what happened.

@@@
sequenceDiagram
participant User as kubectl
participant API as kube-apiserver
participant ETCD as etcd
participant CM as kube-controller-manager
participant SCHED as kube-scheduler
participant KL as kubelet

    User->>API: kubectl apply -f deployment.yaml
    API->>ETCD: store Deployment object
    CM->>API: watch: new Deployment detected
    CM->>API: create ReplicaSet + Pods (nodeName empty)
    API->>ETCD: store ReplicaSet + Pods
    SCHED->>API: watch: unscheduled Pods
    SCHED->>API: assign nodeName to each Pod
    KL->>API: watch: Pods assigned to my node
    KL->>KL: start containers

@@@

The control plane is not one thing. It is four components, each with a single responsibility, all communicating through a shared API.

## kube-apiserver

Nothing in your cluster talks to anything else directly. Every component, kubectl, controllers, kubelets, sends its requests to one address: the kube-apiserver.

When you run `kubectl apply`, you are sending an HTTP request to the API server. It validates the request (are all required fields present? does this user have permission?), then writes the result to storage. It is the single gateway through which all cluster state flows, in both directions.

```bash
kubectl get pods -n kube-system
```

You will see Pods for each control plane component running in the `kube-system` namespace. Look for `kube-apiserver`, `etcd`, `kube-scheduler`, and `kube-controller-manager`. On most clusters, these run as static Pods on the control plane node.

:::quiz
In the output of `kubectl get pods -n kube-system`, some Pod names end with `sim-control-plane` and others do not. Which category do `kube-proxy` and `coredns` fall into, and what does that tell you about where they run?

**Try it:** `kubectl get pods -n kube-system`

**Answer:** `kube-proxy` and `coredns` do not have `sim-control-plane` in their name. They appear three times, once per node. They are not control plane components, they run on every node in the cluster. The Pods ending in `sim-control-plane` (kube-apiserver, etcd, kube-scheduler, kube-controller-manager) are the actual control plane components and run only on the control plane node.
:::

## etcd

The API server validates and forwards requests, but where does the data actually live? In etcd, a distributed key-value store that holds the entire state of your cluster: every Deployment, Pod, ConfigMap, Secret, and Node object.

Only the API server writes to etcd. This is deliberate. If every component wrote directly to etcd, concurrent writes would create race conditions that are nearly impossible to debug. The API server serializes access and guarantees consistency.

:::warning
If etcd becomes unavailable, the API server cannot persist new objects and refuses most write requests. Controllers stop making progress. The scheduler stops placing Pods. The entire cluster freezes in terms of new work. Existing containers on nodes keep running (the kubelet handles that locally), but nothing new can happen. This is why etcd is always replicated on 3 or 5 nodes in production, never just one.
:::

:::quiz
Your team wants the control plane to survive the loss of one node. How many etcd replicas do they need?

- 2 (one leader, one follower)
- 3 (sufficient quorum after losing one)
- 5 (required minimum in all production clusters)

**Answer:** 3. etcd uses Raft consensus and needs a majority (quorum) to elect a leader. With 3 nodes, losing one still leaves a majority of 2. With 2 nodes, losing one leaves no quorum and the cluster halts. 5 is valid but not the minimum.
:::

## kube-scheduler

The API server stored your Pods, but each one has an empty `nodeName` field. The scheduler is watching for exactly that: Pods that exist but have no node assigned.

When it finds one, it evaluates all available nodes. Does this node have enough CPU and memory? Does the Pod require a specific node label? Are there taints the Pod cannot tolerate? After filtering, it scores the candidates and picks the best match.

Then it does something that surprises most people: it does not start the container. It writes the chosen node's name into the Pod's `nodeName` field and calls the API server to save that single update. That is the scheduler's entire contribution to the sequence.

Why doesn't the scheduler start the container itself? Because each component has exactly one responsibility. The scheduler decides. A different component executes. This separation means you can replace or customize the scheduler without touching anything that actually runs containers.

:::quiz
Which component decides which node a Pod will run on?

- etcd (stores cluster state but makes no decisions)
- kube-scheduler (evaluates nodes and assigns the Pod)
- kube-controller-manager (runs the controller loops)

**Answer:** kube-scheduler. etcd stores state but makes no decisions. kube-controller-manager creates Pods but does not place them. Only the scheduler evaluates node fitness and sets `nodeName`.
:::

## kube-controller-manager

Controllers are the loops that keep your cluster honest. The Deployment controller watches for Deployments and creates ReplicaSets. The ReplicaSet controller watches for ReplicaSets and creates Pods. The Node controller watches Nodes and marks them unavailable when they stop reporting in.

Each loop does the same thing: compare the desired state (what you declared) with the actual state (what exists in the cluster), then reconcile the difference. These loops run continuously, not on a fixed schedule.

The kube-controller-manager runs all of these loops in a single process. In early Kubernetes, each controller was its own binary, which meant more processes to manage and more things that could fail independently. Merging them simplified operations without changing how any individual controller works.

:::quiz
You scale a Deployment from 2 to 5 replicas. Which component notices first and acts on it?

**Answer:** The Deployment controller inside kube-controller-manager. It watches Deployments and reconciles the desired replica count by updating the owned ReplicaSet. The ReplicaSet controller then creates the three missing Pods. The scheduler and kubelet act later in the chain, each doing their part in sequence.
:::

The control plane handles all decision-making: validating requests, storing state, scheduling Pods, and reconciling desired state. The next lesson covers what happens on the other side, on the worker nodes themselves, where the kubelet and container runtime actually start and manage your containers.
