---
seoTitle: 'When to Use Gateway API, Services vs Gateway, Traffic Entry Points'
seoDescription: 'Understand when a Kubernetes Service type is sufficient and when Gateway API is the right entry point for HTTP routing, TLS, and host-based traffic management.'
---

# Services vs Gateway API: Choosing Your Entry Point

You have a running application and you need to expose it. You already know Services: ClusterIP for internal traffic, NodePort for direct node access, LoadBalancer for cloud-managed external exposure. The question is: when do you need Gateway API on top of that, and when is a plain Service enough?

```bash
kubectl get services
```

Look at what you have. Each Service type solves a specific scope of the problem. Gateway API is not a replacement for Services. It is a layer that routes HTTP and HTTPS traffic at the application level, something a raw Service cannot do.

## What Services cannot do

A LoadBalancer Service gives you a single external IP that forwards TCP traffic to one target port on a set of Pods. That covers a lot of use cases. But consider what happens when you have three different applications, each with their own hostname and URL paths, all needing to share one external IP address.

@@@
graph TB
EXT["External traffic\none IP, port 443"]
GW["Gateway\n(single entry point)"]
HR1["HTTPRoute\nhost: app1.example.com\n-> Service app1"]
HR2["HTTPRoute\nhost: app2.example.com\n-> Service app2"]
HR3["HTTPRoute\nhost: api.example.com\npath: /v2/*\n-> Service api-v2"]
EXT --> GW
GW --> HR1
GW --> HR2
GW --> HR3
@@@

A LoadBalancer Service cannot inspect the HTTP `Host` header. It cannot route based on URL paths. It does not understand TLS hostnames. It sees a TCP connection and forwards it. If you need to route `app1.example.com` to one Deployment and `app2.example.com` to another, you need a component that operates at the HTTP layer. That component is a Gateway.

:::quiz
You have two web applications on different hostnames sharing the same external IP. Which Kubernetes resource makes this possible?

- Two separate LoadBalancer Services, one per application
- A Gateway with two HTTPRoutes, each matching a different hostname
- A ClusterIP Service with host-based routing

**Answer:** A Gateway with two HTTPRoutes. LoadBalancer Services cannot inspect HTTP headers. ClusterIP is internal only. Gateway API was built specifically for host and path-based HTTP routing across multiple applications on a single entry point.
:::

## The division of responsibilities

Gateway API separates two concerns that are often conflated: infrastructure configuration and application routing.

The `Gateway` object is infrastructure. It declares a listener on a port and protocol, and it references a `GatewayClass` that specifies which controller implements it. Platform teams manage Gateways. They decide what ports are open, what TLS certificates are attached, and which namespaces can use the Gateway.

The `HTTPRoute` object is application routing. It declares which hostnames and paths map to which Services. Application teams manage HTTPRoutes. They do not need to touch the Gateway or understand the controller underneath.

```bash
kubectl get gateways
kubectl get httproutes
```

This separation matters in practice. A platform team can provision a single shared Gateway for an entire organization. Multiple application teams can then attach their own HTTPRoutes to it independently, each routing their traffic without coordinating with each other or with the platform team.

:::quiz
An application team wants to add a new route to an existing Gateway without changing the Gateway configuration. What resource do they create?

**Answer:** An HTTPRoute. HTTPRoutes are the application-level routing rules. They attach to a Gateway by referencing it in their `parentRefs` field. The Gateway itself does not need to be modified. This is the core design principle: infrastructure and routing are separate concerns managed by separate teams.
:::

## When a plain Service is enough

Gateway API adds a layer of complexity that is not always warranted. Use a plain Service when:

The application is internal only. ClusterIP is simpler, faster, and has no external attack surface. If only other Pods in the cluster need to reach the application, a Gateway adds nothing.

The application has a single external endpoint with no hostname-based routing. A LoadBalancer Service is sufficient when you only need one IP pointing at one set of Pods, with no path or host inspection.

You do not need TLS termination at the gateway level. If your application handles its own TLS or does not need HTTPS, a raw Service is adequate.

Add Gateway API when you need HTTP-level routing: multiple hostnames on one IP, path-based routing to different backends, TLS termination with SNI, header manipulation, or traffic splitting between versions.

:::warning
Gateway API requires a controller to implement it. On a real cluster, you must install a Gateway controller such as Envoy Gateway or another conformant implementation before `Gateway` and `HTTPRoute` objects have any effect. Creating these objects without a controller does not produce an error, but nothing routes. Always verify that a `GatewayClass` with an active controller exists before creating Gateways.
:::

```bash
kubectl get gatewayclasses
```

A `GatewayClass` in `ACCEPTED` status means a controller is active and ready to provision Gateways. If the list is empty, no controller is installed and no traffic routing will occur. In the simulated cluster, a GatewayClass is pre-configured.

The right entry point is the simplest one that solves your routing requirements. Services for TCP-level exposure. Gateway API for HTTP-level routing. Both are tools, not defaults.
