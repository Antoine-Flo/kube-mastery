---
seoTitle: 'Kubernetes Secret Types, Opaque, TLS, dockerconfigjson, ServiceAccount'
seoDescription: 'Learn the built-in Kubernetes Secret types: Opaque for generic data, TLS for certificates, dockerconfigjson for image pull credentials, and service account tokens.'
---

# Secret Types

Every Secret has a `type` field. The type tells Kubernetes what the Secret contains and enforces the presence of specific keys. Most application Secrets use `Opaque`, the generic type, but three other types appear frequently enough in CKA scenarios that you need to recognize them.

```bash
kubectl get secrets -n kube-system -o wide
```

The `TYPE` column lists the type for each Secret. You will see `kubernetes.io/service-account-token` for service account credentials and possibly `kubernetes.io/tls` for certificate Secrets.

## Opaque: the generic type

`Opaque` is the default when you create a Secret with `--from-literal` or `--from-file`. It accepts any keys and any values. Kubernetes does not validate the contents.

```bash
kubectl create secret generic db-creds \
  --from-literal=username=admin \
  --from-literal=password=s3cr3t
```

```bash
kubectl get secret db-creds
```

The TYPE column shows `Opaque`. Use `generic` in `kubectl create secret` and the type is set automatically. This is the right type for database credentials, API keys, tokens, or any custom sensitive data.

## kubernetes.io/tls: certificate secrets

TLS Secrets hold a certificate and its private key. They must contain exactly two keys: `tls.crt` (the certificate) and `tls.key` (the private key). Kubernetes validates that both are present when you create a TLS Secret.

```bash
kubectl create secret tls my-tls-secret \
  --cert=/path/to/cert.pem \
  --key=/path/to/key.pem
```

In the simulator you can create a TLS Secret directly from the YAML manifest with placeholder content:

```bash
nano tls-secret.yaml
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-tls-secret
type: kubernetes.io/tls
data:
  tls.crt: LS0tLS1CRUdJTi... # base64-encoded certificate
  tls.key: LS0tLS1CRUdJTi... # base64-encoded private key
```

TLS Secrets are consumed by the Gateway API controller to terminate HTTPS connections. The gateway-api module covers this usage in context.

## kubernetes.io/dockerconfigjson: image pull secrets

When a container image is in a private registry, the kubelet needs credentials to pull it. An `imagePullSecret` points to a Secret of type `kubernetes.io/dockerconfigjson`. It contains a Docker config JSON blob with the registry URL and base64-encoded credentials.

```bash
kubectl create secret docker-registry registry-creds \
  --docker-server=registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword
```

```bash
kubectl get secret registry-creds -o yaml
```

The `data` section contains a single key `.dockerconfigjson` with the encoded JSON. To use it in a Pod:

```yaml
spec:
  imagePullSecrets:
    - name: registry-creds
  containers:
    - name: app
      image: registry.example.com/my-app:latest
```

:::quiz
You create a TLS Secret but omit the `tls.key` field. What happens?

**Answer:** The API server rejects the Secret creation with a validation error. Secrets of type `kubernetes.io/tls` require exactly two keys: `tls.crt` and `tls.key`. Both must be present. Opaque Secrets have no such key requirement: you can include any keys and any values.
:::

## Service account token Secrets

`kubernetes.io/service-account-token` Secrets were the original mechanism for providing Pod identities. You saw them in the `kube-system` namespace earlier. Older Kubernetes versions created one of these Secrets for each service account automatically.

Modern Kubernetes (1.24+) uses projected service account tokens instead: short-lived tokens injected directly into the Pod filesystem without creating a persistent Secret object. The `service-accounts` module covers this in detail. You may still encounter the older Secret type in existing clusters, so recognizing it is useful.

:::quiz
Which Secret type would you use to store an API key for an external service?

**Answer:** `Opaque` (created with `kubectl create secret generic`). The `Opaque` type accepts arbitrary key-value pairs with no schema validation. It is the correct choice for any application-specific sensitive data that does not fit the structured types (TLS certificates, registry credentials, service account tokens).
:::

```bash
kubectl delete secret db-creds registry-creds
```

The type field shapes what Kubernetes validates and how certain controllers consume the Secret. `Opaque` for application credentials, `kubernetes.io/tls` for certificates, `kubernetes.io/dockerconfigjson` for registry access. The next lesson covers creating and consuming Secrets in Pods, using both environment variables and volume mounts.
