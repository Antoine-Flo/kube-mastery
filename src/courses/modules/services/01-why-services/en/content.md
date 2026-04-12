---
seoTitle: 'Kubernetes Services, Stable IPs, DNS, and Load Balancing'
seoDescription: 'Understand why Kubernetes Services exist, how they provide a stable IP and DNS name for dynamic Pods, and how kube-proxy handles load balancing.'
---

# Why Services

You have 3 Pods running your web application. Another Pod inside the cluster needs to call them. Which IP does it use?

Pod A has IP `10.244.0.5`. Pod B has `10.244.0.6`. Pod C has `10.244.0.7`. You pick Pod A and hardcode `10.244.0.5` into your client configuration. Everything works. Then Pod A crashes. The ReplicaSet creates a replacement with IP `10.244.0.8`. Your client still points to `10.244.0.5`, which no longer exists. The connection fails silently.

This is not a bug in your code. It is a structural problem: Pod IPs are ephemeral.

## Pod IPs Are Not Stable

Every time a Pod is created, Kubernetes assigns it a new IP address from the cluster network range. There is no guarantee this IP will be the same as the previous Pod's. A Pod that crashes, gets evicted from a node, or is replaced during a rolling update receives a brand new IP. Any client that holds the old IP has no automatic way to discover the replacement.

This affects every communication pattern inside a cluster. A frontend Pod calling a backend, a worker calling a queue, a sidecar calling the main application. All of them break the moment a Pod is replaced, unless something provides a stable address.

Start by creating the Deployment you will expose through a Service. Run this in the simulator:

```bash
nano web-deployment.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.28
          ports:
            - containerPort: 80
```

```bash
kubectl apply -f web-deployment.yaml
kubectl get pods -l app=web -o wide
```

Look at the `IP` column in the output. Note those addresses. They are real inside the simulated cluster, but they will change the next time those Pods are replaced.

:::warning
Never hardcode a Pod IP in application configuration or environment variables. Pod IPs are assigned at scheduling time and change on every restart, eviction, or rolling update. Any system that relies on Pod IPs directly is fragile by design. A single Pod crash is enough to break the entire communication path.
:::

## The Service Abstraction

A Service gives a group of Pods a single stable virtual IP, called the ClusterIP, and a DNS name that never changes. Clients call the Service. The Service finds the right Pods using a label selector. When a Pod is replaced, the Service updates its routing automatically. The ClusterIP stays the same.

Think of it like a company phone directory. Employees move desks constantly, but their extension number is always listed under their name. You call the directory number, not the desk. The phone system routes the call to whoever is sitting there now. Pods are the employees; the Service is the directory entry.

@@@
graph LR
CLIENT["Client Pod"]
SVC["Service\nClusterIP: 10.96.0.10\nDNS: web-svc"]
P1["Pod A\n10.244.0.5"]
P2["Pod B\n10.244.0.6"]
P3["Pod C (new)\n10.244.0.8"]
CLIENT --> SVC
SVC --> P1
SVC --> P2
SVC --> P3
@@@

The label selector is the bridge between the Service and the Pods. The Service says: "route traffic to any Pod that has the label `app: web`." Kubernetes keeps that list up to date automatically. When Pod A dies and Pod C appears with the same label, Pod C enters the routing pool. The client never changes its target.

:::quiz
Why is a fixed Pod IP not enough for stable service communication?

**Answer:** Pods are ephemeral. A Pod that crashes is replaced by the ReplicaSet with a completely new Pod object, a new UID, and a new IP address. The client that stored the old IP has no way to discover the replacement automatically. A Service solves this by maintaining a stable virtual IP that always routes to currently healthy Pods, regardless of how many times the underlying Pods have been replaced.
:::

## Confirming Ephemeral IPs

You can observe the problem directly. Trigger a rollout to replace the existing Pods:

```bash
kubectl rollout restart deployment/web
kubectl get pods -l app=web -o wide
```

Compare the IPs in the output to the ones you noted earlier. They are different. Any client that cached the old IPs is now broken. This is exactly the problem a Service prevents.

:::quiz
A Service has ClusterIP `10.96.0.10`. The three Pods behind it crash simultaneously and the Deployment creates 3 replacements. What is the Service ClusterIP after the replacement?

- It changes to a new IP to match the new Pods
- It stays the same: 10.96.0.10
- It becomes unavailable until a new Service is created

**Answer:** It stays the same: 10.96.0.10. The ClusterIP is assigned to the Service object, not to any Pod. Service objects are not deleted when Pods change. Clients can always reach the same IP, regardless of how many times the Pods behind it have been replaced.
:::

## What Comes Next

You have a Deployment with 2 Pods ready to serve traffic. The next step is creating a Service that exposes them and understanding exactly how the Service tracks which Pods to route to. That tracking mechanism is the Endpoints object, and it is the topic of the next lesson.
