---
seoTitle: 'What Is Gateway API in Kubernetes? GatewayClass, Gateway, HTTPRoute'
seoDescription: 'Understand what Kubernetes Gateway API is, how it replaces Ingress, and how GatewayClass, Gateway, and HTTPRoute work together to route external traffic.'
---

# What Is Kubernetes Gateway API?

Imagine you are deploying three services for your application: an `api` backend, a `frontend`, and an `admin` panel. Each one needs to be reachable from the internet. The straightforward approach is to give each Service a `LoadBalancer` type, but that means three cloud load balancers, three separate public IP addresses, and three DNS entries to maintain. Every new service multiplies the cost and the operational overhead. What you actually need is a single entry point that receives all inbound traffic and dispatches each request to the correct service based on the hostname or URL path.

That is exactly what the Kubernetes Gateway API provides.

@@@
graph LR
Internet["Internet"]
GW["Gateway\nport 80"]
R1["HTTPRoute\napi.myapp.com"]
R2["HTTPRoute\napp.myapp.com"]
R3["HTTPRoute\nadmin.myapp.com"]
API["Service: api-svc"]
FE["Service: frontend-svc"]
ADMIN["Service: admin-svc"]

    Internet --> GW
    GW --> R1
    GW --> R2
    GW --> R3
    R1 --> API
    R2 --> FE
    R3 --> ADMIN

@@@

A single Gateway listens on one port and receives every inbound connection. Behind it, multiple HTTPRoute resources each decide which hostname or path maps to which backend Service. Each team can own their own HTTPRoute without touching the shared Gateway. This clean separation between infrastructure configuration and routing logic is the core structural advantage of Gateway API.

Run the following command to see which Gateway API resource types are available in the simulated cluster:

```bash
kubectl api-resources --api-group=gateway.networking.k8s.io
```

You should see `GatewayClass`, `Gateway`, and `HTTPRoute` in the output. These three resource types form the complete chain, and each has a distinct role.

## GatewayClass: The Type of Gateway

A GatewayClass describes what implementation backs a set of Gateways, much like a car model in a manufacturer's catalog. The catalog entry tells you what engine type is used, what features are supported, and what safety ratings apply. You do not drive the catalog entry directly. You choose a model and purchase a specific car built on it.

In Kubernetes, the GatewayClass holds a `spec.controllerName` that identifies which controller software manages all Gateways that reference this class. For Envoy Gateway, that value is `gateway.envoyproxy.io/gatewayclass-controller`. When that controller is running, it watches for Gateway resources that reference this class and provisions them.

```bash
kubectl get gatewayclass
```

The `ACCEPTED` column tells you whether the controller has acknowledged this class. If it reads `True`, the controller is active and ready to provision Gateways that reference it.

:::quiz
You create a Gateway that references a GatewayClass with `ACCEPTED: False`. What happens?

- The Gateway is rejected and deleted automatically
- The Gateway is created in the cluster but the controller does not act on it
- The Gateway falls back to another available GatewayClass

**Answer:** The Gateway is stored but ignored. A `False` acceptance means the controller did not acknowledge the class, so it will not provision anything from it.
:::

## Gateway: The Listener Instance

A Gateway is the actual car you purchased, parked and ready to use. It references a GatewayClass and declares one or more listeners: which port to open, which protocol to use (HTTP, HTTPS, TCP), and optionally which hostnames to filter. A listener on port 80 matching `*.myapp.com` only accepts HTTPRoutes for hostnames under that wildcard.

```bash
kubectl get gateway
```

A freshly created Gateway may show `PROGRAMMED: False` while the controller is still configuring the underlying proxy. Once it reads `True`, the listener is active and ready to receive connections.

:::info
Gateway API is the modern replacement for the older `Ingress` resource (`networking.k8s.io/v1`). Where Ingress mixed infrastructure configuration and routing rules into a single object, Gateway API separates them cleanly: the `Gateway` owns listener configuration, the `HTTPRoute` owns routing rules. Platform teams and application teams can manage their respective resources independently.
:::

:::quiz
Which field in a Gateway resource defines what port and protocol to accept traffic on?

**Answer:** The `spec.listeners` field. Each listener entry declares a `port`, a `protocol`, and optionally a `hostname`. A single Gateway can have multiple listeners running concurrently.
:::

## HTTPRoute: The Routing Instructions

The HTTPRoute is the GPS itinerary loaded into the car before the trip. It defines where traffic goes after the Gateway has accepted the connection. A `parentRefs` field links the HTTPRoute to a specific Gateway, and then `rules` describe the matching conditions and the backend Services to route to.

Why does Kubernetes keep routing rules separate from listener configuration? Because routing is application-specific and changes frequently, while the Gateway configuration is infrastructure-level and changes rarely. Letting a development team update their HTTPRoute without any gateway admin approval is a meaningful operational benefit.

Together, the three resources form a complete chain: GatewayClass names the implementation, Gateway opens the listener, and HTTPRoute handles each individual request based on hostname and path.

:::warning
Without a controller actively watching these resources, any Gateway and HTTPRoute you create are stored in the cluster but have no effect on traffic. The resources express declarative intent. The controller is what turns that intent into live proxy configuration.
:::

Gateway API provides a portable, team-friendly model for routing external traffic into a Kubernetes cluster. By separating the infrastructure layer from the routing layer, it scales with your organization without creating coordination bottlenecks between teams.
