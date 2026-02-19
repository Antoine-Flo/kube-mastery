# DNS Configuration

Most of the time, Kubernetes DNS "just works" — Pods resolve Service names through CoreDNS, and you don't think about it. But there are situations where you need to adjust how DNS resolution behaves: Pods with host networking, integration with external DNS servers, or performance tuning.

This lesson covers the knobs Kubernetes gives you.

## DNS Policies

Every Pod has a `dnsPolicy` that controls how DNS resolution is configured. There are four options:

| Policy | Behavior | When to Use |
|--------|----------|-------------|
| `ClusterFirst` | Use CoreDNS for cluster names, upstream for external | Default — works for most workloads |
| `ClusterFirstWithHostNet` | Same as ClusterFirst, but for Pods using host networking | When `hostNetwork: true` |
| `Default` | Use the node's DNS configuration (`/etc/resolv.conf`) | When you don't need cluster DNS |
| `None` | No automatic DNS — you must provide `dnsConfig` | Full custom control |

**ClusterFirst** is the default and handles 95% of use cases. Cluster names resolve through CoreDNS; everything else falls back to upstream DNS servers.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  dnsPolicy: ClusterFirst  # This is the default
  containers:
    - name: app
      image: myapp
```

:::info
If your Pod uses `hostNetwork: true`, it inherits the node's `/etc/resolv.conf` and **can't resolve cluster Service names** by default. Use `dnsPolicy: ClusterFirstWithHostNet` to fix this.
:::

## Custom DNS Configuration

When you need full control, set `dnsPolicy: None` and provide your own `dnsConfig`:

```yaml
spec:
  dnsPolicy: None
  dnsConfig:
    nameservers:
      - 10.0.0.1
      - 8.8.8.8
    searches:
      - mycompany.local
      - default.svc.cluster.local
    options:
      - name: ndots
        value: "2"
```

This gives you complete control over:
- **nameservers:**  Which DNS servers to query
- **searches:**  Which domains to append to short names
- **options:**  DNS resolver behavior (like `ndots`)

:::warning
With `dnsPolicy: None`, the Pod has **no DNS configuration** unless you provide `dnsConfig`. If you forget it, DNS resolution won't work at all. To keep cluster DNS working alongside custom settings, include the CoreDNS service IP in your nameservers list.
:::

## Understanding ndots

The `ndots` option controls when the DNS resolver uses the search list. With the default `ndots: 5`, any name with fewer than 5 dots goes through the search list first.

For the name `api.example.com` (2 dots, less than 5):
1. Try `api.example.com.default.svc.cluster.local` — fails
2. Try `api.example.com.svc.cluster.local` — fails
3. Try `api.example.com.cluster.local` — fails
4. Finally try `api.example.com` — succeeds

That's 3 unnecessary DNS queries. For workloads that frequently resolve external names, lowering `ndots` to `2` or using FQDNs with a trailing dot improves performance:

```yaml
dnsConfig:
  options:
    - name: ndots
      value: "2"
```

The `resolv.conf` inside a Pod shows the nameserver, search domains, and options — this is what the Pod actually uses for DNS.

---

## Hands-On Practice

### Step 1: Check a Pod's resolv.conf

```bash
kubectl run dnsconfig-demo --image=busybox --restart=Never -- sleep 3600
kubectl exec dnsconfig-demo -- cat /etc/resolv.conf
```

**Observation:** Default `ClusterFirst` gives CoreDNS as nameserver and search domains like `default.svc.cluster.local`. The `ndots: 5` option is typically present.

### Step 2: Clean Up

```bash
kubectl delete pod dnsconfig-demo
```

## Wrapping Up

Most workloads work perfectly with the default `ClusterFirst` policy. Use `ClusterFirstWithHostNet` for Pods with host networking, and `None` with `dnsConfig` for full custom control. Understanding `ndots` helps you optimize DNS performance when your Pods resolve many external names. Up next: Ingress — routing external HTTP/HTTPS traffic to your Services with host and path rules.
