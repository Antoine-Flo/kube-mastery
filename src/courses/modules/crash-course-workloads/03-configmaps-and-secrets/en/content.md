# ConfigMaps and Secrets

The container image contains your application code and its dependencies. It should not contain configuration values like database URLs, API keys, feature flags, or port numbers. Baking configuration into the image means rebuilding and redeploying every time a configuration value changes - even something as trivial as a log level. It also means the same image can't run in multiple environments without modification, and sensitive values end up embedded in a layer that could be extracted or leaked.

Kubernetes solves this with two API objects that separate configuration from the image: **ConfigMaps** for non-sensitive values and **Secrets** for sensitive data. Both are stored in the cluster, both can be injected into Pods at runtime, and neither requires rebuilding your image when a value changes.

:::info
ConfigMaps and Secrets let you run the same container image in every environment. Configuration lives in the cluster, not in the image.
:::

## ConfigMaps

A ConfigMap is a Kubernetes object that holds arbitrary key-value pairs. You can store individual values like a log level or a port number, or entire configuration files like an nginx config or a JSON settings file. The keys and values are plain text.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: info
  MAX_CONNECTIONS: '100'
  APP_ENV: production
```

You can also create ConfigMaps imperatively when the values are simple:

```bash
kubectl create configmap app-config \
  --from-literal=LOG_LEVEL=info \
  --from-literal=MAX_CONNECTIONS=100
```

## Secrets

Secrets are structurally identical to ConfigMaps, but they exist to hold sensitive data: passwords, API keys, TLS certificates, tokens. Kubernetes treats them slightly differently: they're stored separately in etcd, access is controlled more granularly with RBAC, and they can be encrypted at rest if the cluster is configured for it.

Values in a Secret manifest must be base64-encoded:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=
```

The encoding is just encoding, not encryption. Anyone who can read the Secret object can easily decode the value. What Secrets provide is a cleaner separation of access control - you can give a team read access to ConfigMaps without giving them access to Secrets - and they're the established convention that tooling (like secret management operators) knows how to integrate with.

Creating Secrets imperatively is usually easier, since it handles the encoding automatically:

```bash
kubectl create secret generic app-secret \
  --from-literal=DB_PASSWORD=password123 \
  --from-literal=API_KEY=my-api-key
```

:::warning
In most default cluster configurations, Secrets are stored unencrypted in etcd. Anyone with read access to etcd or sufficient RBAC permissions can retrieve them. For sensitive production data, configure encryption at rest and apply strict RBAC policies. Base64 encoding is not a security measure.
:::

## Injecting Values as Environment Variables

The most common way to consume a ConfigMap or Secret in a Pod is to inject individual keys as environment variables. The `valueFrom` field in the `env` section lets you pull a specific key from a ConfigMap or Secret:

```yaml
spec:
  containers:
    - name: app
      image: my-app:1.0
      env:
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secret
              key: DB_PASSWORD
```

If you want to inject all keys from a ConfigMap or Secret at once - with the key names becoming the environment variable names - use `envFrom`:

```yaml
spec:
  containers:
    - name: app
      image: my-app:1.0
      envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secret
```

`envFrom` is convenient but can make it harder to see exactly which environment variables a container receives. Prefer explicit `env` entries for variables that are important to the container's behavior.

## Hands-On Practice

**1. Create a ConfigMap:**

```bash
kubectl create configmap web-config \
  --from-literal=APP_ENV=crash-course \
  --from-literal=LOG_LEVEL=debug
```

**2. Create a Secret:**

```bash
kubectl create secret generic web-secret \
  --from-literal=API_TOKEN=super-secret-token
```

**3. Inspect both:**

```bash
kubectl get configmap web-config -o yaml
kubectl get secret web-secret -o yaml
```

In the Secret output, the `data` values are base64-encoded. You can decode one to verify:

```bash
echo "c3VwZXItc2VjcmV0LXRva2Vu" | base64 --decode
```

**4. Create a Pod that consumes both:**

```yaml
# env-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: env-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'env | sort && sleep 3600']
      env:
        - name: APP_ENV
          valueFrom:
            configMapKeyRef:
              name: web-config
              key: APP_ENV
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: web-config
              key: LOG_LEVEL
        - name: API_TOKEN
          valueFrom:
            secretKeyRef:
              name: web-secret
              key: API_TOKEN
```

```bash
kubectl apply -f env-pod.yaml
kubectl get pod env-pod
```

**5. Read the container logs to verify the injected values:**

```bash
kubectl logs env-pod
```

Scroll through the sorted environment variables. You should find `APP_ENV=crash-course`, `LOG_LEVEL=debug`, and `API_TOKEN=super-secret-token` among the output.

**6. Clean up:**

```bash
kubectl delete pod env-pod
kubectl delete configmap web-config
kubectl delete secret web-secret
```
