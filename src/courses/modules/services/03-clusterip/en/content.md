---
seoTitle: 'Kubernetes ClusterIP Services, kube-proxy, Virtual IP, Port Mapping'
seoDescription: 'Learn how Kubernetes ClusterIP Services work as the default type, how kube-proxy routes traffic via iptables, and why a virtual IP is better than direct Pod IPs.'
---

# ClusterIP

You have a frontend Pod that needs to call a backend API. The frontend doesn't know any backend Pod IPs because they keep changing. You created a Service in the previous lesson. But how does the frontend Pod actually call it?

Two options exist. You can target the ClusterIP address directly. Or you can use the DNS name Kubernetes automatically creates for every Service. Both reach the same place. This lesson focuses on the ClusterIP itself and how kube-proxy routes traffic through it. The DNS module covers name resolution in full.

## The Default Service Type

ClusterIP is the default Service type in Kubernetes. When you create a Service and omit the `type` field, Kubernetes creates a ClusterIP Service. It assigns the Service a virtual IP address from a reserved internal range, typically something like `10.96.x.x`. This address is only reachable from inside the cluster. Pods on any node can reach it. Nothing outside the cluster can.

ClusterIP is the right choice for internal communication: a frontend calling a backend, an application calling a cache, a worker calling an internal API. It is not meant for exposing applications to external users.

@@@
graph LR
FE["Frontend Pod\nnamespace: default"]
SVC["Service: api-svc\nClusterIP: 10.96.0.10\nDNS: api-svc.default.svc.cluster.local"]
BE1["Backend Pod 1"]
BE2["Backend Pod 2"]
FE -->|"curl api-svc"| SVC
SVC --> BE1
SVC --> BE2
@@@

Create a ClusterIP Service explicitly so you can see the `type` field in action:

```bash
nano clusterip-svc.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-svc
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
```

```bash
kubectl apply -f clusterip-svc.yaml
kubectl get service api-svc
```

Look at the `TYPE` column, which shows `ClusterIP`, and the `CLUSTER-IP` column, which shows the virtual IP Kubernetes assigned. Note that IP. It is stable for the entire lifetime of this Service object.

:::info
Every Service also gets a DNS name managed by CoreDNS: `<name>.<namespace>.svc.cluster.local`. Using the DNS name is preferable to hardcoding the ClusterIP, because the name stays constant even if the Service is deleted and recreated. The DNS module covers the full naming scheme, search domains, and cross-namespace resolution.
:::

## Inspecting ClusterIP Details

For a more complete view:

```bash
kubectl describe service api-svc
```

The output includes the assigned `IP:`, the `Port:` and `TargetPort:`, the `Selector:`, and the `Endpoints:` field showing which Pod IPs are currently behind the Service. This single command gives you the full picture of a Service's configuration and current routing state.

:::info
The ClusterIP is not routable from outside the cluster. It only exists within the cluster network. If you attempt to reach it from your laptop or from outside the cluster, the request will not arrive. External access requires a different Service type, such as NodePort or LoadBalancer, or a Gateway API resource. Those are covered in the following lessons.
:::

## Why a Virtual IP and Not Direct Pod IPs?

Why does kube-proxy use a virtual IP at all? Why not just load-balance DNS round-robin across Pod IPs directly?

The virtual IP provides a stable reference point for iptables rules. kube-proxy programs every node with a rule: "traffic to `10.96.0.10:80` should be forwarded to one of these Pod IPs." When Pods change, only the iptables rules need updating. The ClusterIP never changes, which means clients maintain existing TCP connections without any interruption.

DNS round-robin, by contrast, requires clients to re-resolve the name for every connection and handle Pod IP changes themselves. The ClusterIP abstraction moves that responsibility entirely out of application code and into the Kubernetes network layer.

:::warning
ClusterIP addresses are assigned from a reserved range (typically `10.96.0.0/12`). You cannot choose a specific IP. Kubernetes assigns it at Service creation time. If you need a predictable, human-readable reference, use the DNS name. The DNS name never changes as long as the Service exists. The ClusterIP technically could change if the Service is deleted and recreated.
:::

:::quiz
Why does Kubernetes assign a virtual IP (ClusterIP) to a Service instead of exposing Pod IPs directly to clients?

**Answer:** A virtual IP provides a stable, unchanging reference point. Clients connect to the ClusterIP; kube-proxy intercepts that traffic and forwards it to a currently healthy Pod. When Pods are replaced and their IPs change, only the iptables rules on the nodes are updated. The ClusterIP itself never changes, so no client reconfiguration is needed. This moves the complexity of Pod IP churn entirely out of application code.
:::

## Cleanup and What Comes Next

You no longer need the extra Service from this lesson:

```bash
kubectl delete service api-svc
```

Keep `web-svc` and the `web` Deployment running. The next lesson introduces NodePort, which extends the ClusterIP type to make a Service reachable from outside the cluster on a port on each node's IP address.
