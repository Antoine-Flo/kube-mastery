---
seoTitle: 'Creating Kubernetes ConfigMaps, from-literal, from-file, YAML'
seoDescription: 'Learn three ways to create Kubernetes ConfigMaps: from literal values with kubectl, from existing files, and from YAML manifests for version-controlled config.'
---

# Creating ConfigMaps

There are three common ways to create a ConfigMap: from literal values on the command line, from an existing file, and from a YAML manifest. Each has its place. Knowing all three is required for the CKA exam, where you may be asked to create a ConfigMap from a file or to write the manifest directly.

## From literal values

The quickest way to create a ConfigMap is with `--from-literal`. Each flag adds one key-value pair:

```bash
kubectl create configmap app-env \
  --from-literal=LOG_LEVEL=debug \
  --from-literal=REGION=eu-west-1 \
  --from-literal=MAX_RETRIES=5
```

```bash
kubectl get configmap app-env -o yaml
```

The `data` section contains your three key-value pairs, each as a string. This approach is fast for small sets of values but becomes unwieldy for more than a handful of keys.

## From a file

When your application reads configuration from a file (a properties file, a config.yaml, an Nginx template), you store the file contents as a ConfigMap value:

```bash
nano app.properties
```

```
log.level=info
db.max.connections=50
feature.dark-mode=true
```

```bash
kubectl create configmap app-file-config --from-file=app.properties
```

```bash
kubectl describe configmap app-file-config
```

The key is the filename (`app.properties`) and the value is the full file content. When you mount this ConfigMap as a volume, the container receives a file named `app.properties` containing those lines. You can also set a custom key name:

```bash
kubectl create configmap app-custom-key --from-file=config=app.properties
```

Now the key is `config` instead of `app.properties`. This is useful when the mounting path in the container should differ from the original filename.

:::quiz
You run `kubectl create configmap nginx-conf --from-file=nginx.conf`. What is the key in the ConfigMap?

**Answer:** `nginx.conf`. When using `--from-file`, the key defaults to the filename (including the extension). The value is the full content of the file. You can override the key by using the `key=filename` syntax: `--from-file=custom-key=nginx.conf`.
:::

## From a YAML manifest

For production workloads, store ConfigMaps in YAML and commit them to version control. Generating a skeleton with `--dry-run` is faster than writing from scratch:

```bash
kubectl create configmap app-env \
  --from-literal=LOG_LEVEL=debug \
  --from-literal=REGION=eu-west-1 \
  --dry-run=client -o yaml > configmap.yaml
```

Open the file:

```bash
cat configmap.yaml
```

You see the standard Kubernetes object structure with `kind: ConfigMap` and a `data` section. Edit the file to add or remove keys, then apply:

```bash
kubectl apply -f configmap.yaml
```

For a file-based ConfigMap in YAML, use the multiline string syntax:

```bash
nano nginx-configmap.yaml
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  nginx.conf: |
    server {
      listen 80;
      location / {
        root /usr/share/nginx/html;
      }
    }
  log-level: info
```

The `|` character starts a literal block scalar in YAML: newlines are preserved exactly. This is how multi-line config file content is stored in a ConfigMap manifest.

```bash
kubectl apply -f nginx-configmap.yaml
kubectl describe configmap nginx-config
```

Both keys appear: `nginx.conf` contains the full server block, and `log-level` contains the string `info`.

:::warning
When editing a ConfigMap that is already consumed by running Pods, changes to environment variables do not propagate to running containers. Environment variables are set at container startup. To pick up new values, the Pod must be restarted. Volume-mounted ConfigMaps are different and can reload without a restart, which the volume mount lesson covers.
:::

:::quiz
A ConfigMap has two keys: `database-url` and `database.conf`. How do these differ in typical usage?

**Answer:** `database-url` is likely a short string value injected as an environment variable. `database.conf` suggests a multi-line file content that would be mounted as a file in a volume. Both are valid ConfigMap keys. The key name does not change how ConfigMap stores the value, only how you and the Pod consume it.
:::

```bash
kubectl delete configmap app-env app-file-config app-custom-key nginx-config
```

Literal values for simple key-value config, `--from-file` for existing config files, YAML manifests for version-controlled production config: these three creation methods cover every ConfigMap scenario you will encounter. The next lesson shows how to inject ConfigMap data into containers as environment variables.
