---
seoTitle: 'Kubernetes ConfigMaps and Secrets, Injection, Best Practices'
seoDescription: 'Learn how to use Kubernetes ConfigMaps for non-sensitive configuration and Secrets for sensitive data, injecting values as environment variables or files.'
---

# ConfigMaps and Secrets

You have a containerized application that connects to a database. The database URL is different in staging and production. You have two options: bake the URL into the image and build separate images for each environment, or store the URL outside the image and inject it at runtime. The first option means rebuilding and redeploying every time a URL changes. It also means the same image cannot run in two environments without modification, and sensitive values like passwords end up in image layers that could be extracted.

Kubernetes solves this with two objects that separate configuration from the container image: **ConfigMaps** for non-sensitive values and **Secrets** for sensitive data.

## ConfigMaps

A ConfigMap holds arbitrary key-value pairs. You declare what your application needs, the cluster stores it, and you inject it into Pods at runtime without touching the image.

Create one imperatively for quick experimentation:

```bash
kubectl create configmap web-config --from-literal=APP_ENV=staging --from-literal=LOG_LEVEL=debug
```

Inspect what was created:

```bash
kubectl get configmap web-config -o yaml
```

The values live in the `data` field as plain text. There is no encoding, no transformation, exactly what you put in.

You can also write a ConfigMap as a manifest, which is better for files you want to commit to version control:

```yaml
# illustrative only
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: info
  MAX_CONNECTIONS: '100'
  APP_ENV: production
```

:::quiz
You create a ConfigMap with `kubectl create configmap app-config --from-literal=PORT=8080`. Where does Kubernetes store this value, and in what form?

**Try it:** `kubectl get configmap web-config -o yaml`

**Answer:** In the `data` field of the ConfigMap object, as a plain text string. No encoding, no encryption. Anyone with read access to the ConfigMap can see the value in cleartext.
:::

## Secrets

Secrets are structurally identical to ConfigMaps. The difference is intent: Secrets are designed to hold sensitive data: passwords, API tokens, TLS certificates. Kubernetes stores them separately in etcd, applies stricter RBAC defaults, and tooling like secret management operators knows how to integrate with them specifically.

Values in a Secret manifest must be base64-encoded:

```yaml
# illustrative only
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=
```

Create one imperatively: it handles the encoding automatically:

```bash
kubectl create secret generic web-secret --from-literal=API_TOKEN=super-secret-token
```

Now inspect it:

```bash
kubectl get secret web-secret -o yaml
```

You will see the value base64-encoded in the `data` field.

:::warning
Base64 is encoding, not encryption. Anyone who can read the Secret object can decode the value in seconds. What Secrets provide is **access control separation**: you can grant a team read access to ConfigMaps without granting them access to Secrets, and the established convention for tooling integration. In most default cluster configurations, Secrets are stored unencrypted in etcd. For sensitive production data, configure encryption at rest and apply strict RBAC policies.
:::

:::quiz
What is the security difference between storing a value in a ConfigMap versus a Secret in a default Kubernetes cluster?

- Secrets are encrypted at rest, ConfigMaps are not
- Secrets and ConfigMaps have identical security: the difference is only organizational
- Secrets use separate storage and stricter RBAC defaults, but are not encrypted unless explicitly configured

**Answer:** Secrets use separate storage and stricter RBAC defaults, but are not encrypted unless explicitly configured. In a default cluster, the security difference is access control granularity, not encryption. The encryption-at-rest feature exists but must be explicitly enabled.
:::

## Injecting Values as Environment Variables

@@@
graph LR
CM["ConfigMap<br/>LOG_LEVEL: debug<br/>APP_ENV: staging"]
SEC["Secret<br/>API_TOKEN: ●●●●"]
POD["Pod<br/>Container"]

    CM -->|"env: LOG_LEVEL=debug"| POD
    CM -->|"env: APP_ENV=staging"| POD
    SEC -->|"env: API_TOKEN=●●●●"| POD

@@@

The most common injection method is pulling specific keys into environment variables using `valueFrom`. You reference the object by name and the key you want:

```yaml
# illustrative only
env:
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

If you want every key from a ConfigMap or Secret to become an environment variable at once, use `envFrom`:

```yaml
# illustrative only
envFrom:
  - configMapRef:
      name: web-config
  - secretRef:
      name: web-secret
```

`envFrom` is convenient but makes it harder to see exactly which variables a container receives just by reading the manifest. Prefer explicit `env` entries for variables that are important to the container's behavior: it is immediately obvious what the container gets and where it comes from.

Why does Kubernetes provide both `env` and `envFrom`? Because these are different workflows. Explicit `env` is for configuration that the application spec depends on. `envFrom` is for bulk injection from shared config objects that teams manage separately.

Now create a Pod that uses both objects:

```bash
nano env-pod.yaml
```

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
      command: ['sleep', '3600']
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

Once it is Running, verify the variables are actually inside the container:

```bash
kubectl exec env-pod -- env
```

You should find `APP_ENV=staging`, `LOG_LEVEL=debug`, and `API_TOKEN=super-secret-token` in the output.

:::quiz
What happens if you reference a ConfigMap key that does not exist in the `valueFrom` field?

**Answer:** The Pod will fail to start and remain in the `Pending` state with a `CreateContainerConfigError` reason. Kubernetes validates the reference when it tries to create the container, not when you apply the manifest. Always verify the key names match exactly: a typo in the key name will silently block your Pod.
:::

Now clean up what you created. You have the resources in the terminal history. Delete the Pod, the ConfigMap, and the Secret using what you know:

```bash
kubectl delete pod env-pod
kubectl delete configmap web-config
kubectl delete secret web-secret
```

ConfigMaps and Secrets let you run one image everywhere and swap configuration per environment. The access control split between them is what allows teams to manage sensitive credentials separately from general application configuration.
