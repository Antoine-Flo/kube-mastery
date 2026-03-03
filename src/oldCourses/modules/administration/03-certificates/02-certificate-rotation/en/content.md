# Certificate Rotation

Certificates don't last forever — most Kubernetes certificates expire after one year. When they do, TLS handshakes fail, components can't communicate, and your cluster becomes unreachable. Certificate rotation is routine maintenance, but it needs to be planned and executed carefully.

The good news: on kubeadm clusters, the process is straightforward. Let's walk through it step by step.

## Why You Can't Skip Rotation

When a certificate expires, any component that uses it will fail to establish TLS connections. The API server becomes unreachable, kubelets can't report status, and etcd members can't replicate data. It's one of the most common causes of cluster outages — and one of the most preventable.

Think of it like a driver's license. It works perfectly fine until the expiration date, and then suddenly it doesn't. The solution is simple: renew it before it expires.

## Checking Certificate Expiration

Before rotating, see what you're working with. On kubeadm clusters:

```bash
# Show all certificates and their expiration dates
kubeadm certs check-expiration

# Check a specific certificate
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -dates
```

The `kubeadm certs check-expiration` command gives you a complete picture: every certificate, its CA, and exactly when it expires. Set a calendar reminder for at least a month before the earliest expiration.

:::info
Starting with Kubernetes 1.21, kubeadm automatically renews certificates during `kubeadm upgrade`. If you upgrade your cluster regularly (at least once a year), certificates are renewed as part of the process. But don't rely on this — always verify expiration dates.
:::

## Step-by-Step Rotation on kubeadm

Here's the process for renewing control plane certificates:

**Step 1: Back up your PKI directory:** Always back up before making changes.

```bash
cp -r /etc/kubernetes /etc/kubernetes.backup
```

**Step 2: Renew all certificates**

```bash
kubeadm certs renew all
```

This regenerates all control plane certificates, signed by the same CA. The certificates are now valid for another year (or whatever the configured duration is).

**Step 3: Restart control plane components:** The renewed certificates are on disk, but the running components are still using the old ones loaded in memory. You need to restart them.

```bash
# Restart the API server (move manifest out and back)
mv /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/
# Wait a few seconds for the Pod to terminate
mv /tmp/kube-apiserver.yaml /etc/kubernetes/manifests/

# Repeat for controller-manager
mv /etc/kubernetes/manifests/kube-controller-manager.yaml /tmp/
mv /tmp/kube-controller-manager.yaml /etc/kubernetes/manifests/

# Repeat for scheduler
mv /etc/kubernetes/manifests/kube-scheduler.yaml /tmp/
mv /tmp/kube-scheduler.yaml /etc/kubernetes/manifests/
```

:::warning
Restart components **one at a time** and wait for each to come back before moving to the next. For multi-master clusters with etcd, coordinate restarts carefully to maintain quorum — never restart more than one etcd member at a time.
:::

**Step 4: Verify the renewal**

```bash
# Check new expiration dates
kubeadm certs check-expiration

# Verify the specific certificate
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -dates

# Confirm the cluster is healthy
kubectl get nodes
kubectl get pods -A
```

## Component Restart Order

For minimal disruption, follow this order:

1. **API server:** Clients will briefly lose connectivity but reconnect automatically
2. **Controller-manager:** Manages controllers; brief pause in reconciliation
3. **Scheduler:** Brief pause in scheduling new Pods
4. **etcd:** Only if etcd certificates were rotated; coordinate one member at a time on multi-node etcd

## Kubelet Certificate Rotation

The kubelet can rotate its own certificates automatically. When enabled, the kubelet requests a new certificate from the API server before the current one expires. This is configured with:

- **`--rotate-certificates`:** Enables automatic kubelet client certificate rotation
- **`--rotate-server-certificates`:** Enables automatic kubelet serving certificate rotation

On most modern clusters, kubelet certificate rotation is enabled by default. You can verify:

```bash
# Check kubelet certificate
openssl x509 -in /var/lib/kubelet/pki/kubelet-client-current.pem -noout -dates
```

## Cloud-Managed Clusters

If you're running on a managed service (EKS, GKE, AKS), the provider handles control plane certificate rotation automatically. You don't need to worry about API server, etcd, or controller-manager certificates. However, you may still need to manage:

- Worker node certificates (usually auto-rotated)
- Client certificates in your kubeconfig (check provider documentation)

## Wrapping Up

Certificate rotation is a scheduled maintenance task that prevents one of the most common cluster outages. On kubeadm clusters, it's a three-step process: back up, renew with `kubeadm certs renew all`, and restart components one at a time. Always verify the new expiration dates afterward. In the next lesson, we'll look at kubeconfig and client certificates — how users authenticate to the cluster.
