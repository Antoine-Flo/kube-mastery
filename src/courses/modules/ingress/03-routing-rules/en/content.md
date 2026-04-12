---
seoTitle: 'Gateway API Routing Rules: Gateway, HTTPRoute, Host and Path Matching'
seoDescription: 'Learn how to define routing rules in Kubernetes Gateway API using Gateway listeners and HTTPRoute resources with hostname, path prefix, and exact path matching.'
---

# Routing Traffic with Gateway and HTTPRoute

Your application has two backend services: `api-svc` handles all API requests under `/v1`, and `admin-svc` hosts the admin dashboard under `/admin`. Both are served at the same hostname `api.myapp.com`. Rather than exposing each through a separate load balancer, you want a single Gateway to accept all traffic for that hostname and dispatch requests to the right service based on the path. Here is how to build that configuration step by step.

## Defining the Gateway

The Gateway declares the listener: which port to open, which protocol to use, and which hostnames to accept. Start with this manifest:

```bash
nano my-gateway.yaml
```

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: my-gateway
  namespace: default
spec:
  gatewayClassName: eg
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: '*.myapp.com'
```

The `gatewayClassName: eg` connects this Gateway to the Envoy Gateway controller. The listener accepts HTTP connections on port 80 for any subdomain of `myapp.com`. A request arriving for a hostname outside that wildcard, such as `other-domain.io`, is not accepted by this listener.

```bash
kubectl apply -f my-gateway.yaml
kubectl get gateway my-gateway
```

Wait until the `PROGRAMMED` column reads `True` before proceeding. The controller is configuring the Envoy proxy in the background, and it may take a few seconds.

:::quiz
The Gateway has `hostname: "*.myapp.com"`. You create an HTTPRoute for the hostname `other-domain.io`. Will the HTTPRoute attach to this Gateway?

- Yes, the HTTPRoute hostname overrides the Gateway listener filter
- No, the HTTPRoute hostname must match the Gateway listener's wildcard
- Yes, as long as the HTTPRoute has a `parentRef` pointing to the Gateway

**Answer:** No. The Gateway listener acts as a filter. Only HTTPRoutes whose hostnames fall within `*.myapp.com` are accepted. The `parentRef` is necessary but not sufficient on its own.
:::

## Building the HTTPRoute Incrementally

An HTTPRoute connects to a Gateway through `parentRefs` and defines routing behavior through `rules`. Build it in layers, starting with the structural skeleton:

```bash
nano api-route.yaml
```

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
  namespace: default
spec:
  parentRefs:
    - name: my-gateway
```

Next, add the `hostnames` field to declare which hostname this route responds to:

```yaml
hostnames:
  - 'api.myapp.com'
```

Now add the `rules`. Each rule has a `matches` block (what to look for in the request) and a `backendRefs` block (where to send the traffic):

```yaml
rules:
  - matches:
      - path:
          type: PathPrefix
          value: /v1
    backendRefs:
      - name: api-svc
        port: 80
  - matches:
      - path:
          type: PathPrefix
          value: /admin
    backendRefs:
      - name: admin-svc
        port: 80
```

The complete HTTPRoute now routes `/v1` and everything beneath it to `api-svc`, and `/admin` and everything beneath it to `admin-svc`, both at the `api.myapp.com` hostname.

```bash
kubectl apply -f api-route.yaml
```

@@@
graph LR
GW["Gateway listener\nport 80, *.myapp.com"]
M1["match: PathPrefix /v1"]
M2["match: PathPrefix /admin"]
API["api-svc:80"]
ADMIN["admin-svc:80"]

    GW --> M1
    GW --> M2
    M1 --> API
    M2 --> ADMIN

@@@

## Path Matching Types

The `path.type` field controls how the value is interpreted. `PathPrefix` matches any request whose path starts with the given value: `/v1`, `/v1/users`, and `/v1/products/42` all match a prefix of `/v1`. `Exact` matches only the precise path you specify, with no trailing segments allowed.

Why does the distinction matter? Consider a health check endpoint at `/health`. If you use `PathPrefix` with `/health`, a request to `/health/internal/deep-check` also matches, which may not be what you want. Use `Exact` when you need to target a single endpoint, not an entire subtree.

:::quiz
You define a rule with `type: Exact` and `value: /health`. A request arrives for `/health/check`. Does this rule match?

**Answer:** No. `Exact` requires the full path to be `/health` with nothing after it. `/health/check` does not match. You would need `PathPrefix` to route the entire `/health` subtree.
:::

## Checking Route Attachment

After applying the HTTPRoute, verify that it has successfully attached to the Gateway:

```bash
kubectl describe httproute api-route
```

Look for the `Status.Parents` section. It lists each Gateway the route attempted to attach to, along with a condition of type `Accepted`. A value of `True` means the route is active. A value of `False` comes with a `Reason` and a `Message` explaining the problem.

:::warning
The `parentRef` must match the Gateway name and namespace exactly. If the HTTPRoute is in a different namespace than the Gateway, you must specify both `name` and `namespace` in the `parentRef`. Additionally, the Gateway must have an `allowedRoutes` policy that permits cross-namespace references. By default, a Gateway only accepts routes from its own namespace, so a cross-namespace HTTPRoute silently fails to attach without this policy.
:::

Routing in Gateway API is built from two cooperating resources: the Gateway sets the boundaries of what traffic it accepts, and the HTTPRoute defines the exact matching conditions and destinations within those boundaries. Building each part incrementally, listener first, then hostnames, then individual rules, keeps the configuration readable and makes it straightforward to debug when attachment fails.
