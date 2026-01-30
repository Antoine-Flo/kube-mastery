# Service Discovery

Kubernetes supports two primary modes of finding a Service: environment variables and DNS. Both methods allow Pods to discover and connect to Services without hard-coding IP addresses.

## Environment Variables

When a Pod runs on a Node, the kubelet automatically adds environment variables for each active Service in the same namespace. For a Service named `redis-primary` that exposes TCP port 6379 with cluster IP 10.0.0.11, it creates:

```bash
REDIS_PRIMARY_SERVICE_HOST=10.0.0.11
REDIS_PRIMARY_SERVICE_PORT=6379
REDIS_PRIMARY_PORT=tcp://10.0.0.11:6379
REDIS_PRIMARY_PORT_6379_TCP=tcp://10.0.0.11:6379
REDIS_PRIMARY_PORT_6379_TCP_PROTO=tcp
REDIS_PRIMARY_PORT_6379_TCP_PORT=6379
REDIS_PRIMARY_PORT_6379_TCP_ADDR=10.0.0.11
```

The Service name is converted to uppercase, and dashes become underscores. This provides multiple ways to access the Service information from your application code.

:::warning
If you use environment variables for service discovery, you must create the Service **before** the client Pods. Otherwise, those Pods won't have their environment variables populated. This ordering requirement can be problematic in some scenarios.
:::

## DNS Discovery

DNS is the recommended and more flexible method for service discovery. A cluster-aware DNS server (like CoreDNS) watches the Kubernetes API for new Services and automatically creates DNS records for each one.

For a Service named `my-service` in namespace `my-ns`:
- Pods in the same namespace (`my-ns`) can resolve it simply as `my-service`
- Pods in other namespaces must use the fully qualified name: `my-service.my-ns`
- The DNS name resolves to the Service's cluster IP address

## DNS Benefits

DNS discovery doesn't require Services to be created before Pods, it works regardless of creation order. It's more flexible, doesn't require code changes to read environment variables, and is the preferred method for service discovery in Kubernetes.

Additionally, Kubernetes supports DNS SRV (Service) records for named ports. If your Service has a port named `http` with protocol TCP, you can query `_http._tcp.my-service.my-ns` to discover both the port number and IP address.

:::info
DNS is the recommended method for service discovery in Kubernetes. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#discovering-services">Learn more about service discovery</a>
:::
