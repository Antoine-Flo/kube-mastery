---
seoTitle: 'Gateway API HTTPRoute Filters, URL Rewrite, Redirect, and Policies'
seoDescription: 'Learn how Gateway API replaces Ingress annotations with HTTPRoute filters and policy resources for URL rewrites, redirects, header manipulation, and advanced traffic behavior.'
---

# Portable Traffic Manipulation with HTTPRoute Filters

When routing traffic, you often need to do more than match a path and forward the request unchanged. You might want to strip a path prefix before the request reaches the backend, redirect HTTP requests to HTTPS, or inject a header the backend expects. With the old `Ingress` resource, these behaviors were configured through controller-specific annotations like `nginx.ingress.kubernetes.io/rewrite-target`. Those annotations were not portable: a manifest written for nginx did not work on a different controller without rewriting every annotation.

Gateway API solves this by moving these behaviors into the HTTPRoute spec itself, as `filters`. Filters are part of the standard Kubernetes Gateway API, which means they work the same way regardless of which controller implements the Gateway underneath.

@@@
graph LR
Client["Client\nGET /api/users"]
HR["HTTPRoute\nfilter: URLRewrite\n/api -> /"]
SVC["api-svc\nreceives GET /users"]

    Client --> HR
    HR --> SVC

@@@

## URL Rewrite: Strip a Path Prefix

A common pattern is to host a service at a sub-path of your domain, like `/api`, while the service itself expects requests at the root `/`. A client requesting `/api/users` should arrive at the backend as `/users`. The `URLRewrite` filter with a `ReplacePrefixMatch` handles this precisely.

Start with a basic HTTPRoute:

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
  hostnames:
    - 'api.myapp.com'
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: api-svc
          port: 80
```

Now add the `URLRewrite` filter to the rule to strip the `/api` prefix before forwarding:

```yaml
filters:
  - type: URLRewrite
    urlRewrite:
      path:
        type: ReplacePrefixMatch
        replacePrefixMatch: /
```

The `ReplacePrefixMatch` replaces the matched prefix (`/api`) with the given value (`/`), so `/api/users` becomes `/users` at the backend, and `/api/products/42` becomes `/products/42`.

```bash
kubectl apply -f api-route.yaml
kubectl describe httproute api-route
```

The `Spec.Rules` section in the describe output lists all active filters, confirming the rewrite is registered.

:::quiz
A client sends `GET /api/products/42`. The HTTPRoute matches `/api` with a `URLRewrite` filter that replaces the prefix with `/`. What path does `api-svc` receive?

**Answer:** `/products/42`. The prefix `/api` is replaced by `/`, and the remainder of the path is preserved as-is. The backend sees `/products/42`, not `/api/products/42`.
:::

## Request Redirect: Send the Client Elsewhere

The `RequestRedirect` filter does not forward the request to a backend. Instead, it sends an HTTP redirect response back to the client, telling it to re-request at a different URL. This is useful for redirecting plain HTTP traffic to HTTPS, or moving an old path permanently to a new location.

Add a redirect rule that sends HTTP clients to HTTPS:

```bash
nano redirect-route.yaml
```

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: redirect-route
  namespace: default
spec:
  parentRefs:
    - name: my-gateway
      sectionName: http
  hostnames:
    - 'api.myapp.com'
  rules:
    - filters:
        - type: RequestRedirect
          requestRedirect:
            scheme: https
            statusCode: 301
```

This rule has no `matches` block, so it matches all requests arriving at the HTTP listener for `api.myapp.com`. It returns a `301 Moved Permanently` response, instructing the client to resend the request over HTTPS.

```bash
kubectl apply -f redirect-route.yaml
```

:::warning
`URLRewrite` and `RequestRedirect` are mutually exclusive within the same rule. A rule that includes both filters will be rejected by the controller. If you need to rewrite and redirect in different scenarios, place each behavior in a separate rule with its own `matches` condition.
:::

:::quiz
You want to redirect all HTTP requests to HTTPS. Should you use `URLRewrite` or `RequestRedirect`?

- `URLRewrite`, because it modifies the request scheme
- `RequestRedirect`, because it sends the client a redirect response to a different scheme
- Either one, they are equivalent for scheme changes

**Answer:** `RequestRedirect` with `scheme: https`. `URLRewrite` modifies how the request is forwarded to the backend but it does not send a redirect to the client. Only `RequestRedirect` sends a 3xx status code back, causing the browser or client to follow the new URL.
:::

## Request Header Modifier: Add or Remove Headers

The `RequestHeaderModifier` filter lets you add, set, or remove HTTP headers before the request reaches the backend. This is useful for injecting metadata headers, removing sensitive forwarded headers, or setting values that backend services depend on.

Add a filter to the existing api-route:

```yaml
filters:
  - type: RequestHeaderModifier
    requestHeaderModifier:
      add:
        - name: X-Gateway-Version
          value: 'v1'
      remove:
        - X-Internal-Token
```

The `add` list appends a header if it does not already exist, or adds a new value alongside existing ones. The `remove` list strips the named headers entirely before the request reaches the backend. Apply the updated manifest and inspect the result:

```bash
kubectl apply -f api-route.yaml
kubectl describe httproute api-route
```

:::info
Filters are defined inside the HTTPRoute spec, not in external annotations. This makes them readable, diffable in version control, and portable across every Gateway API conformant controller. Any controller that implements the Gateway API specification supports the same set of filter types without custom annotations.
:::

:::quiz
You want to inject an `X-Request-Source: gateway` header on every forwarded request. Which filter type do you use, and which field inside it?

**Answer:** `RequestHeaderModifier` with an `add` entry. Set `name: X-Request-Source` and `value: gateway` inside `requestHeaderModifier.add`. The filter runs before the request is forwarded to the backend.
:::

HTTPRoute filters replace the annotation-driven customization of the old Ingress resource with a portable, spec-driven model. URL rewrites, redirects, and header manipulation are all declared within the HTTPRoute itself, which means the same manifest works on any conformant Gateway API controller and can be reviewed, tested, and versioned like any other Kubernetes resource.
