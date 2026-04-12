---
seoTitle: 'Kubernetes Endpoints, Headless Services, and EndpointSlices'
seoDescription: 'Explore how Kubernetes Endpoints track ready Pod IPs behind a Service, how readiness probes gate traffic, and when to use headless Services.'
---

# Services and Endpoints

You created a Service. Traffic goes in. But which Pods are actually receiving it? Is the Service load-balancing across all of them? Is it skipping a Pod that just started and isn't fully ready yet? How does the Service even know which Pods exist?

The answer to all of those questions lives in a Kubernetes object you probably haven't seen yet: the Endpoints object.

## What the Endpoints Object Does

When you create a Service with a `selector`, Kubernetes automatically creates a companion object with the same name in the same namespace. This object is called Endpoints (or, in newer clusters, EndpointSlices). It contains a live list of IP and port pairs for every Pod that matches the selector and is currently Ready.

That "and is currently Ready" part matters. A Pod that is Running but failing its readiness check is excluded from Endpoints. Traffic will not reach it. The moment the Pod passes its readiness check, it is added back. The moment it fails again, it is removed. This means the Endpoints object is updated dynamically, continuously, without any manual intervention.

kube-proxy runs on every node and watches the Endpoints object. Whenever Endpoints changes, kube-proxy updates the iptables rules on the node to reflect the current set of routable Pod IPs. From a client's perspective, the ClusterIP always resolves to a healthy Pod.

@@@
graph TD
SVC["Service: web-svc\nselector: app=web"]
EP["Endpoints: web-svc\n10.244.0.5:80\n10.244.0.6:80"]
P1["Pod: app=web\nReady\nIP: 10.244.0.5"]
P2["Pod: app=web\nReady\nIP: 10.244.0.6"]
P3["Pod: app=web\nNot Ready\nIP: 10.244.0.7"]
SVC --> EP
EP --> P1
EP --> P2
P3 -.->|"excluded: not Ready"| EP
@@@

Create the Service for the `web` Deployment you created in the previous lesson:

```bash
nano web-svc.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-svc
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
```

```bash
kubectl apply -f web-svc.yaml
```

## Inspecting the Endpoints

Now inspect what Kubernetes created for you:

```bash
kubectl get service web-svc
kubectl get endpoints web-svc
kubectl describe service web-svc
```

The `kubectl describe service web-svc` output contains an `Endpoints:` field listing the IP:port pairs of all Ready Pods that match the selector. Cross-reference that with:

```bash
kubectl get pods -l app=web -o wide
```

You should see the same Pod IPs appearing in both outputs. The Endpoints object is the live source of truth for which Pods are currently routable behind this Service.

:::quiz
What command shows the list of Pod IPs currently behind `web-svc`?

**Try it:** `kubectl get endpoints web-svc`

**Answer:** The output shows a list of `IP:port` pairs under the `ENDPOINTS` column. These are the Pod IPs that currently match the Service selector and are Ready. If no Pods are ready, the column shows `<none>`.
:::

## Understanding port and targetPort

The Service spec uses two distinct port fields:

```yaml
# illustrative only
ports:
  - port: 80 # port the Service listens on (what clients call)
    targetPort: 80 # port on the Pod to forward to (what the container listens on)
```

These two numbers are often the same, but they do not have to be. If your container listens on port `3000` but you want clients to call port `80`, you write `port: 80, targetPort: 3000`. The Service translates the port as traffic passes through.

This separation is useful when you want to standardize on port `80` for all services without forcing every container to listen on the same port.

:::quiz
A Service has `port: 8080` and `targetPort: 3000`. A client Pod sends a request to the Service on port 8080. Which port does the request arrive on at the Pod?

- Port 8080, the same as the Service port
- Port 3000, the targetPort configured in the Service spec
- The port is chosen randomly at runtime

**Answer:** Port 3000. The `port` field defines what clients use to reach the Service. The `targetPort` field defines what port Kubernetes forwards to on the matching Pods. The translation happens transparently at the Service layer.
:::

## When Endpoints Shows Nothing

:::warning
If `kubectl describe service web-svc` shows `Endpoints: <none>`, the Service selector is not matching any Ready Pod. The three most common causes are: (1) a typo in the selector key or value, (2) the Pods do not have the label the Service is looking for, or (3) all matching Pods exist but are not Ready. Run `kubectl get pods --show-labels` to compare the actual Pod labels with what the Service selector expects.
:::

Now check for yourself. The Deployment from the previous lesson uses label `app: web`. The Service selector also uses `app: web`. Confirm they match:

```bash
kubectl get pods --show-labels
```

Look at the `LABELS` column. Confirm `app=web` is present on the running Pods. This is the label the Service is selecting on. If you ever see `Endpoints: <none>` during debugging, this comparison is your first step.

:::quiz
A Pod is Running but is not included in the Service Endpoints. What is the most likely cause?

- The Pod was not created by the Deployment that owns the Service
- The Pod is Running but failing its readiness check, or its labels do not match the Service selector
- Services only include Pods that were explicitly registered

**Answer:** The Pod is Running but failing its readiness check or has non-matching labels. Services use two criteria: label match AND readiness. A Pod that is Running but not Ready is excluded from Endpoints to avoid routing traffic to an unhealthy instance.
:::

## Why a Separate Object?

Why does Kubernetes use a separate Endpoints object instead of storing Pod IPs directly inside the Service spec?

The Service is a long-lived, rarely-changed object. Its selector and port configuration are stable. Pod IPs, on the other hand, change constantly. Keeping them in a separate object lets the endpoints controller update the IP list rapidly without touching the Service spec at all. It also enables an advanced pattern: you can create a Service without a selector and manage the Endpoints object manually. This is how you can point a Kubernetes Service at an external database or a resource outside the cluster.

The separation of concerns here is deliberate, and it pays off in both performance and flexibility.

The Service and Deployment are ready. The next lesson covers the ClusterIP type in detail, how DNS makes Services discoverable by name, and when ClusterIP is the right choice versus other Service types.
