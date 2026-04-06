---
seoTitle: 'What Is Gateway API in Kubernetes? GatewayClass, Gateway, HTTPRoute'
seoDescription: 'Understand what Kubernetes Gateway API is, how it replaces Ingress, and how GatewayClass, Gateway, and HTTPRoute work together to route external traffic.'
---

# What Is Gateway API?

When you deploy an application to Kubernetes, your Pods get IP addresses, but those addresses are private to the cluster. Nobody outside the cluster, no browser, no mobile app, no external API, can reach them directly. At some point you need a way to bridge the gap between the external world and the workloads running inside your cluster.

This is what we call **north-south traffic**: traffic flowing from outside the cluster into the cluster (as opposed to east-west traffic, which flows between services already inside the cluster). Managing this external entry point is one of the most important operational concerns in any Kubernetes deployment.

:::info
If you just finished the DNS module, you now understand how services find each other inside the cluster. Gateway API is the other side of that coin: how traffic from the outside world finds its way in.
:::

## The Evolution: From NodePort to Gateway API

Kubernetes has always offered multiple ways to expose workloads externally, and the ecosystem has matured significantly over the years.

The earliest approach was **NodePort**: exposing a service on a port of every node in the cluster. It works, but it requires clients to know a node's IP address and a specific high-numbered port, which is clunky and hard to manage at scale. Then came **LoadBalancer** services, which provision a cloud load balancer automatically, but give you one load balancer per service, which becomes expensive fast when you have dozens of applications.

**Ingress** was the first unified answer. It introduced a dedicated resource that could route HTTP and HTTPS traffic to multiple services based on hostnames and paths, using a single external IP. This was a significant improvement, but Ingress has a well-known limitation: the API itself is minimal, and controllers rely heavily on annotations to configure advanced behavior. Annotations are not portable, what works on NGINX Ingress does not work on Traefik, which does not work on HAProxy Ingress. Every team working across multiple clusters or multiple controllers had to relearn the annotation vocabulary each time.

**Gateway API** is the modern answer, designed by the Kubernetes community to address exactly these shortcomings. It is an official Kubernetes API (not an annotation workaround), with richer semantics, clear ownership boundaries, and explicit separation between infrastructure concerns and application routing concerns.

:::info
Ingress is not deprecated and is still widely used. For the CKA and CKAD exams, you should understand both. This module focuses on Gateway API, which is the direction the ecosystem is heading.
:::

## The Three Core Resources

Gateway API introduces three main resource types, each with a distinct purpose. Think of it like building an office block:

- **GatewayClass** is the blueprint, it defines the implementation. It answers the question: who is responsible for making this gateway work? The GatewayClass points to a specific controller, like Envoy Gateway.
- **Gateway** is the front door of the building. It defines where external traffic arrives: which ports to listen on, which protocols to accept, and which TLS certificates to use. The platform team typically owns this resource.
- **HTTPRoute** is the internal directory. It says "traffic arriving at this hostname, with this path, goes to this service." Application teams own their own HTTPRoutes in their own namespaces.

@@@
flowchart LR
    GC[GatewayClass\nenvoy-gateway-controller]
    GW[Gateway\nport 80 / 443]
    R[HTTPRoute\nhostname + path rules]
    SVC[Service]
    PODS[Pods]

    GC --> GW
    GW --> R
    R --> SVC
    SVC --> PODS
@@@

This three-tier model is not just organizational tidiness. It solves a real problem. In the old Ingress world, a single Ingress resource mixed infrastructure configuration with application routing, which meant either the platform team had to approve every route change, or the application team had too much access to infrastructure settings. With Gateway API, the boundary is explicit in the API itself.

## Ownership and Separation of Concerns

One of the design goals of Gateway API is to support multiple teams with different responsibilities working safely on the same cluster.

The **platform team** creates and owns the GatewayClass and Gateway resources. They decide how traffic enters the cluster, what ports are open, and what TLS policy applies. This is infrastructure work that affects the entire cluster.

The **application teams** create and own their HTTPRoutes in their own namespaces. They define routing rules for their applications without touching the Gateway configuration. They cannot accidentally break traffic for another team's application.

This model scales naturally. A single Gateway can serve hundreds of HTTPRoutes across dozens of namespaces, each managed by a different team, without any single team having visibility into or control over the others.

:::info
In this simulation, Envoy Gateway is pre-installed and a default Gateway is already configured. You can focus on understanding the resources without needing to install anything.
:::

## Why Envoy Gateway?

The controller that actually implements the Gateway API in this module is **Envoy Gateway**. Envoy is a high-performance proxy originally built at Lyft, now a graduated CNCF project. It is the proxy engine behind Istio, AWS App Mesh, and many other projects. Envoy Gateway wraps Envoy with a Kubernetes-native control plane that reconciles Gateway API resources and translates them into Envoy proxy configuration automatically.

You do not interact with Envoy directly. You create Gateway API resources in Kubernetes, and Envoy Gateway takes care of configuring the proxy. The result is a fully functional edge proxy with TLS termination, host-based routing, path-based routing, and more, all driven by standard Kubernetes objects.

@@@
sequenceDiagram
    participant You as You (kubectl)
    participant K8s as Kubernetes API
    participant EGC as Envoy Gateway Controller
    participant EP as Envoy Proxy (Data Plane)
    participant Client as External Client

    You->>K8s: apply HTTPRoute
    K8s-->>EGC: watch event (HTTPRoute created)
    EGC->>EP: push updated routing config (xDS)
    Client->>EP: HTTP request to app.example.com
    EP->>K8s: forward to matching Service
@@@

## Hands-On Practice

Let's get familiar with the Gateway API resources already running in your cluster.

**Step 1: List available GatewayClasses**

```bash
kubectl get gatewayclass
```

Expected output:

```
NAME   CONTROLLER                                      ACCEPTED   AGE
eg     gateway.envoyproxy.io/gatewayclass-controller   True       <age>
```

The `ACCEPTED: True` column confirms that the Envoy Gateway controller is running and has adopted this GatewayClass.

**Step 2: Inspect the GatewayClass**

```bash
kubectl describe gatewayclass eg
```

Expected output excerpt:

```
Name:         eg
API Version:  gateway.networking.k8s.io/v1
Kind:         GatewayClass
...
Spec:
  Controller Name:  gateway.envoyproxy.io/gatewayclass-controller
Status:
  Conditions:
    Type:                  Accepted
    Status:                True
```

The `Controller Name` and `Accepted=True` fields confirm that Envoy Gateway owns and accepts this class.

**Step 3: List Gateways**

```bash
kubectl get gateways -A
```

Expected output:

```
NAMESPACE   NAME   CLASS   ADDRESS   PROGRAMMED   AGE
default     eg     eg                False        <age>
```

**Step 4: List HTTPRoutes**

```bash
kubectl get httproute -A
```

Expected output:

```
NAMESPACE   NAME      HOSTNAMES             AGE
default     backend   ["www.example.com"]   <age>
```

**Step 5: Describe the HTTPRoute to see the routing rules**

```bash
kubectl describe httproute backend
```

Expected output excerpt:

```
Name:         backend
Namespace:    default
API Version:  gateway.networking.k8s.io/v1
Kind:         HTTPRoute
...
Spec:
  Hostnames:
    www.example.com
  Parent Refs:
    Group:  gateway.networking.k8s.io
    Kind:   Gateway
    Name:   eg
  Rules:
    Backend Refs:
      Kind:    Service
      Name:    backend
      Port:    3000
    Matches:
      Path:
        Type:   PathPrefix
        Value:  /
...
Status:
  Parents:
    Conditions:
      Type:                  Accepted
      Status:                True
      Type:                  ResolvedRefs
      Status:                <True|False>
```

Look at the `Spec` and `Status` sections together. `Spec` describes your routing intent, and `Status` confirms whether the controller accepted and resolved backend references.
