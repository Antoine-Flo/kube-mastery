---
seoTitle: 'Kubernetes LoadBalancer Service, Cloud Provisioning and Cost'
seoDescription: 'Explore how Kubernetes LoadBalancer Services provision cloud load balancers automatically, expose a stable external IP, and when to use them.'
---

# LoadBalancer

NodePort gets traffic into the cluster, but it comes with a noticeable rough edge. The port is 30080, not 80. Users have to type a port number in the URL. You also have to tell them which node IP to use, and node IPs change when nodes are replaced or restarted. For any real production service that end users access directly, that is not acceptable.

In cloud environments, there is a cleaner solution. The `LoadBalancer` Service type instructs the cloud provider to provision an external load balancer in front of the cluster and assign it a stable public IP. Traffic hitting that IP on port 80 reaches the load balancer, which routes it into the cluster transparently. Users never see node ports or node IPs.

@@@
graph LR
    USER["User\ncurl http://1.2.3.4"]
    LB["Cloud Load Balancer\nExternal IP: 1.2.3.4"]
    SVC["Service: web-lb\ntype: LoadBalancer\nNodePort: 31234"]
    P1["Pod A"]
    P2["Pod B"]
    USER --> LB
    LB --> SVC
    SVC --> P1
    SVC --> P2
@@@

LoadBalancer is a superset of NodePort, which is itself a superset of ClusterIP. Creating a LoadBalancer Service automatically creates a NodePort and a ClusterIP as well. The cloud load balancer routes traffic into the cluster via the NodePort. From there, the Service forwards it to the Pods as usual. Each layer adds a capability without removing the previous one.


Let's create one:

```bash
nano lb-svc.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-lb
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
```

```bash
kubectl apply -f lb-svc.yaml
kubectl get service web-lb
```

In the simulator, the `EXTERNAL-IP` column will show `<pending>`. That is expected: there is no cloud provider connected to this emulated cluster, so no load balancer can be provisioned. On a real cloud cluster running on GKE, EKS, or AKS, the external IP typically appears within a minute.

:::info
On local clusters like `kind` or `minikube`, LoadBalancer Services also stay `<pending>` without extra tooling. You can install MetalLB to make it work on `kind`, or run `minikube tunnel` on Minikube. The simulator behaves the same way as a bare-metal cluster with no cloud integration.
:::

:::quiz
You create a LoadBalancer Service and `EXTERNAL-IP` shows `<pending>` for 10 minutes. What is the most likely explanation?

- The Service selector is not matching any Pods
- The cluster is not connected to a cloud provider that supports automatic load balancer provisioning
- LoadBalancer Services always take 10 minutes to provision

**Answer:** The cluster is not connected to a supported cloud provider - The selector can still match Pods even when EXTERNAL-IP is pending (verify with `kubectl describe`). Provisioning on real cloud clusters typically takes under two minutes. The pending state is permanent on clusters without cloud integration, not a timing issue.
:::

Even without an external IP, the Service is fully functional inside the cluster. Inspect it to confirm:

```bash
kubectl describe service web-lb
```

Note that `NodePort` and `ClusterIP` are already assigned in the output. Internal Pods can reach the Service via its ClusterIP. The NodePort is open on all nodes. The only thing missing is the external IP.

Why does the cloud load balancer route through the NodePort rather than going directly to Pods? Because the load balancer lives outside the cluster network and cannot reach Pod IPs. The NodePort is the reachable address on the node's public network interface. The load balancer hits a node on that port, then kube-proxy forwarding takes over inside the cluster.

:::quiz
Why is LoadBalancer a superset of NodePort rather than a completely independent mechanism?

**Answer:** Because the cloud load balancer itself cannot reach Pod IPs directly. It routes traffic into the cluster by hitting the NodePort on one of the nodes, and from there kube-proxy forwards the request to the correct Pod. The layers stack: cloud LB targets node:nodePort, then the Service routes to a Pod. Removing the NodePort layer would require the cloud provider to have direct access to the cluster's internal network, which is not how cloud infrastructure works.
:::

:::warning
Every LoadBalancer Service on a cloud provider provisions a separate cloud load balancer. On AWS and GCP, that typically costs $10-30 per month per Service. A cluster with 20 Services of type LoadBalancer accumulates significant infrastructure cost. For HTTP services, an Ingress resource routing multiple Services through a single load balancer is the standard cost-efficient alternative.
:::

Clean up before continuing:

```bash
kubectl delete service web-lb
```

LoadBalancer is the simplest path to a stable external IP on cloud infrastructure, but it comes with a per-Service cost and relies on cloud provider integration. The next lesson introduces named ports, a small but resilient feature that keeps Service configuration correct when container port numbers change.
