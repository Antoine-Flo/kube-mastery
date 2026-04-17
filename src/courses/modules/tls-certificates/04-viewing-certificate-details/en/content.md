---
seoTitle: 'Viewing Kubernetes Certificate Details, Expiry, SANs, openssl x509'
seoDescription: 'Learn how to inspect Kubernetes TLS certificates: read expiry dates, verify Subject Alternative Names, check issuers, and diagnose x509 errors in the cluster.'
---

# Viewing Certificate Details

Certificates are everywhere in Kubernetes, but they are invisible until something breaks. On a calm day, every `kubectl` command works and nobody thinks about certificates. On the day a certificate expires, the cluster goes silent, and you need to find the problem fast. Being able to inspect a certificate and read its expiry date, issuer, and Subject Alternative Names is a critical diagnostic skill.

## Where certificates are referenced

The first place to look is your kubeconfig. It contains the paths or inline data for the certificates your client uses. Start there:

```bash
kubectl config view
```

The output shows the current context, cluster endpoint, and user credentials. The fields `certificate-authority`, `client-certificate`, and `client-key` either point to files or contain base64-encoded data inline. This tells you which certificate your `kubectl` is presenting for authentication.

To see the raw base64-encoded certificate data:

```bash
kubectl config view --raw
```

In a real cluster, you would decode that base64 and pass it to `openssl` to read the details. In the simulator, the certificates are pre-configured, so we focus on the inspection commands that work against cluster resources.

## Reading a certificate with openssl

On a real control plane node, you would inspect a certificate like this:

```bash
# reference - not available in simulator
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -text -noout
```

The output is dense, but four sections matter most.

@@@
graph TD
    Cert["Certificate"]
    Subject["Subject\nCN=kube-apiserver, O=..."]
    Issuer["Issuer\nCN=kubernetes (cluster CA)"]
    Validity["Validity\nNot Before / Not After"]
    PubKey["Public Key\n(RSA 2048)"]
    SANs["Subject Alternative Names\nIPs + DNS names"]
    Signature["Signature\n(CA signed this block)"]

    Cert --> Subject
    Cert --> Issuer
    Cert --> Validity
    Cert --> PubKey
    Cert --> SANs
    Cert --> Signature
@@@

**Subject**: the identity the certificate represents. For the API server cert, you expect `CN=kube-apiserver`. For a kubelet cert, you expect `CN=system:node:<node-name>`.

**Issuer**: which CA signed this certificate. You expect the cluster CA's CN here. If the issuer is wrong, the certificate was not signed by your cluster CA and clients will reject it.

**Validity**: `Not Before` and `Not After` dates. The `Not After` date is the expiry. If today is past that date, the certificate is expired. A one-year-old certificate from `kubeadm` with no renewal will fail exactly here.

**Subject Alternative Names (SANs)**: the list of IP addresses and DNS names the certificate is valid for.

## The SAN requirement

:::warning
If the SAN list does not include the IP address or hostname a client uses to connect, TLS verification fails even if the certificate is signed by a trusted CA and has not expired. The error looks like: `x509: certificate is valid for 10.96.0.1, kubernetes, kubernetes.default, not 192.168.50.10`. The fix requires regenerating the certificate with the correct SAN entries, not just renewing it.
:::

Why does this rule exist? TLS clients are required to verify that the server they are connecting to is actually named in the certificate. This prevents a certificate issued for one server from being used to impersonate a different server, even if both are signed by the same CA. The SAN check is a separate step from signature verification.

```bash
kubectl cluster-info
```

When this returns the API server URL successfully, it means the SAN check passed: the URL you are using to reach the API server is listed in the server's certificate. In the simulator, this is pre-configured correctly.

:::quiz
Why does an API server certificate need to include the server's IP address in its SAN list?

**Answer:** TLS clients verify that the hostname or IP they connected to is listed in the certificate's SAN field. The API server is often reached by multiple names and IPs (internal cluster IP, external IP, DNS names). If any of those is missing from the SAN list, clients connecting through that address reject the certificate, even though it was issued by a trusted CA and has not expired. The SAN list must cover every address clients might use.
:::

## Viewing CSR objects in the cluster

Kubernetes also exposes certificate-related state through its API. The `CertificateSigningRequest` resource tracks certificates that have been requested through the Kubernetes Certificates API:

```bash
kubectl get certificatesigningrequests
```

Each row shows a CSR name, the time it was created, the signer, the requestor, and the current condition (Pending, Approved, or Denied). Even if there are no active CSRs, the command verifies that your cluster's certificate machinery is reachable.

If the API server certificate itself were expired, that command would fail with an `x509` error before reaching Kubernetes. The fact that it succeeds tells you the API server certificate and CA chain are currently valid.

:::quiz
You run `kubectl get nodes` and get: "Unable to connect to the server: x509: certificate signed by unknown authority". What does this tell you about the certificate chain?

**Answer:** The API server's certificate was signed by a CA that your `kubectl` does not trust. The CA used to issue the certificate is not the one embedded in your kubeconfig. This often happens after a cluster rebuild where the CA was regenerated but the kubeconfig was not updated, or when connecting to a cluster whose CA certificate has not been added to your kubeconfig. The fix is to update the `certificate-authority-data` in your kubeconfig to match the current cluster CA.
:::

## Putting it together: a diagnostic sequence

When a cluster connection fails with an `x509` error, follow this sequence. Start with `kubectl config view` to confirm which cluster endpoint and CA your client is using. Then check whether the server is reachable at all with `kubectl cluster-info`. If you have control plane access, inspect the API server certificate with `openssl` to check the expiry and SANs. Finally, check whether CSR objects reveal any in-flight certificate operations.

```bash
kubectl config view
```

```bash
kubectl cluster-info
```

```bash
kubectl get certificatesigningrequests
```

This sequence moves from client configuration, to connectivity, to cluster state. Each step narrows the problem.

With certificate inspection covered, the final lesson shows how to request and approve certificates through the Kubernetes Certificates API, which avoids direct CA private key access entirely.
