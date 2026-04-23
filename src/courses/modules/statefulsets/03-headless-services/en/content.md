---
seoTitle: 'Kubernetes Headless Service, StatefulSet DNS, clusterIP None'
seoDescription: 'Learn what a Kubernetes headless service is, how it provides per-Pod DNS records for StatefulSets, and how to use DNS to reach individual StatefulSet Pods.'
---

# Headless Services

A regular Service provides a single stable virtual IP (ClusterIP) that load-balances across all matching Pods. You send traffic to the ClusterIP, and kube-proxy distributes it. Individual Pods are hidden behind the virtual IP.

A headless Service has `clusterIP: None`. There is no virtual IP. Instead, DNS returns the actual IP addresses of each matching Pod directly. For StatefulSets, DNS returns one record per Pod, using the Pod's stable name. This enables direct Pod-to-Pod addressing that survives restarts.

## Creating a headless Service

The only difference from a regular Service is `clusterIP: None`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-headless
spec:
  clusterIP: None
  selector:
    app: web
  ports:
    - port: 80
      name: web
```

```bash
kubectl get service web-headless
```

The `CLUSTER-IP` column shows `None`. There is no virtual IP for this service.

## DNS for StatefulSet Pods

When a headless Service is paired with a StatefulSet via `serviceName`, each Pod gets its own DNS A record:

```
<pod-name>.<service-name>.<namespace>.svc.cluster.local
```

For our `web` StatefulSet with `serviceName: web-headless` in the `default` namespace:
- `web-0.web-headless.default.svc.cluster.local` resolves to the IP of `web-0`
- `web-1.web-headless.default.svc.cluster.local` resolves to the IP of `web-1`
- `web-2.web-headless.default.svc.cluster.local` resolves to the IP of `web-2`

@@@
graph LR
subgraph dns ["DNS: headless service"]
  SRV["web-headless"] --> D0["web-0.web-headless -> 10.0.0.1"]
  SRV --> D1["web-1.web-headless -> 10.0.0.2"]
  SRV --> D2["web-2.web-headless -> 10.0.0.3"]
end
subgraph regular ["DNS: regular service"]
  SRV2["web-regular\nClusterIP: 10.96.1.1"] --> LB["Load balanced\nacross all Pods"]
end
@@@

Test DNS resolution from inside a Pod:

```bash
kubectl exec web-0 -- nslookup web-1.web-headless.default.svc.cluster.local
```

This returns the actual IP of `web-1`. If `web-1` restarts and gets a new IP, the DNS record updates to the new IP automatically. The DNS name `web-1.web-headless...` remains stable even as the underlying IP changes.

:::quiz
A StatefulSet Pod restarts and gets a new IP address. Another Pod was communicating with it using the Pod-specific DNS name. Does the other Pod need to reconnect or update its DNS cache?

**Answer:** It needs to re-resolve the DNS name (which happens naturally if the DNS TTL expires). The DNS name `web-1.web-headless.default.svc.cluster.local` still works, but it now points to the new IP. TCP connections established before the restart are broken and must be re-established. DNS-based reconnection works because the name is stable even though the IP changed.
:::

## DNS for the entire StatefulSet

A DNS query for just the Service name (without a Pod prefix) on a headless Service returns all Pod IPs:

```bash
kubectl exec web-0 -- nslookup web-headless
```

This returns multiple A records, one for each ready Pod. This is useful for initial cluster discovery: a new node can find all existing members by querying the service name, then communicate with specific members by their individual names.

This contrasts with a regular ClusterIP Service, where `nslookup web-regular` returns only the single ClusterIP, hiding the individual Pods.

## Regular Service alongside headless Service

StatefulSets often use both types of Services:

- **Headless Service** (used as `serviceName`): provides stable per-Pod DNS, used by cluster members to communicate with each other
- **Regular ClusterIP or NodePort Service**: provides a load-balanced endpoint for clients that do not need to reach a specific Pod (e.g., read traffic to any replica)

```yaml
# Regular Service for client access (routes to any ready Pod)
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
```

With both Services, clients connect to `web` (load-balanced), while cluster nodes communicate via `web-0.web-headless`, `web-1.web-headless`, etc.

:::warning
The headless Service must exist before the StatefulSet is created, or the DNS records will not be set up. If the Service is created after the StatefulSet, the existing Pods do not automatically get DNS entries. In practice, always define the headless Service in the same manifest file, before the StatefulSet, to ensure correct ordering on `kubectl apply`.
:::

:::quiz
You have a headless Service `db-headless` for a StatefulSet `db`. A client Pod queries `db-headless`. What does it receive?

**Answer:** A list of A records, one for each ready Pod in the StatefulSet. For a 3-replica StatefulSet, the DNS response contains three IP addresses (db-0's IP, db-1's IP, db-2's IP). The client can then choose which to connect to, or connect to all of them for replication setup.
:::

The headless Service is the bridge between the StatefulSet's stable Pod names and stable network addressing. The next lesson covers how StatefulSets manage persistent storage with dedicated PVCs for each Pod.
