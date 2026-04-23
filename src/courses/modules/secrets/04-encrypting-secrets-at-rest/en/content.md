---
seoTitle: 'Kubernetes Secrets Encryption at Rest, EncryptionConfiguration'
seoDescription: 'Learn how to enable encryption at rest for Kubernetes Secrets using EncryptionConfiguration, verify it works, and understand what it protects against.'
---

# Encrypting Secrets at Rest

Without encryption at rest, every Secret in your cluster is stored as base64-encoded plain text in etcd. Anyone with direct etcd access, such as a compromised etcd node, can read every Secret in the cluster instantly. Encryption at rest adds an AES encryption layer between the API server and etcd. The Secret values in etcd are unreadable without the encryption key.

The CKA exam tests this topic directly: you need to know how to configure encryption at rest, verify it is working, and explain what it protects.

## How it works

@@@
graph LR
A["kubectl create secret\n(plain text)"] --> B["kube-apiserver\nEncryptionConfiguration\napplied"]
B -->|"AES encrypt"| C["etcd\nencrypted bytes"]
C -->|"AES decrypt"| D["kubectl get secret\n(plain text again)"]
@@@

The kube-apiserver holds the encryption key and configuration. When a Secret is written, the apiserver encrypts the value before storing it in etcd. When the Secret is read, the apiserver decrypts it. etcd never sees the plain text. If someone reads etcd directly, they get ciphertext.

## The EncryptionConfiguration file

Encryption is configured via a file on the control plane node:

```bash
nano /etc/kubernetes/pki/encryption-config.yaml
```

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - identity: {}
```

The `providers` list is ordered. The first provider is used for encryption. The `identity` provider means "no encryption" and is listed last for fallback reads of Secrets that were stored before encryption was enabled.

To generate a valid 32-byte key:

```bash
head -c 32 /dev/urandom | base64
```

The kube-apiserver is then started with:

```
--encryption-provider-config=/etc/kubernetes/pki/encryption-config.yaml
```

This flag is set in the kube-apiserver static Pod manifest at `/etc/kubernetes/manifests/kube-apiserver.yaml`.

:::warning
The encryption key is itself sensitive. If the key is lost, all Secrets encrypted with it are permanently unreadable. Store the key securely and separately from the etcd data. In production, use a KMS (Key Management Service) provider instead of a local key. KMS providers keep the key in an external service like AWS KMS or HashiCorp Vault. The local `aescbc` provider is simpler but puts the key on the control plane node.
:::

## Verifying that encryption is active

Creating a new Secret after enabling encryption is not enough to verify the configuration is working. You need to check whether the value in etcd is actually ciphertext.

```bash
kubectl create secret generic test-encryption \
  --from-literal=value=notencrypted
```

In a real cluster with `etcdctl` access:

```bash
ETCDCTL_API=3 etcdctl get \
  /registry/secrets/default/test-encryption \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

If encryption is working, the output is unreadable binary ciphertext starting with `k8s:enc:aescbc:v1:`. If you see the base64 encoding of your value in readable form, encryption is not active for this Secret.

:::quiz
You enable encryption at rest for Secrets. Existing Secrets were created before you enabled it. Are they now encrypted?

**Answer:** No. Enabling encryption only applies to new writes. Secrets that existed before the change are still stored as plain text in etcd. To encrypt existing Secrets, you must force a re-write: `kubectl get secrets --all-namespaces -o json | kubectl replace -f -`. This triggers the apiserver to re-write each Secret through the new encryption configuration.
:::

## What encryption at rest does not protect against

Encryption at rest protects etcd data at the disk level. It does not protect:

- Secrets in transit over the network (TLS between apiserver and etcd handles that separately)
- Secrets already in memory on running nodes
- Secrets visible through `kubectl get secret` to anyone with RBAC access
- The encryption key itself if it is stored on the same compromised node

```bash
kubectl delete secret test-encryption
```

:::quiz
An attacker gains read access to the etcd data files on disk. Encryption at rest is enabled with `aescbc`. Can the attacker read the Secrets?

**Answer:** No, not without the encryption key. The etcd data files contain ciphertext. Without the AES key configured in the EncryptionConfiguration, the attacker cannot decrypt the values. However, if the attacker also has access to the control plane node where the key is stored (same machine), they can read the key and decrypt the data. The threat model protects against etcd data theft where the control plane configuration is not also compromised.
:::

Encryption at rest is a critical hardening step for production clusters. Configure it, verify it with an etcd read, and re-encrypt existing Secrets after enabling it. The next lesson ties together the security best practices for working with Secrets day-to-day.
