---
seoTitle: 'Creating Kubernetes Client Certificates, CSR, openssl, kubeconfig'
seoDescription: 'Learn how to create a Kubernetes client certificate using openssl and a CSR, and how the CN and O fields map to Kubernetes identity and group for access control.'
---

# Creating Certificates

A new developer is joining your team. They need access to the simulated cluster. Kubernetes has no user database, no `kubectl create user` command. Instead, Kubernetes authenticates users through client certificates. To give someone a Kubernetes identity, you create a client certificate signed by the cluster CA, and that certificate's subject fields become their identity.

## The three-step workflow

Creating a client certificate manually involves three steps: generate a private key, create a Certificate Signing Request (CSR) that encodes the desired identity, then sign that CSR with the cluster CA to produce the final certificate.

@@@
graph LR
    Key["1. Private key\ndeveloper.key"]
    CSR["2. CSR\ndeveloper.csr\nCN=developer, O=dev-team"]
    Cert["3. Signed certificate\ndeveloper.crt"]
    CA["Cluster CA\nca.crt + ca.key"]

    Key -->|used to create| CSR
    CSR -->|signed by| CA
    CA -->|produces| Cert
@@@

The private key never leaves the developer's machine. The CSR is the public request: it carries the identity claim and the public key, but no secret. Only the CA's private key can produce a valid signature over the CSR.

## Step 1: Generate a private key

```bash
# reference - not available in simulator
openssl genrsa -out developer.key 2048
```

This produces a 2048-bit RSA private key. The number 2048 refers to the key size in bits. Larger keys are harder to break but slower to use. For Kubernetes client certificates, 2048 bits is standard.

The private key is the most sensitive file in the process. Anyone who holds it can impersonate the certificate's owner. In production, you never share this file.

## Step 2: Create a Certificate Signing Request

```bash
# reference - not available in simulator
openssl req -new -key developer.key -subj "/CN=developer/O=dev-team" -out developer.csr
```

The `-subj` flag is where the Kubernetes identity is encoded. The `CN` (Common Name) field becomes the Kubernetes **username**. The `O` (Organization) field becomes the **group**. When Kubernetes receives a request authenticated by this certificate, it treats the bearer as user `developer` in group `dev-team`. This is how RBAC rules connect to certificate-based users, though the RBAC rules themselves are covered in the RBAC module.

```bash
kubectl config view
```

Run that in the simulator and look at the `users` section of the output. Each user entry in your kubeconfig holds either a certificate or a token. The certificate-based entries are the result of exactly this process.

:::quiz
What field in the certificate Subject becomes the Kubernetes username?

**Answer:** The `CN` (Common Name) field. When Kubernetes authenticates a request using a client certificate, it reads the CN as the username and each O (Organization) value as a group. This is how a certificate-based user identity is established without a user database.
:::

## Step 3: Sign the CSR with the cluster CA

```bash
# reference - not available in simulator
openssl x509 -req -in developer.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out developer.crt -days 365
```

This takes the CSR and the cluster CA's certificate and private key, and produces a signed certificate valid for 365 days. The `-CAcreateserial` flag creates a serial number file if it does not already exist. Each certificate issued by a CA gets a unique serial number for tracking and revocation purposes.

The resulting `developer.crt` is safe to share. It contains only the public key and identity, signed by the CA. Without `developer.key`, the certificate is useless.

:::warning
Signing with the CA private key (`ca.key`) requires access to the control plane node in a real cluster. That key is highly sensitive. Doing this manually is practical only for initial setup or emergencies. For ongoing certificate issuance, the Kubernetes Certificates API (covered in the last lesson) avoids direct CA key access entirely.
:::

## Using the certificate in kubeconfig

Once you have `developer.crt` and `developer.key`, you add them to a kubeconfig file as a user credential. The kubeconfig connects a user identity (the certificate) with a cluster endpoint and a context.

```bash
kubectl config view
```

Look at the output again. The `certificate-authority-data`, `client-certificate-data`, and `client-key-data` fields are all base64-encoded. The client certificate data is the `developer.crt` content, encoded. The client key data is `developer.key`. Every time `kubectl` sends a request, it presents this certificate as proof of identity.

:::info
In the simulator, certificate creation is shown for reference only. The simulator uses pre-configured certificates. The next lesson shows how to inspect the details of existing certificates and read their expiry dates and subject fields.
:::

:::quiz
Why is the CSR safe to share with the CA administrator, but the private key must never leave the developer's machine?

**Answer:** The CSR contains only the public key and the identity claim. Signing it produces a certificate anyone can read. The private key is what proves ownership of the certificate. If someone else holds the private key, they can authenticate as the certificate's subject. The security model depends on the private key remaining secret to the certificate holder.
:::

## What goes wrong

A common mistake is generating the CSR with the wrong `-subj` value. If you put the username in the `O` field instead of the `CN`, Kubernetes reads the wrong value as the username. The certificate passes TLS verification, the user authenticates successfully, but RBAC rules bound to the intended username do not apply. The user appears to connect but has no permissions.

```bash
kubectl get nodes
```

From the perspective of a newly provisioned user with that certificate in their kubeconfig, this command would succeed or fail based on whether their RBAC permissions cover it. But that failure is not a TLS error: TLS already succeeded. It is an authorization error. Knowing the difference between an authentication failure (TLS, certificate invalid) and an authorization failure (RBAC, certificate valid but insufficient permissions) is essential for diagnosing access problems.

With the creation process clear, the next lesson focuses on reading and inspecting existing certificates: finding expiry dates, verifying SANs, and checking the issuer chain.
