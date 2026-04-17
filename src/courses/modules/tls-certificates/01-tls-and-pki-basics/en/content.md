---
seoTitle: 'TLS and PKI Basics for Kubernetes, Certificates, CAs, Private Keys'
seoDescription: 'Understand how TLS and Public Key Infrastructure protect Kubernetes API communication: Certificate Authorities, certificates, private keys, and the TLS handshake.'
---

# TLS and PKI Basics

Every request you send with `kubectl` travels over the network to the API server. How does `kubectl` know it is talking to the real API server and not an impostor sitting in between, intercepting your commands? How does the API server know the client is who they claim to be? The answer is TLS and a system called Public Key Infrastructure.

## What TLS does

TLS (Transport Layer Security) solves two problems at once. First, it encrypts the channel so that anyone eavesdropping on the network sees only scrambled data. Second, it verifies identity: the server presents a certificate, and the client checks that certificate against a trusted authority before sending anything sensitive.

Think of it this way: when you connect to a bank website over HTTPS, your browser checks the bank's certificate and confirms it was issued by a recognized authority. If the certificate is fake or self-signed by an unknown entity, your browser refuses the connection. `kubectl` does exactly the same thing when it connects to the Kubernetes API server.

:::quiz
Why does encrypting the channel alone not prevent an impostor attack?

**Answer:** Encryption protects the contents of the communication, but it does not prove who you are talking to. Without identity verification, you could establish an encrypted channel with an attacker who pretended to be the API server. TLS combines encryption with authentication, using certificates to prove the server's identity before any data is exchanged.
:::

## Certificates, private keys, and the CA

A **certificate** is a document that binds an identity (a name, an IP address) to a **public key**. Anyone can read a certificate. The public key inside it is meant to be shared.

A **private key** is the counterpart to the public key. It stays secret on the server. Only the private key holder can prove they own the certificate. The math behind asymmetric cryptography ensures that what one key encrypts, only the other can decrypt. The server signs data with its private key, and anyone with the public key can verify that signature.

The remaining piece is trust. How do you know a certificate is genuine and not fabricated? That is the job of a **Certificate Authority (CA)**. A CA is a trusted entity that signs certificates. When a CA signs your certificate, it is saying: "I have verified that this public key belongs to this identity." If you trust the CA, you trust any certificate it has signed.

@@@
graph TD
    CA["Certificate Authority (CA)\nHolds the CA private key"]
    ServerCert["Server Certificate\nPublic key + identity + CA signature"]
    Client["kubectl / Client"]
    Channel["Encrypted TLS Channel"]

    CA -->|signs| ServerCert
    Client -->|trusts CA| CA
    Client -->|verifies signature on| ServerCert
    ServerCert -->|valid: opens| Channel
@@@

This chain is why the CA's private key is the most sensitive asset in the whole system. A compromised CA can produce forged certificates for any identity. In Kubernetes, the cluster CA is what the entire PKI depends on.

## The TLS handshake

When `kubectl` connects to the API server, both sides perform a handshake before any Kubernetes data flows. The server sends its certificate. `kubectl` checks that the certificate was signed by a CA it trusts (the cluster CA, whose public certificate is stored in your kubeconfig). If the check passes, both sides agree on an encryption key for the session, and the channel becomes private.

```bash
kubectl cluster-info
```

Run that command and observe: if the TLS handshake succeeds, you get back the API server URL and the CoreDNS address. If the certificate is expired or untrusted, `kubectl` refuses the connection and prints an `x509` error instead.

:::quiz
Why does trusting the CA mean you automatically trust any certificate it signed?

**Answer:** Because the CA's signature on a certificate is mathematically verifiable. A certificate contains the CA's cryptographic signature over the certificate's contents. Verifying that signature requires only the CA's public key, which is public and shareable. A certificate cannot be forged without access to the CA's private key. If you trust the CA's public key, any certificate carrying a valid signature from that key is genuine.
:::

## A certificate up close

To make this concrete, here is what a certificate looks like in a Kubernetes-adjacent format. Tools like cert-manager use a `CertificateRequest` object to represent a request for a signed certificate:

```yaml
# illustrative only
apiVersion: cert-manager.io/v1
kind: CertificateRequest
metadata:
  name: developer-cert-request
spec:
  issuerRef:
    name: cluster-ca
    kind: ClusterIssuer
  request: <base64-encoded-CSR>
  usages:
    - client auth
```

The `request` field contains a Certificate Signing Request (CSR), which carries the identity and public key. The issuer (the CA) receives that request, verifies it, and returns a signed certificate. You will see how Kubernetes handles this natively in the last lesson of this module.

```bash
kubectl get nodes
```

If the cluster's TLS certificates are all valid, this returns your node list. If any certificate in the chain is expired or malformed, the command fails before it reaches Kubernetes. That is the concrete cost of a broken PKI: the cluster becomes unreachable.

:::info
The cluster CA is not the same as a public internet CA (like Let's Encrypt). It is a private CA generated when the cluster is bootstrapped, trusted only within the cluster. Its certificate is distributed to every component that needs to verify others.
:::

TLS and PKI are the foundation that every other security feature in Kubernetes builds on. With those concepts established, the next lesson maps out exactly which certificates exist in a Kubernetes cluster and which component uses each one.
