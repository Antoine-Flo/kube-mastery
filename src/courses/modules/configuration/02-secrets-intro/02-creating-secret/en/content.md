# Creating Secrets

Creating Secrets follows similar patterns to ConfigMaps — manifests, literal values, and files. The key difference: you need to be careful about where those values end up. Let's walk through the practical methods.

## From a Manifest with stringData

The cleanest approach for manifests:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:
  username: admin
  password: my-secure-password
```

`stringData` accepts plain text — Kubernetes encodes it to base64 automatically when storing. This avoids the tedious and error-prone step of manual base64 encoding.

If you need to use the `data` field (pre-encoded values):

```yaml
data:
  username: YWRtaW4=        # echo -n "admin" | base64
  password: bXktc2VjdXJl    # echo -n "my-secure" | base64
```

:::warning
Never commit manifests with real credentials to version control. Use placeholders in Git and inject real values through CI/CD pipelines, or use external secret management tools like External Secrets Operator or Sealed Secrets.
:::

## From Literal Values

For quick creation:

```bash
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=my-secure-password
```

The values are encoded automatically. This is convenient for testing but leaves credentials in your shell history — use with care.

## TLS Secrets

For TLS certificates, use the dedicated type. kubectl handles the structure:

```bash
kubectl create secret tls my-tls-secret \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

This creates a Secret with type `kubernetes.io/tls` and two keys: `tls.crt` and `tls.key`. Ingress controllers expect this format for TLS termination.

## Docker Registry Secrets

For pulling images from private registries:

```bash
kubectl create secret docker-registry registry-creds \
  --docker-server=registry.example.com \
  --docker-username=user \
  --docker-password=password \
  --docker-email=user@example.com
```

Reference it in your Pod spec:

```yaml
spec:
  imagePullSecrets:
    - name: registry-creds
```

:::info
Prefer `stringData` over `data` in manifests — it avoids manual base64 encoding and makes manifests readable. But remember: `stringData` fields contain plain-text credentials, so handle the manifest carefully.
:::

## Production Best Practices

For production environments, avoid storing real credentials in Git:

- **External Secrets Operator** — Syncs secrets from AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager into Kubernetes Secrets
- **Sealed Secrets** — Encrypts Secrets so they can be safely committed to Git; only the cluster can decrypt them
- **SOPS** — Encrypts secret files with cloud KMS keys

These tools let you follow GitOps practices without exposing sensitive values.

## Verifying Secrets

```bash
# List Secrets
kubectl get secrets

# See keys (values hidden)
kubectl describe secret db-credentials

# Decode a value
kubectl get secret db-credentials -o jsonpath='{.data.password}' | base64 -d
```

## Wrapping Up

Create Secrets from manifests with `stringData`, from literals with `kubectl create secret generic`, or with specialized commands for TLS and docker-registry types. Never commit real credentials to version control — use external secret management for production. In the next lesson, you'll learn how to consume Secrets in Pods as environment variables or volume mounts.
