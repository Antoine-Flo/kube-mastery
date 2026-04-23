---
seoTitle: 'Kubernetes Secret, Sensitive Data, Base64 Encoding Explained'
seoDescription: 'Learn what a Kubernetes Secret is, how it differs from a ConfigMap, why values are base64-encoded, and what protections Secrets actually provide.'
---

# What Is a Secret

A database password baked into a container image is visible to anyone who can pull the image. A password stored in a ConfigMap is visible to anyone who can read the namespace. A Secret stores sensitive data outside the container image, but with additional controls: a separate RBAC path, optional encryption at rest, and a design signal that says "this value is sensitive, treat it differently."

The injection patterns for Secrets are identical to ConfigMaps: environment variables or volume mounts. If you know ConfigMaps, you know most of Secrets. The differences are in access control, storage behavior, and how values are encoded.

```bash
kubectl get secrets -n kube-system
```

The list includes system-managed Secrets. Kubernetes creates these automatically for service account tokens, TLS certificates used by internal services, and bootstrap credentials.

## Base64 encoding is not encryption

@@@
graph LR
A["password123"] -->|"base64 encode"| B["cGFzc3dvcmQxMjM="]
B -->|"base64 decode"| A
note["Anyone with read access\ncan decode instantly"]
@@@

Secret values are stored as base64-encoded strings. Base64 is an encoding, not encryption. Anyone who can read the Secret object can decode the value in one command:

```bash
echo "cGFzc3dvcmQxMjM=" | base64 --decode
```

Output: `password123`. There is no cryptographic protection at this layer. The base64 encoding exists because Secret values can be arbitrary binary data (TLS certificates, SSH keys), and base64 makes binary data safe to store in a YAML text field.

:::warning
Kubernetes Secrets are not encrypted by default. They are stored as base64-encoded plain text in etcd. Anyone with direct etcd access or sufficient RBAC permissions can read them. Encryption at rest (covered in lesson 4) adds a real cryptographic layer. Without it, a Secret offers access control isolation, not confidentiality. Never assume a Secret is private simply because it is a Secret object.
:::

## What Secrets actually provide

The real protection of a Secret comes from RBAC. ConfigMaps and Secrets are separate resource types. You can grant a team `get` and `list` access to ConfigMaps without granting any access to Secrets. This separation is meaningful: a developer who can read the application configuration cannot automatically read database credentials.

```bash
kubectl create secret generic db-credentials \
  --from-literal=password=supersecret \
  --from-literal=username=admin
```

```bash
kubectl get secret db-credentials -o yaml
```

The `data` section shows base64-encoded values. Kubernetes does not hide these from `kubectl get` output if you have the right permissions. The separation is at the RBAC level, not at the display level.

```bash
kubectl get secret db-credentials -o jsonpath='{.data.password}' | base64 --decode
```

You can decode the value with a pipeline. Anyone with `get` access to this Secret can do the same.

:::quiz
A developer says: "Secrets are safe because the values are base64-encoded." What is wrong with this statement?

**Answer:** Base64 is an encoding, not encryption. It is trivially reversible with a single command. The security of a Secret comes from Kubernetes RBAC (controlling who can read the Secret object) and optionally from encryption at rest (encrypting the data in etcd). The base64 encoding exists to handle binary data, not to provide confidentiality.
:::

:::quiz
What is the key difference between a ConfigMap and a Secret in terms of access control?

**Answer:** ConfigMaps and Secrets are separate Kubernetes resource types. RBAC policies apply independently to each. You can grant a role access to ConfigMaps without granting access to Secrets, and vice versa. This allows you to give application developers visibility into configuration while restricting access to credentials to operators only.
:::

```bash
kubectl delete secret db-credentials
```

Secrets follow the same injection patterns as ConfigMaps. The next lesson covers the built-in Secret types Kubernetes recognizes and when each is used.
