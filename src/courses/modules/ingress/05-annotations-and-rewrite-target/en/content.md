---
seoTitle: 'Gateway API HTTPRoute Filters, URL Rewrite, Redirect, and Policies'
seoDescription: 'Learn how Gateway API replaces Ingress annotations with HTTPRoute filters and policy resources for URL rewrites, redirects, header manipulation, and advanced traffic behavior.'
---

# HTTPRoute Filters and Gateway API Policies

If you have worked with classic Ingress resources before, you have probably encountered annotations. Things like `nginx.ingress.kubernetes.io/rewrite-target: /` or `nginx.ingress.kubernetes.io/ssl-redirect: "true"`. These annotations are the escape hatch that Ingress controllers use to expose features that the Ingress API itself does not support. They work, but they come with real costs.

Annotations are strings. There is no schema validation. A typo in an annotation name or value silently does nothing, and you only find out when traffic does not behave as expected. Worse, every Ingress controller uses a different annotation namespace and syntax. Configuration written for NGINX Ingress does not work on Traefik, and neither works on Kong. This makes platform migrations painful and cross-team documentation confusing.

Gateway API was designed to eliminate this problem. Instead of annotations, it exposes advanced routing behavior through **first-class API fields**, with proper validation, clear semantics, and portability across implementations.

## HTTPRoute Filters: Inline Behavior on Rules

The primary mechanism for modifying request and response behavior in Gateway API is the **filter**. Filters are applied to individual rules in an HTTPRoute and can transform requests before they reach the backend, or transform responses before they return to the client.

Each rule in an HTTPRoute can have a `filters` list. The most commonly used filters are:

**URL rewrite**: changes the path or hostname before forwarding the request to the backend. This is the direct equivalent of the `rewrite-target` annotation from NGINX Ingress.

```yaml
rules:
  - matches:
      - path:
          type: PathPrefix
          value: /api
    filters:
      - type: URLRewrite
        urlRewrite:
          path:
            type: ReplacePrefixMatch
            replacePrefixMatch: /
    backendRefs:
      - name: api-service
        port: 8080
```

With this configuration, a request to `/api/users` is forwarded to the backend as `/users`. The `/api` prefix is stripped. This is a very common pattern when you want to route traffic to a microservice that does not know it is mounted under a path prefix.

**Request redirect**: returns an HTTP redirect response to the client instead of forwarding to a backend. Useful for enforcing HTTPS or for URL canonicalization.

```yaml
rules:
  - matches:
      - path:
          type: PathPrefix
          value: /old-path
    filters:
      - type: RequestRedirect
        requestRedirect:
          path:
            type: ReplacePrefixMatch
            replacePrefixMatch: /new-path
          statusCode: 301
```

**Request header modification**: add, remove, or overwrite headers on the request before it reaches the backend.

```yaml
filters:
  - type: RequestHeaderModifier
    requestHeaderModifier:
      set:
        - name: X-Forwarded-Host
          value: app.example.com
      remove:
        - X-Internal-Debug
```

**Response header modification**: same as above but applied to the response coming back from the backend.

:::info
All of these filters are part of the standard Gateway API specification. They work identically regardless of which implementation you use (Envoy Gateway, Cilium, Traefik, etc.). This is exactly the portability problem that annotations could not solve.
:::

## The Difference Between Filters and Policies

Filters are inline in the HTTPRoute rule. They apply to that specific rule and are owned by the team managing that route. Policies are separate resources that apply cross-cutting behavior at a broader scope.

Envoy Gateway supports several policy resources that extend the base Gateway API with implementation-specific capabilities. For example:

- **BackendTrafficPolicy**: controls load balancing, circuit breaking, and retry behavior for traffic going to backends.
- **ClientTrafficPolicy**: controls how Envoy handles incoming connections, including keepalive settings, buffer sizes, and client TLS requirements.
- **SecurityPolicy**: adds authentication and authorization checks, such as requiring a valid JWT token before routing a request.

These policies are attached to a Gateway or an HTTPRoute using a `targetRef` field, similar to how an HTTPRoute references a Gateway with `parentRefs`.

@@@
flowchart TD
    GW[Gateway]
    CTP[ClientTrafficPolicy\ntargetRef: Gateway]
    ROUTE[HTTPRoute]
    BTP[BackendTrafficPolicy\ntargetRef: HTTPRoute]
    SVC[Service]

    CTP -.->|applies to| GW
    GW --> ROUTE
    BTP -.->|applies to| ROUTE
    ROUTE --> SVC
@@@

This hierarchy keeps concerns separated. The platform team manages policies at the Gateway level. Application teams manage policies at the HTTPRoute level. Neither has to touch the other's resources.

:::warning
Policy resources like `BackendTrafficPolicy` and `ClientTrafficPolicy` are Envoy Gateway-specific and are not part of the core Gateway API specification. If you migrate to a different implementation, you will need to rewrite these policies. The routing itself (HTTPRoute filters) will be portable, but the policy attachments will not.
:::

## HTTPS Redirect: A Complete Example

One of the most common use cases combining routing rules and filters is redirecting all HTTP traffic to HTTPS. The pattern uses two listeners on the Gateway (one on port 80, one on port 443) and an HTTPRoute on the HTTP listener that returns a 301 redirect.

The redirect HTTPRoute looks like this:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: http-to-https-redirect
spec:
  parentRefs:
    - name: main-gateway
      sectionName: http
  rules:
    - filters:
        - type: RequestRedirect
          requestRedirect:
            scheme: https
            statusCode: 301
```

Any request arriving on port 80 is immediately redirected to the same URL on port 443. The browser follows the redirect and re-sends the request over HTTPS. No backend service is involved in serving the redirect, Envoy handles the entire thing.

## Hands-On Practice

In this lab, you will validate a critical controller behavior: route status should change when backend references become resolvable.

**Step 1: Inspect the active HTTPRoute status**

```bash
kubectl get httproute
kubectl describe httproute backend
```

Expected output excerpt:

```
Name:         backend
Namespace:    default
API Version:  gateway.networking.k8s.io/v1
Kind:         HTTPRoute
...
Rules:
  Backend Refs:
    Name:    backend
    Port:    3000
  Matches:
    Path:
      Type:   PathPrefix
      Value:  /
Status:
  Parents:
    Conditions:
      Type:                  Accepted
      Status:                True
      Type:                  ResolvedRefs
      Status:                <True|False>
```

Look at the `Rules` section and the `Status` conditions. There are no filters in the default configuration.

**Step 2: Create the missing backend reference**

```bash
kubectl create deployment backend --image=nginx
kubectl expose deployment backend --port=3000
```

**Step 3: Re-check HTTPRoute status**

```bash
kubectl describe httproute backend
```

Expected output excerpt:

```
Status:
  Parents:
    Conditions:
      Type:                  Accepted
      Status:                True
      Type:                  ResolvedRefs
      Reason:                ResolvedRefs
      Status:                True
```

You should now see `ResolvedRefs=True`, meaning the backend reference is resolvable by the controller.

**Step 4: Inspect the Gateway attachment point**

```bash
kubectl get gateways
kubectl describe gateway eg
```

You can see the Gateway status and active listeners. This is the attachment point where HTTPRoutes are bound and enforced.

**Step 5: Clean up**

```bash
kubectl delete deployment backend
kubectl delete service backend
kubectl describe httproute backend
```

After cleanup, `ResolvedRefs` should go back to `False`, which confirms status is driven by live backend resolution.
