# Kubernetes PKI Overview

Every time `kubectl` talks to the API server, every time a kubelet reports node status, every time etcd replicates data — all of this communication is encrypted and authenticated using certificates. Kubernetes relies on a **Public Key Infrastructure (PKI)** to make this happen.

If that sounds intimidating, don't worry. The concepts are simpler than they seem, and understanding them is essential for troubleshooting connection issues and keeping your cluster secure.

## Why Kubernetes Needs a PKI

Imagine a busy office building with many departments (components). Everyone needs to communicate, but they also need to verify who they're talking to. You wouldn't hand confidential financial data to someone who just *claims* to be from accounting — you'd want to see their badge first.

That's exactly what certificates do in Kubernetes. Each component has a certificate (its "badge") signed by a trusted Certificate Authority (CA). When two components communicate, they check each other's certificates against the CA. If the certificate is valid, communication proceeds over an encrypted TLS connection. If not, the connection is refused.

## The Certificate Hierarchy

At the top of the hierarchy is the **cluster CA** (Certificate Authority). It's the root of trust — every other certificate in the cluster is signed by it. Here's what the main certificates cover:

- **API server** — Has its own certificate so clients (kubectl, kubelets, controllers) can verify they're talking to the real API server
- **kubelet** — Holds client certificates for authenticating to the API server
- **etcd** — Uses peer certificates for cluster communication between etcd members, and server certificates for API server access
- **Front-proxy CA** — A separate CA used for API aggregation (extension API servers)

The CA files are typically named `ca.crt` (public certificate) and `ca.key` (private key). The CA cert is shared across the cluster; each component has its own key pair.

:::info
On kubeadm-based clusters, all certificate files live under `/etc/kubernetes/pki/` on the control plane node. The CA cert is shared; each component has its own key and certificate. **Never expose private keys** — if compromised, rotate them immediately.
:::

## Inspecting Cluster Certificates

Let's look at what's actually on a control plane node:

```bash
# List all PKI files
ls -la /etc/kubernetes/pki/

# Inspect the API server certificate
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text

# Check expiration dates specifically
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -dates
```

The `openssl x509` command is your best friend for certificate inspection. The `-noout -text` flags show the full certificate details: who it was issued to (Subject), who signed it (Issuer), when it expires, and which hostnames/IPs it covers (Subject Alternative Names).

For kubeadm clusters, there's an even easier way to check all certificates at once:

```bash
kubeadm certs check-expiration
```

This shows every certificate in the cluster, its CA, and its expiration date. Most kubeadm certificates are valid for **one year**, so plan your rotation calendar accordingly.

## Verifying Certificates Remotely

You can also verify the API server's certificate from any machine that has network access and the cluster CA:

```bash
# Connect to the API server and verify its certificate
openssl s_client -connect <api-server>:443 -CAfile /etc/kubernetes/pki/ca.crt -showcerts

# Decode the client certificate from your kubeconfig
kubectl config view --raw -o jsonpath='{.users[0].user.client-certificate-data}' | base64 -d | openssl x509 -noout -text
```

The second command is useful for understanding your own identity: the certificate's Common Name (CN) is treated as your username, and the Organization (O) field maps to groups for RBAC.

## The Front-Proxy CA

Some clusters have a second CA specifically for API aggregation — the front-proxy CA. This isolates aggregation layer traffic from the main cluster PKI. If your cluster uses extension API servers, you'll find `front-proxy-ca.crt` and `front-proxy-client.crt` alongside the other certificates. These need to be rotated separately.

## Common Issues

**"certificate has expired"** — The most common issue in older clusters. Certificates must be renewed before expiry. The next lesson covers rotation in detail.

**"certificate signed by unknown authority"** — The client's CA doesn't match the cluster CA. This often happens when mixing kubeconfigs or after a CA rotation. Verify the CA reference in your kubeconfig.

**"x509: certificate is valid for X, not Y"** — The certificate's Subject Alternative Names (SANs) don't include the hostname or IP you're connecting to. This can happen after changing the API server's address.

:::warning
Certificate expiration is one of the most common causes of cluster outages. Set up monitoring (Prometheus alerts on certificate expiry) and establish a rotation calendar. Most kubeadm certificates expire after one year — don't let them surprise you.
:::

## Wrapping Up

Kubernetes uses a PKI where a central CA signs certificates for every cluster component. These certificates enable encrypted, authenticated communication between the API server, kubelets, etcd, and clients. Certificates live under `/etc/kubernetes/pki/` and can be inspected with OpenSSL or `kubeadm certs check-expiration`. In the next lesson, we'll walk through how to rotate certificates before they expire — a critical maintenance task for any cluster.
