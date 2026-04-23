---
seoTitle: 'Kubernetes Ambassador and Adapter Container Patterns'
seoDescription: 'Learn the Kubernetes ambassador and adapter container patterns, how they abstract outbound connections and normalize output formats, with practical examples.'
---

# Ambassador and Adapter Patterns

The sidecar pattern is broad. Two specific variations have names because they solve recurring problems with distinct structures. Understanding the ambassador and adapter patterns by name is expected on the CKA exam and in design discussions.

## The ambassador pattern: abstracting outbound access

An ambassador container sits between the main container and an external service. The main container always connects to `localhost:<port>`. The ambassador handles the actual connection to the external service, which might be in a different environment, require credentials, or use connection pooling.

The key insight: the application does not need to know where the real service is or how to connect to it. The ambassador handles that. The application code does not change between environments. Only the ambassador's configuration changes.

@@@
graph LR
APP["Main container\nconnects to\nlocalhost:5432"] --> AMB["Ambassador container\nproxies to real DB\nhandles auth/TLS"]
AMB --> DB["External database\nproduction.db:5432\n(TLS, credentials)"]
@@@

A concrete scenario: a development database is at `localhost:5432`. In production, the database is a managed service with TLS and credentials. Without the ambassador pattern, the application code must handle two connection paths. With it, the application always connects to `localhost:5432`. The ambassador sidecar handles the real connection.

```bash
nano ambassador-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ambassador-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          while true; do
            echo "connecting to localhost:8888"
            sleep 5
          done
    - name: ambassador
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          echo "ambassador: proxying connections to external-service:8888"
          sleep 3600
```

```bash
kubectl apply -f ambassador-pod.yaml
kubectl logs ambassador-pod -c app
kubectl logs ambassador-pod -c ambassador
```

The two containers run independently. In production, the ambassador would be a real proxy like Envoy configured with the external service's credentials, while the application code only ever sees `localhost`.

:::quiz
The ambassador pattern is useful when:

- The application needs to connect to many external services simultaneously
- The application code should not change between environments, but the external service location and auth differ
- Two containers need to share files

**Answer:** The ambassador pattern is useful when the application should not change between environments. The application always connects to localhost, and the ambassador sidecar handles the environment-specific connection details (different hosts, credentials, TLS configuration). This keeps application code environment-agnostic.
:::

## The adapter pattern: normalizing output

An adapter container transforms the output of the main container into a format that an external system expects. The main container produces data in its natural format. The adapter converts or enriches it before forwarding.

The most common real-world example: a legacy application emits metrics in a proprietary format. Prometheus expects a specific text-based exposition format. An adapter sidecar reads the legacy metrics and exposes them in the Prometheus format.

@@@
graph LR
APP["Main container\nexposes metrics in\nproprietary format\nlocalhost:8080/stats"] --> ADP["Adapter container\nconverts to\nPrometheus format\nlocalhost:9090/metrics"]
ADP --> PROM["Prometheus scraper\nreads standardized\nmetrics"]
@@@

The application container does not change. The adapter handles the translation. When Prometheus changes its format, only the adapter is updated.

```bash
nano adapter-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: adapter-pod
spec:
  containers:
    - name: legacy-app
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          while true; do
            echo "stats: requests=42 errors=1 latency_ms=120"
            sleep 5
          done
    - name: metrics-adapter
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          while true; do
            echo "# HELP http_requests_total Total requests"
            echo "http_requests_total 42"
            echo "http_errors_total 1"
            sleep 5
          done
```

```bash
kubectl apply -f adapter-pod.yaml
kubectl logs adapter-pod -c legacy-app
kubectl logs adapter-pod -c metrics-adapter
```

The legacy app produces one format. The adapter produces a normalized format that monitoring systems understand.

:::quiz
An application writes logs in a format that the company's log aggregation system does not support. You cannot modify the application. How does the adapter pattern solve this?

**Answer:** Add an adapter sidecar container that reads the application's log output (via a shared volume or through stdout forwarding) and transforms it into the format the aggregation system expects. The application code does not change. The adapter handles the format translation. When the aggregation system changes its format requirements, only the adapter is updated.
:::

## Comparing the three patterns

| Pattern | Direction | Purpose |
|---|---|---|
| Sidecar | Supplementary | Extends the main container with additional behavior |
| Ambassador | Outbound | Abstracts and proxies connections to external services |
| Adapter | Output transformation | Normalizes the main container's output for external consumers |

All three use the same mechanics: shared volumes or localhost communication within a Pod. The names describe the intent, not a different technical mechanism.

```bash
kubectl delete pod ambassador-pod adapter-pod
```

:::warning
On the CKA exam, you may be asked to identify which pattern applies to a described scenario. Focus on the direction and purpose: outbound abstraction is ambassador, output normalization is adapter, supplementary augmentation is sidecar. The exam does not require implementing the networking or conversion logic, only correctly structuring the Pod manifest with the right containers.
:::

The ambassador abstracts where you connect; the adapter normalizes what you produce. Both are specializations of the general sidecar concept. The next lesson covers init containers, which run before the main containers start and are designed for one-time setup tasks.
