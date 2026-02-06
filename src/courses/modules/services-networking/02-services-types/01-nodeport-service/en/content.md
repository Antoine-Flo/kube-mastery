# NodePort Service

A NodePort Service exposes your Service on each Node's IP address at a static port, making it accessible from outside the cluster. Think of it as opening the same door on every building (node) in your cluster, all using the same door number (port).

## How NodePort Works

When you set `type: NodePort`, Kubernetes:

- Allocates a port from a range specified by `--service-node-port-range` flag (default: 30000-32767)
- Each node in the cluster configures itself to listen on that assigned port
- Every node proxies traffic from that port to one of the ready endpoints associated with the Service
- The Service reports the allocated port in its `.spec.ports[*].nodePort` field

For a NodePort Service, Kubernetes additionally allocates a port (TCP, UDP, or SCTP to match the protocol of the Service). This means you can access your Service from outside the cluster by connecting to any node using the appropriate protocol and port.

## NodePort Example

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: NodePort
  selector:
    app.kubernetes.io/name: MyApp
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 80
      nodePort: 30007 # Optional: specify a custom port
```

In this example:

- The Service listens on port 80 internally (the Service port)
- It forwards to port 80 on Pods (the target port)
- It's exposed on port 30007 on every node (the node port)
- If you don't specify `nodePort`, Kubernetes will automatically assign one from the range

## Accessing NodePort Services

You can contact the NodePort Service from outside the cluster by connecting to any node using the appropriate protocol and the assigned port. For example: `<NodeIP>:30007`. The traffic will be automatically forwarded to one of the healthy Pods backing the Service.

The Service is visible as `<NodeIP>:spec.ports[*].nodePort` and `.spec.clusterIP:spec.ports[*].port`. This means you can access it either through the node port or through the cluster IP from within the cluster.

View the assigned node port for your Service:

```bash
kubectl get service my-service -o wide
```

## Use Cases

NodePort is useful when you want to:

- Set up your own load balancing solution in front of the nodes
- Configure environments that are not fully supported by Kubernetes
- Expose one or more nodes' IP addresses directly
- Test services in development environments

:::info
Using a NodePort gives you the freedom to set up your own load balancing solution. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport">Learn more about NodePort Services</a>
:::

:::warning
NodePort Services expose your application on every node's IP address at a high-numbered port. This can be a security concern in production environments. Consider using LoadBalancer Services or Ingress controllers for better security and management.
:::
