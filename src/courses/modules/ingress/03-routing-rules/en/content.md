---
seoTitle: 'Gateway API Routing Rules: Gateway, HTTPRoute, Host and Path Matching'
seoDescription: 'Learn how to define routing rules in Kubernetes Gateway API using Gateway listeners and HTTPRoute resources with hostname, path prefix, and exact path matching.'
---

# Routing Rules with Gateway API

Now that you understand the overall architecture of Gateway API and how the Envoy Gateway controller works, it is time to dig into the part you will interact with most day to day: defining how traffic flows.

Routing in Gateway API is split across two resources, each with a clear purpose. The **Gateway** defines where traffic enters, and the **HTTPRoute** defines where it goes. This separation might feel like extra work at first, but it pays dividends when you have multiple teams and multiple applications sharing the same cluster entry point.

## The Gateway: Where Traffic Enters

Think of the Gateway as the front door of a building. It does not care who is visiting or where they are going inside. It just opens when traffic arrives on the right port and protocol. A Gateway listener is defined by three things: a **port**, a **protocol**, and optionally a **hostname**.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main-gateway
  namespace: default
spec:
  gatewayClassName: eg
  listeners:
    - name: http
      port: 80
      protocol: HTTP
```

A single Gateway can have multiple listeners, for example one on port 80 for HTTP and one on port 443 for HTTPS. Each listener can optionally restrict which hostnames it accepts, which allows you to use separate Gateways for different domains if needed.

The Envoy Gateway controller reads this and configures the Envoy proxy to bind on the specified ports. Once the Gateway is accepted and programmed by the controller, external traffic can start arriving.

## The HTTPRoute: Where Traffic Goes

The HTTPRoute is the routing table. It tells the proxy: for traffic arriving through this Gateway, on this hostname, with this path, send it to this Service.

Here is a basic example:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: backend
  namespace: default
spec:
  parentRefs:
    - name: main-gateway
  hostnames:
    - "www.example.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: backend
          port: 3000
```

The `parentRefs` field is how an HTTPRoute attaches to a Gateway. It says "I am routing traffic from this specific Gateway." Without a `parentRefs`, the route is orphaned and no traffic will reach it.

## Host-Based Routing

One of the most common uses of Gateway API is routing traffic based on the hostname. If you have two applications, one at `api.example.com` and one at `www.example.com`, you can use two HTTPRoutes, both attached to the same Gateway, but each matching on a different hostname.

This is far more elegant than the old approach of running a separate LoadBalancer Service per application. A single Envoy proxy listens on port 80 and port 443, and the hostnames in your HTTPRoutes determine which backend receives which request.

:::info
Hostname matching in HTTPRoute supports wildcards. A hostname like `*.example.com` will match any subdomain, which is useful for multi-tenant setups where each tenant gets their own subdomain.
:::

## Path-Based Routing

Beyond hostnames, you can also route based on the URL path. This lets you host multiple services behind a single hostname by splitting on path prefixes. For example, all requests to `/api/` go to the API service, while requests to `/static/` go to a CDN-backed static asset service.

Gateway API supports three types of path matching:

- **PathPrefix**: the request path must start with this value. This is the most common type. A prefix of `/api` matches `/api`, `/api/users`, `/api/orders`, and so on.
- **Exact**: the request path must match exactly. A rule with exact path `/healthz` only matches that specific path, not `/healthz/ready`.
- **RegularExpression**: matches using a regular expression. Powerful but use with care, complex regex can be hard to read and reason about.

@@@
flowchart LR
    Client([Incoming Request]) --> GW[Gateway Listener\nport 80]
    GW -->|host: api.example.com| R1[HTTPRoute A\nbackend: api-svc:8080]
    GW -->|host: www.example.com\npath: /static| R2[HTTPRoute B\nbackend: static-svc:80]
    GW -->|host: www.example.com\npath: /| R3[HTTPRoute B\nbackend: web-svc:3000]
    R1 --> API[api Pods]
    R2 --> STATIC[static Pods]
    R3 --> WEB[web Pods]
@@@

## Multiple Rules in One HTTPRoute

An HTTPRoute can have multiple rules, which are evaluated in order. The first matching rule wins. This lets you handle special cases before falling through to a general rule. For example, you might send `/api/v1/health` to a dedicated health endpoint, while all other `/api/v1/` traffic goes to the main API service.

:::warning
Rule ordering matters. If you put a broad `PathPrefix: /` rule before a more specific `PathPrefix: /api` rule, all traffic will match the first rule and the second will never be reached. Put more specific rules first.
:::

## Traffic Splitting Between Backends

HTTPRoute also supports splitting traffic between multiple backends by weight. This is useful for canary deployments, where you want to send a small percentage of traffic to a new version of your application while the majority still goes to the stable version.

```yaml
rules:
  - matches:
      - path:
          type: PathPrefix
          value: /
    backendRefs:
      - name: app-stable
        port: 80
        weight: 90
      - name: app-canary
        port: 80
        weight: 10
```

With this configuration, Envoy will distribute traffic roughly 90/10 between the two services. This is a powerful tool for progressive delivery, and it requires no changes to your application code or your DNS records.

## Hands-On Practice

The environment already contains a Gateway and an HTTPRoute. In this lab, the goal is to read routing intent precisely, not to create new resources.

**Step 1: Inspect the GatewayClass contract**

```bash
kubectl describe gatewayclass eg
```

Focus on `Spec > Controller Name` and `Status > Conditions`. This tells you which controller owns Gateway resources and whether the class is accepted.

**Step 2: Inspect the Gateway listener and attachment policy**

```bash
kubectl describe gateway eg
```

Expected output excerpt:

```
Spec:
  Gateway Class Name:  eg
  Listeners:
    Allowed Routes:
      Namespaces:
        From:  Same
    Name:      http
    Port:      80
    Protocol:  HTTP
...
Status:
  Conditions:
    Type:                  Accepted
    Status:                True
    Type:                  Programmed
    Status:                False
```

The key point is the separation between intent (`Spec`) and reconciliation result (`Status`).

**Step 3: Inspect the HTTPRoute routing rule**

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

Look at `Parent Refs`, `Matches`, and `Backend Refs`. This is the exact rule Envoy Gateway is reconciling.

**Step 4: Cross-check list views**

```bash
kubectl get gateways -A
kubectl get httproute -A
```

This verifies that list output and describe output tell the same routing story at different levels of detail.
