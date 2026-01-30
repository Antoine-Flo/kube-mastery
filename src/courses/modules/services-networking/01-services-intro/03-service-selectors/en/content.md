# Service Selectors

Services use label selectors to determine which Pods they should target. Think of selectors as a filter that tells the Service: "Send traffic to all Pods that have these specific labels."

## How Selectors Work

The Service's `.spec.selector` field defines which Pods the Service targets using label matching. For example:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app.kubernetes.io/name: MyApp
    tier: backend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

This Service will route traffic to all Pods that have both labels: `app.kubernetes.io/name: MyApp` and `tier: backend`. The selector acts like a query that finds matching Pods.

## EndpointSlices

When a Service has a selector, Kubernetes automatically creates EndpointSlice objects. These objects represent the network endpoints (Pods) that match the Service's selector.

The Service controller continuously scans for Pods that match the selector and updates the EndpointSlices accordingly. This happens automatically, you don't need to manage EndpointSlices manually when using selectors.

## Pod-Service Association

Pods are associated with a Service based on their labels matching the Service's selector. When a Pod's labels match a Service selector, that Pod becomes an endpoint for the Service and receives traffic sent to the Service's cluster IP.

For example, if you have three Pods with the label `app.kubernetes.io/name: MyApp`, all three will receive traffic from the Service, and Kubernetes will load-balance requests across them.

## Multiple Pods and Load Balancing

A Service can target multiple Pods. Traffic sent to the Service's cluster IP is automatically load-balanced across all Pods that match the selector. If one Pod becomes unhealthy or is deleted, the Service automatically stops sending traffic to it and continues routing to the remaining healthy Pods.

:::command
List Pods that match your Service's selector:

```bash
kubectl get pods -l app.kubernetes.io/name=MyApp,tier=backend
```

<a target="_blank" href="https://kubernetes.io/docs/reference/kubectl/generated/kubectl_get/">Learn more about label selectors</a>
:::

:::info
The set of Pods targeted by a Service is usually determined by a selector. <a target="_blank" href="https://kubernetes.io/docs/concepts/services-networking/service/#defining-a-service">Learn more about Service selectors</a>
:::
