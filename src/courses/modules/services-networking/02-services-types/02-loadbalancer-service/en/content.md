# LoadBalancer Service

A LoadBalancer Service exposes your Service externally using an external load balancer provided by your cloud provider. It's like having a professional doorman (the cloud load balancer) that routes external visitors to your application, handling all the complexity for you.

## How LoadBalancer Works

On cloud providers that support external load balancers, setting `type: LoadBalancer` provisions a load balancer for your Service. The actual creation happens asynchronously, and information about the provisioned balancer is published in the Service's `.status.loadBalancer` field.

The cloud provider decides how the load balancer distributes traffic. Typically, it forwards traffic to the backend Pods, which Kubernetes manages automatically.

## LoadBalancer Example

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: LoadBalancer
  selector:
    app.kubernetes.io/name: MyApp
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 9376
status:
  loadBalancer:
    ingress:
      - ip: 192.0.2.127
```

In this example:

- The Service type is set to `LoadBalancer`
- It targets Pods with the label `app.kubernetes.io/name: MyApp`
- The `status.loadBalancer.ingress` field shows the external IP address assigned by the cloud provider
- Once provisioned, you can access your Service using this external IP

Check if the external IP has been assigned:

```bash
kubectl get service my-service
```

The `EXTERNAL-IP` column shows `<pending>` until the cloud provider provisions the load balancer, then displays the external IP address.

## Implementation Details

To implement a LoadBalancer Service, Kubernetes typically starts by making changes equivalent to you requesting a Service of `type: NodePort`. The cloud-controller-manager component then configures the external load balancer to forward traffic to that assigned node port.

This means a LoadBalancer Service includes all the functionality of a NodePort Service, plus the external load balancer configuration.

## Cloud Provider Integration

The behavior of LoadBalancer Services depends on your cloud provider. Each provider has its own implementation for creating and configuring the external load balancer:

- **AWS**: Creates an Elastic Load Balancer (ELB)
- **GCP**: Creates a Network Load Balancer
- **Azure**: Creates an Azure Load Balancer

Traffic from the external load balancer is directed at the backend Pods. The cloud provider handles health checks, SSL termination, and other advanced features according to their implementation.

:::info
LoadBalancer Services are the standard way to expose applications externally on cloud platforms. They automatically provision and configure the cloud provider's load balancer for you. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#loadbalancer">Learn more about LoadBalancer Services</a>
:::

:::warning
LoadBalancer Services require a cloud provider that supports external load balancers. If you're running Kubernetes on-premises or in an environment without cloud provider integration, LoadBalancer Services may not work. In such cases, consider using NodePort or Ingress.
:::
