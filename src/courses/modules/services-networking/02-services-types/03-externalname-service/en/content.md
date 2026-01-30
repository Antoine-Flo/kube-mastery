# ExternalName Service

An ExternalName Service maps a Service to a DNS name instead of to Pods using selectors. Think of it as a DNS alias that points to an external service, allowing you to reference external resources using Kubernetes Service names.

## How ExternalName Works

Services of type ExternalName map a Service to a DNS name. You specify these Services with the `spec.externalName` parameter. Unlike other Service types, ExternalName Services don't use selectors and don't proxy traffic, they simply provide a DNS-level redirection.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: prod
spec:
  type: ExternalName
  externalName: my.database.example.com
```

In this example, the Service `my-service` in the `prod` namespace maps to the external DNS name `my.database.example.com`.

## DNS Resolution

When looking up the host `my-service.prod.svc.cluster.local`, the cluster DNS Service returns a CNAME record with the value `my.database.example.com`. Accessing `my-service` works the same way as other Services, but redirection happens at the DNS level rather than via proxying or forwarding.

This means:
- No proxying or forwarding is set up
- The DNS server handles the redirection
- Clients connect directly to the external service
- No load balancing is performed by Kubernetes

## Use Cases

ExternalName Services are useful for:
- **External databases**: Pointing to an external database cluster in production while using local databases in test environments
- **Cross-cluster services**: Referencing Services in different namespaces or on another cluster
- **Gradual migration**: Migrating workloads to Kubernetes gradually, where only a portion of backends run in Kubernetes
- **Abstraction**: Providing a consistent Service name that can point to different backends (internal or external) depending on the environment

## Important Considerations

ExternalName Services may have issues with some common protocols like HTTP and HTTPS. This is because the hostname used by clients inside your cluster (e.g., `my-service.prod.svc.cluster.local`) is different from the name that the ExternalName references (e.g., `my.database.example.com`).

For HTTP requests, this means:
- The `Host:` header will contain the Service name, which the origin server may not recognize
- TLS servers may not be able to provide a certificate matching the hostname that the client connected to

For these reasons, ExternalName is best suited for services that don't rely on hostname-based routing or TLS certificate validation.

:::info
ExternalName Services provide DNS-level redirection without proxying. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#externalname">Learn more about ExternalName Services</a>
:::

:::warning
You may have trouble using ExternalName for some common protocols, including HTTP and HTTPS, because the hostname used by clients differs from the name that the ExternalName references. Consider using headless Services with manually created EndpointSlices for more control.
:::
