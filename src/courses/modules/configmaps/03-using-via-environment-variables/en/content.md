---
seoTitle: 'ConfigMap Environment Variables, valueFrom, envFrom in Kubernetes'
seoDescription: 'Learn how to inject Kubernetes ConfigMap data into containers as environment variables using valueFrom configMapKeyRef and envFrom configMapRef.'
---

# Using ConfigMaps via Environment Variables

The simplest way to consume a ConfigMap in a container is via environment variables. The application reads `os.getenv("LOG_LEVEL")` and Kubernetes injects the value from the ConfigMap at container startup. No file system access needed, no config parsing library required.

First, create a ConfigMap to work with:

```bash
kubectl create configmap app-config \
  --from-literal=LOG_LEVEL=info \
  --from-literal=PORT=8080 \
  --from-literal=REGION=eu-west-1
```

## Injecting a single key

Use `env.valueFrom.configMapKeyRef` to map one ConfigMap key to one environment variable:

```bash
nano env-single.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: env-single
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'echo LOG_LEVEL=$LOG_LEVEL && sleep 3600']
      env:
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: LOG_LEVEL
  restartPolicy: Never
```

```bash
kubectl apply -f env-single.yaml
kubectl logs env-single
```

The output shows `LOG_LEVEL=info`. The container received the value from the ConfigMap without it being hardcoded in the Pod spec.

The `name` field under `env` is the environment variable name inside the container. It does not have to match the ConfigMap key. You could name the env var `APPLICATION_LOG_LEVEL` while the ConfigMap key is `LOG_LEVEL`.

:::quiz
A ConfigMap has a key `db.host`. A Pod injects it with `env.name: DATABASE_HOST`. Inside the container, which name is available?

**Answer:** `DATABASE_HOST`. The `name` under `env` is the environment variable name visible inside the container. The ConfigMap key (`db.host`) is just the source. You can rename freely. This is useful when the ConfigMap uses dot notation (common in Java properties) but your application expects underscore notation.
:::

## Injecting all keys at once

Use `envFrom.configMapRef` to inject every key in a ConfigMap as a separate environment variable. This avoids listing each key individually:

```bash
nano env-all.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: env-all
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'env | grep -E "LOG_LEVEL|PORT|REGION"']
      envFrom:
        - configMapRef:
            name: app-config
  restartPolicy: Never
```

```bash
kubectl apply -f env-all.yaml
kubectl logs env-all
```

All three keys from `app-config` appear as environment variables. The variable names are taken directly from the ConfigMap keys.

:::warning
`envFrom` injects every key in the ConfigMap. If the ConfigMap contains keys with characters that are not valid environment variable names (dots, hyphens), the injection for those keys silently fails. The Pod starts, but those variables are absent. You will see a warning event on the Pod but no startup error. When in doubt, use `env.valueFrom.configMapKeyRef` for individual keys you control.
:::

## What happens when the ConfigMap is missing

If the ConfigMap referenced by `configMapKeyRef` does not exist when the Pod starts, the Pod fails to start with an error like `Error: configmap "app-config" not found`. The container never reaches `Running` state.

```bash
nano env-missing.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: env-missing
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'echo $MISSING_KEY']
      env:
        - name: MISSING_KEY
          valueFrom:
            configMapKeyRef:
              name: does-not-exist
              key: some-key
  restartPolicy: Never
```

```bash
kubectl apply -f env-missing.yaml
kubectl describe pod env-missing
```

Look at the `Events` section. You will see `Error: configmap "does-not-exist" not found`. To make the reference optional (inject the variable only if the ConfigMap exists), add `optional: true` to the `configMapKeyRef`:

```yaml
configMapKeyRef:
  name: optional-config
  key: some-key
  optional: true
```

With `optional: true`, if the ConfigMap or the key does not exist, the environment variable is simply absent and the Pod starts normally.

:::quiz
A Pod uses `envFrom.configMapRef` to load a ConfigMap that has 10 keys. Three of those keys contain dots in their names. How many environment variables does the container receive?

**Answer:** 7. Keys with dots (like `app.name`) are not valid environment variable names. `envFrom` silently skips invalid keys. The Pod starts successfully, but those three variables are not set. If the application expects them, it will fail at runtime rather than at startup.
:::

```bash
kubectl delete pod env-single env-all env-missing
```

Use `valueFrom.configMapKeyRef` when you need specific keys or want to rename them. Use `envFrom.configMapRef` when you want the full ConfigMap as-is and the key names are valid env var names. The next lesson covers the second injection method: mounting ConfigMap data as files in a volume.
