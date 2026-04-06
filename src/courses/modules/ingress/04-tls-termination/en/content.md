---
seoTitle: 'TLS Termination with Gateway API and Envoy Gateway in Kubernetes'
seoDescription: 'Learn how to configure HTTPS with Kubernetes Gateway API, how TLS termination works at the Envoy data plane, and how TLS Secrets are referenced by Gateway listeners.'
---

# TLS Termination with Gateway API

Every application that serves real users needs HTTPS. Not having it is a dealbreaker: browsers flag non-HTTPS sites as insecure, modern HTTP clients often refuse to follow HTTP redirects to sensitive endpoints, and anything transmitted over plain HTTP is visible to anyone on the network path between the client and your server. For production workloads, configuring TLS is not optional, it is table stakes.

In a Gateway API setup, TLS is configured at the Gateway level. The edge proxy handles the HTTPS handshake with the client, decrypts the traffic, and forwards plain HTTP to your backend services inside the cluster. This model is called **TLS termination**.

## What TLS Termination Means in Practice

Imagine the journey of an HTTPS request from a browser to your application. The browser connects to the Envoy proxy on port 443. Envoy performs the TLS handshake, which involves exchanging certificates and negotiating a cipher suite. The browser verifies that the certificate is valid and trusted. Once the handshake is complete, the browser sends the HTTP request over the encrypted channel.

At this point, Envoy decrypts the request and forwards it as a plain HTTP request to the Kubernetes Service backing your application. The communication inside the cluster, between Envoy and your Pod, is unencrypted by default. Your application never sees the TLS layer, it just receives a normal HTTP request.

@@@
sequenceDiagram
    participant Browser
    participant Envoy as Envoy Proxy (port 443)
    participant SVC as Kubernetes Service
    participant Pod as Application Pod

    Browser->>Envoy: TLS ClientHello
    Envoy-->>Browser: Certificate + TLS handshake
    Browser->>Envoy: Encrypted HTTPS request
    Note over Envoy: Decrypt TLS
    Envoy->>SVC: Plain HTTP request (inside cluster)
    SVC->>Pod: Plain HTTP request
    Pod-->>SVC: HTTP response
    SVC-->>Envoy: HTTP response
    Note over Envoy: Re-encrypt TLS
    Envoy-->>Browser: Encrypted HTTPS response
@@@

This pattern has a clear advantage: your application code does not need to handle TLS at all. You write a simple HTTP server, and the proxy takes care of the cryptography. Certificate rotation, cipher suite configuration, and protocol version management all happen at the Gateway, not in every individual application.

:::info
If you need end-to-end encryption where the traffic between Envoy and your Pods is also encrypted, that is called **TLS passthrough** or **mTLS** (mutual TLS). This is a more advanced topic typically handled by service meshes like Istio. For most use cases, terminating TLS at the edge is sufficient.
:::

## TLS Certificates as Kubernetes Secrets

Kubernetes does not have a dedicated Certificate resource type. Instead, TLS certificates are stored as **Secrets** with a specific type: `kubernetes.io/tls`. This secret type has exactly two data fields:

- `tls.crt`: the certificate (and optionally the full certificate chain, PEM-encoded).
- `tls.key`: the private key corresponding to the certificate (PEM-encoded).

You create a TLS Secret like this:

```bash
kubectl create secret tls my-tls-secret --cert=path/to/cert.crt --key=path/to/key.key
```

Or from a YAML manifest:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-tls-secret
  namespace: default
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded certificate>
  tls.key: <base64-encoded private key>
```

The secret must be in the same namespace as the Gateway that references it. This is a security boundary: a Gateway in the `platform` namespace cannot reference a Secret in the `app` namespace, which prevents applications from accidentally exposing certificates they should not have access to.

## Configuring a TLS Listener on a Gateway

To enable HTTPS, you add a listener with `protocol: HTTPS` to your Gateway and reference the TLS secret:

```yaml
spec:
  gatewayClassName: eg
  listeners:
    - name: https
      port: 443
      protocol: HTTPS
      tls:
        mode: Terminate
        certificateRefs:
          - name: my-tls-secret
```

The `mode: Terminate` field tells Envoy to handle the TLS handshake itself and forward decrypted traffic to backends. This is the standard TLS termination model. The alternative, `mode: Passthrough`, would send encrypted traffic directly to the backend without decrypting it, which requires the backend itself to handle TLS.

:::warning
Forgetting to specify `tls.mode` when using `protocol: HTTPS` will cause the controller to reject the listener configuration. Always include the `tls` block when using HTTPS.
:::

## Self-Signed Certificates vs CA-Signed Certificates

In development and testing environments, self-signed certificates are the easiest option. You generate a certificate and a key together, without involving a certificate authority. Browsers will warn that the certificate is not trusted, but the connection is still encrypted.

In production, your certificate must be signed by a trusted Certificate Authority (CA). The two main approaches are:

- **Public CA (e.g. Let's Encrypt)**: free, automated, trusted by all browsers. You need to prove domain ownership via HTTP or DNS challenge. The `cert-manager` project automates this entirely within Kubernetes.
- **Private CA**: your organization runs its own CA and issues certificates internally. Common in enterprises. Clients must trust your organization's root CA.

For the CKA and CKAD exams, you will mostly work with self-signed or pre-generated certificates, focusing on the mechanics of secret creation and Gateway configuration rather than certificate issuance.

## Hands-On Practice

**Step 1: Create a TLS Secret manifest file**

```bash
nano demo-tls-secret.yaml
```

Paste this content, save, and exit:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: demo-tls-secret
  namespace: default
type: kubernetes.io/tls
data:
  tls.crt: ZHVtbXktY2VydA==
  tls.key: ZHVtbXkta2V5
```

**Step 2: Create the TLS Secret in Kubernetes**

```bash
kubectl apply -f demo-tls-secret.yaml
```

Expected output:

`secret/demo-tls-secret created` or `secret/demo-tls-secret configured`

**Step 3: Verify the secret was created correctly**

```bash
kubectl describe secret demo-tls-secret
```

Expected output:

```
Name:         demo-tls-secret
Namespace:    default
Type:         kubernetes.io/tls

Data
====
tls.crt:  <N> bytes
tls.key:  <N> bytes
```

The `Data` section confirms both fields are present. The values are not shown in plain text for security reasons.

**Step 4: Inspect the current Gateway configuration**

```bash
kubectl describe gateway eg
```

Look at the `Listeners` section. You will see the active listeners and their protocols. In this environment, the pre-configured Gateway may only have an HTTP listener. In a real cluster you would add an HTTPS listener referencing `demo-tls-secret`.

**Step 5: Clean up**

```bash
kubectl delete -f demo-tls-secret.yaml
```
