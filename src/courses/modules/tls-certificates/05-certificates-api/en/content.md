---
seoTitle: 'Kubernetes Certificates API, CSR Approval, kubectl certificate approve'
seoDescription: 'Learn how the Kubernetes CertificateSigningRequest API works: create a CSR object, approve or deny it with kubectl, and retrieve the signed certificate.'
---

# The Kubernetes Certificates API

Manually signing certificates with the cluster CA requires access to the CA private key on the control plane node. That key is the most sensitive secret in the entire cluster. Handing out access to it for routine certificate issuance is a serious security risk. Kubernetes provides a built-in API for requesting and approving certificates without ever touching the CA key directly.

## The CertificateSigningRequest resource

The `CertificateSigningRequest` (CSR) resource represents a request for a signed certificate. A user or an automated process creates a CSR object in Kubernetes. An administrator (or an automated controller) reviews it and approves or denies it. When approved, the Kubernetes controller manager signs the CSR using the cluster CA and stores the result in the CSR object's `status.certificate` field.

```bash
kubectl get certificatesigningrequests
```

Run that now. In the simulator, the cluster is pre-configured and may have no pending CSRs. The command still confirms the Certificates API is reachable and shows you the column layout: NAME, AGE, SIGNERNAME, REQUESTOR, REQUESTEDDURATION, CONDITION.

The CONDITION column is the key field. It shows `Pending` for a CSR waiting for a decision, `Approved` for one the controller manager has signed, and `Denied` for one explicitly rejected.

## The workflow

@@@
graph LR
    Dev["Developer\ngenerates key + CSR"]
    Encode["base64-encode the CSR"]
    Manifest["Create CSR object\nin Kubernetes"]
    Admin["Admin reviews\nkubectl get csr"]
    Approve["kubectl certificate approve"]
    Signed["Signed cert available\nin status.certificate"]

    Dev --> Encode
    Encode --> Manifest
    Manifest --> Admin
    Admin --> Approve
    Approve --> Signed
@@@

The developer generates their private key and a CSR file locally (using `openssl`, as shown in the previous lesson). They base64-encode the CSR file contents and embed that in a Kubernetes manifest. They submit the manifest. The admin inspects it and approves it. The signed certificate becomes available in the cluster object, and the developer retrieves it.

## Building the CSR manifest

Start with the scaffolding:

```bash
nano developer-csr.yaml
```

The manifest needs the CSR contents, a signer, and the intended usages. Build it field by field.

First, the metadata and the encoded request:

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: developer
spec:
  request: <base64-encoded-csr>
```

The `request` field holds the base64-encoded content of the `.csr` file. In a real workflow, you would generate this with:

```bash
# reference - not available in simulator
cat developer.csr | base64 | tr -d '\n'
```

Then add the signer and usages:

```yaml
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: developer
spec:
  request: <base64-encoded-csr>
  signerName: kubernetes.io/kube-apiserver-client
  usages:
    - client auth
```

The `signerName` field tells Kubernetes which signing authority to use. `kubernetes.io/kube-apiserver-client` instructs the controller manager to sign with the cluster CA, producing a certificate valid for authenticating to the API server. The `usages` field restricts what the certificate can do. A `client auth` usage cannot be used as a server certificate, and vice versa.

```bash
kubectl apply -f developer-csr.yaml
```

## Inspecting a pending CSR

After submitting, list all CSRs to confirm it arrived:

```bash
kubectl get certificatesigningrequests
```

You should see `developer` in the list with CONDITION `Pending`. Get the full object to verify the spec was recorded correctly:

```bash
kubectl get csr developer -o yaml
```

The `status` section is empty at this point: no certificate yet, because no approval has been given.

:::quiz
You create a CSR object and immediately run `kubectl get csr`. The CONDITION column shows `Pending`. What does that mean?

**Try it:** `kubectl get certificatesigningrequests`

**Answer:** Pending means the CSR has been received but no admin has approved or denied it yet. The controller manager will not sign it until an explicit approval is given. A CSR stays Pending indefinitely until acted on or deleted.
:::

## Approving and denying

An administrator reviews the request and approves it:

```bash
kubectl certificate approve developer
```

After approval, the controller manager signs the CSR immediately. List the CSRs again:

```bash
kubectl get certificatesigningrequests
```

The CONDITION column now shows `Approved`. To retrieve the signed certificate:

```bash
kubectl get csr developer -o yaml
```

The `status.certificate` field now contains the base64-encoded signed certificate. In a real workflow, the developer decodes that field and adds it to their kubeconfig alongside their private key.

If the request is invalid or should not be granted, an admin denies it instead:

```bash
# reference - not available in simulator
kubectl certificate deny developer
```

:::warning
Once a CSR is approved or denied, the decision cannot be reversed by the same admin action. To reissue, delete the CSR object and have the developer submit a new one. A denied CSR stays visible in the cluster for auditing purposes until explicitly deleted.
:::

:::quiz
What is the security advantage of using the Certificates API instead of signing certificates directly with the CA private key?

**Answer:** The CA private key never leaves the control plane node, and no individual user needs access to it for routine certificate issuance. An admin only needs permission to approve or deny CSR objects, which is a much narrower privilege. The signing itself is performed internally by the controller manager. This limits the blast radius if an admin account is compromised.
:::

## The identity encoded in the CSR

The CSR object's `spec.request` contains the original CSR with its subject fields. When the controller manager signs it, those fields are carried into the resulting certificate. The `CN` in the CSR subject becomes the Kubernetes username. Each `O` value becomes a group. This means the admin approving the CSR should verify the subject before approving: a CSR with `CN=cluster-admin` in the subject would, if approved, grant the bearer an admin-level username in RBAC. (RBAC rules themselves are covered in the RBAC module.)

```bash
kubectl get certificatesigningrequests
```

Running this command one final time, note the REQUESTOR column. It shows which Kubernetes user created the CSR object, which is distinct from the identity being requested inside the CSR. Both pieces of information are relevant when auditing certificate issuance.

The Certificates API, the PKI layout, certificate creation, and diagnostic inspection together form the complete picture of how Kubernetes manages TLS security. Every connection in the cluster, from `kubectl` to the API server to etcd, depends on these building blocks working correctly.
