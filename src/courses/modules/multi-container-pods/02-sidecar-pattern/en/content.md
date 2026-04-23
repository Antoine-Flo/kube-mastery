---
seoTitle: 'Kubernetes Sidecar Container Pattern, Log Shipping, Metrics'
seoDescription: 'Learn the Kubernetes sidecar pattern: how a helper container augments the main container without modifying it, using shared volumes and localhost communication.'
---

# The Sidecar Pattern

A sidecar is a helper container that extends the behavior of the main application container without modifying it. The main container does its job. The sidecar handles a cross-cutting concern: log shipping, metrics collection, TLS termination, or config file watching. The two containers run side by side in the same Pod, sharing a volume or talking over localhost.

The value of the sidecar pattern is separation of concerns. The application container does not need to know about log shipping. The log shipper does not need to know what the application does. Each can be updated, replaced, or configured independently.

## A concrete example: log shipping

Your application writes logs to a file. A sidecar reads those logs and ships them to a central logging service. The application does not need a logging library, an API key, or any knowledge of the logging infrastructure.

```bash
nano log-sidecar.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: log-sidecar
spec:
  containers:
    - name: app
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          while true; do
            echo "{\"ts\":\"$(date -Iseconds)\",\"msg\":\"request processed\"}" >> /var/log/app/app.log
            sleep 2
          done
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
    - name: log-shipper
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          while true; do
            if [ -f /var/log/app/app.log ]; then
              tail -1 /var/log/app/app.log
            fi
            sleep 3
          done
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
  volumes:
    - name: log-volume
      emptyDir: {}
```

```bash
kubectl apply -f log-sidecar.yaml
```

@@@
graph LR
subgraph pod ["Pod: log-sidecar"]
  APP["Container: app\nwrites JSON logs to\n/var/log/app/app.log"]
  SHD["Container: log-shipper\nreads log file\nforwards to collector"]
  VOL["/var/log/app\n(emptyDir volume)"]
  APP --> VOL
  VOL --> SHD
end
COLLECTOR["External log collector\n(e.g., Elasticsearch)"]
SHD -->|"ships"| COLLECTOR
@@@

```bash
kubectl logs log-sidecar -c app
kubectl logs log-sidecar -c log-shipper
```

The `app` container produces JSON log lines. The `log-shipper` reads them. Both streams are visible independently through kubectl.

:::quiz
In the sidecar pattern, can the application container communicate with the sidecar directly over the network?

**Answer:** Yes. Both containers share the same network namespace and the same IP address. The application can reach the sidecar at `localhost:<port>` and vice versa, without going through a Service. This enables patterns like an application writing metrics to `localhost:9090` which a Prometheus exporter sidecar reads and exposes.
:::

## The sidecar and the main container are peers

Unlike init containers (covered in lesson 4), sidecars start at the same time as the main container. They run for the lifetime of the Pod. Neither one has priority over the other unless you use the native sidecar feature covered in lesson 5.

One consequence: if the sidecar crashes, the main container keeps running but the log shipment stops. The Pod shows `1/2 READY`. The sidecar will be restarted by the kubelet, but there is a window of missed logs.

```bash
kubectl describe pod log-sidecar
```

Check that both containers show `State: Running` and `Ready: true`. If the log-shipper crashes, it will show `Restarts: N` in the container section while the app container has `Restarts: 0`.

:::warning
Do not make the sidecar do work that the main application depends on to function. If the sidecar fails and the application becomes unable to serve requests as a result, they are too tightly coupled for the sidecar pattern. A sidecar handles supplementary concerns. The application must continue working correctly even if the sidecar is temporarily unavailable.
:::

## Common sidecar use cases

- **Log forwarding**: read log files from a shared volume, ship to a centralized logging stack
- **Metrics collection**: expose application metrics from `localhost` as a Prometheus scrape endpoint
- **TLS termination**: accept TLS traffic on a sidecar proxy, forward plain HTTP to the application on localhost
- **Config reload**: watch a ConfigMap-mounted config file and send a reload signal to the main process
- **Service mesh proxies**: Istio's Envoy proxy is injected as a sidecar to intercept all traffic

:::quiz
Your application does not support TLS natively. You want to expose it over HTTPS. How would you use the sidecar pattern?

**Answer:** Add a TLS-terminating proxy container (like Nginx or Envoy) as a sidecar. The proxy listens on port 443 with a TLS certificate (mounted from a Secret), and forwards plain HTTP traffic to `localhost:<app-port>`. The application code does not change. The certificate can be rotated by updating the Secret, and the sidecar picks it up from the volume mount.
:::

```bash
kubectl delete pod log-sidecar
```

The sidecar pattern decouples supplementary behavior from the main application. Each container has a single responsibility, both are independently updatable, and the shared volume or localhost network connects them. The next lesson covers the ambassador and adapter patterns, two variations that apply the same principle to specific communication scenarios.
