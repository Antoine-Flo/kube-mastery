---
seoTitle: 'Kubernetes NodePort, External Access, Port Range, Node IPs'
seoDescription: 'Learn how Kubernetes NodePort Services expose your application outside the cluster, how to configure the port range, and when to use NodePort.'
---

# NodePort

ClusterIP works perfectly when Pods talk to each other inside the cluster. But imagine a colleague on a different machine wants to test your web application. She opens a browser, types the ClusterIP address, and gets nothing. ClusterIP is only reachable from within the cluster network. NodePort is the simplest way to bridge that gap.

A NodePort Service opens a static port on every node in the cluster. Any request that arrives at `<node-IP>:<nodePort>` is routed to the Service, which then forwards it to one of the backing Pods. The port is always in the range 30000-32767, kept deliberately high to avoid conflicts with well-known system ports.

@@@
graph LR
    EXT["External client\n:30080"]
    N1["Node 1\n:30080"]
    N2["Node 2\n:30080"]
    SVC["Service: web-nodeport\nNodePort: 30080\nClusterIP: 10.96.0.10"]
    P1["Pod A"]
    P2["Pod B"]
    EXT --> N1
    EXT --> N2
    N1 --> SVC
    N2 --> SVC
    SVC --> P1
    SVC --> P2
@@@

One detail that surprises many people: NodePort does not replace ClusterIP, it extends it. A NodePort Service still has a ClusterIP. Internal Pods can still reach it on port 80. External clients can additionally reach it on the node port. Think of it as a superset, every capability of ClusterIP plus one more layer on top.

Why does Kubernetes keep both access paths? Because internal and external traffic serve different audiences. Removing ClusterIP when NodePort is added would break every in-cluster consumer of that Service. The two paths coexist cleanly.


Let's create one. Open the editor:

```bash
nano nodeport-svc.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-nodeport
spec:
  type: NodePort
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
```

```bash
kubectl apply -f nodeport-svc.yaml
kubectl get service web-nodeport
```

The `port` field is the ClusterIP port for internal access. The `targetPort` is the container port. The `nodePort` is what external clients hit on the node's IP address.

Now inspect the Service to see all three values together:

```bash
kubectl describe service web-nodeport
```

Look for the `Type: NodePort` line, the `NodePort:` field showing `30080/TCP`, and the `Endpoints:` field confirming that Pods were matched. The Endpoints list is the real proof that the selector is working.

:::quiz
Where in the `kubectl describe` output can you confirm that the Service is actually routing traffic to Pods?

**Try it:** `kubectl describe service web-nodeport`

**Answer:** Look at the `Endpoints:` field. It lists the IP:port of every Pod matched by the selector. An empty Endpoints list means no Pods matched, and traffic would go nowhere, even if the Service itself is correctly configured.
:::

In this simulator, you can observe the NodePort Service and inspect its state, but you cannot reach it from an external browser. The simulation runs entirely in the browser with an emulated cluster. On a real cluster with `kind`, you would run `curl localhost:30080` from your host machine and get a response from the container.

If you omit the `nodePort` field, Kubernetes selects a port automatically from the 30000-32767 range:

```yaml
# illustrative only
ports:
  - port: 80
    targetPort: 80
    # nodePort omitted: Kubernetes picks one automatically
```

This is useful when you do not care which port is used. Explicit values are better when you need a predictable, shareable URL.

:::warning
NodePort opens the port on every node in the cluster, not just the nodes that happen to be running backing Pods. A request can arrive on any node and be forwarded across the cluster to a Pod elsewhere. This is by design, but it means a high port is exposed on every node's network interface even when some nodes have no relevant Pods at all. In production environments with strict network perimeters, this broad exposure can be a concern. LoadBalancer and Ingress give you a single controlled entry point instead.
:::

:::quiz
A NodePort Service has `port: 80` and `nodePort: 30080`. A client from outside the cluster wants to reach the application. Which port should it use?

- 80, because that is the Service port
- 30080, because that is the node-level port exposed externally
- Either 80 or 30080, they both work from outside

**Answer:** 30080 - Port 80 is the ClusterIP port, reachable only from inside the cluster network. Port 30080 is the NodePort, open on every node's network interface and reachable from outside. They serve different audiences and are not interchangeable.
:::

:::quiz
Why does NodePort open the port on every node, even nodes running no backing Pods?

**Answer:** Because the node that receives the external request may not be running any of the Pods. If only nodes with local Pods accepted traffic, you would need to track which nodes have Pods at any given moment, and that changes dynamically as the scheduler moves workloads. Opening the port everywhere lets any node accept the request and route it across the cluster via the Service.
:::

Before moving on, clean up:

```bash
kubectl delete service web-nodeport
```

NodePort solves external access but at the cost of an awkward high port and exposure across every node. The next lesson introduces the LoadBalancer type, which moves that entry point to a managed cloud resource with a clean public IP address.
