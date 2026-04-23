---
seoTitle: 'ConfigMap Volume Mount, Mount Config Files in Kubernetes Pods'
seoDescription: 'Learn how to mount Kubernetes ConfigMap data as files in a Pod volume, including mounting specific keys, and how volume-mounted ConfigMaps update without restart.'
---

# Using ConfigMaps via Volume Mounts

Environment variables work well for short strings. They break down for multi-line config files. You cannot inject an Nginx configuration block or a JSON settings file as a single env var. Volume mounts solve this: each ConfigMap key becomes a file in a directory inside the container.

Start with a ConfigMap that holds a config file:

```bash
nano nginx-config.yaml
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
      server_name _;
      location /health {
        return 200 'ok';
      }
    }
  log-format: combined
```

```bash
kubectl apply -f nginx-config.yaml
```

## Mounting all keys as files

@@@
graph LR
subgraph cm ["ConfigMap: nginx-config"]
  K1["nginx.conf\n(multi-line value)"]
  K2["log-format\n= combined"]
end
subgraph pod ["Pod /etc/nginx/"]
  F1["nginx.conf\n(file)"]
  F2["log-format\n(file)"]
end
cm -->|"volume mount"| pod
@@@

A `configMap` volume type mounts every key as a separate file in the specified directory. The key name becomes the filename. The value becomes the file content.

```bash
nano nginx-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
spec:
  containers:
    - name: nginx
      image: busybox:1.36
      command: ['sh', '-c', 'ls /etc/nginx-config/ && cat /etc/nginx-config/nginx.conf']
      volumeMounts:
        - name: config-vol
          mountPath: /etc/nginx-config
  volumes:
    - name: config-vol
      configMap:
        name: nginx-config
  restartPolicy: Never
```

```bash
kubectl apply -f nginx-pod.yaml
kubectl logs nginx-pod
```

The output lists both files: `nginx.conf` and `log-format`. Then it prints the full contents of `nginx.conf`. Each ConfigMap key became a separate file.

## Mounting a specific key

Sometimes you want only one file from the ConfigMap, not all of them. Use the `items` field to select specific keys and map them to specific filenames:

```bash
nano nginx-selective.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-selective
spec:
  containers:
    - name: nginx
      image: busybox:1.36
      command: ['sh', '-c', 'ls /etc/nginx/ && cat /etc/nginx/server.conf']
      volumeMounts:
        - name: config-vol
          mountPath: /etc/nginx
  volumes:
    - name: config-vol
      configMap:
        name: nginx-config
        items:
          - key: nginx.conf
            path: server.conf
  restartPolicy: Never
```

```bash
kubectl apply -f nginx-selective.yaml
kubectl logs nginx-selective
```

Only one file appears: `server.conf`. The `log-format` key was not listed in `items`, so it was not mounted. The file is named `server.conf` instead of `nginx.conf` because the `path` field controls the destination filename.

:::quiz
A ConfigMap has 5 keys. A Pod mounts it with an `items` field that lists only 2 of them. How many files appear in the mounted directory?

**Answer:** 2. The `items` field acts as a filter and a rename map. Only listed keys are projected into the volume. Unlisted keys are not included. This is useful when you want to mount only the relevant config file for a specific container without exposing the rest.
:::

## Live updates without restart

When you update a ConfigMap, volume-mounted files are updated automatically. The kubelet periodically refreshes ConfigMap volumes (typically within a minute). The container sees the new file content without being restarted.

Edit the ConfigMap:

```bash
kubectl edit configmap nginx-config
```

Change `log-format` from `combined` to `short`. Save and exit. Wait a moment, then exec into the Pod to see the change:

```bash
kubectl exec nginx-pod -- cat /etc/nginx-config/log-format
```

The file content reflects the updated value. The container did not restart.

:::warning
This live update behavior applies only to volume-mounted ConfigMaps. Environment variables set from a ConfigMap are fixed at container startup and do not update when the ConfigMap changes. If your application reads configuration from environment variables, a Pod restart is required to pick up new values. If it reads from files, it may pick up changes automatically if it watches the file. Verify your application's config reload behavior before relying on live updates.
:::

```bash
kubectl delete pod nginx-pod nginx-selective
kubectl delete configmap nginx-config
```

:::quiz
You update a ConfigMap value. A Pod using it via `envFrom` still shows the old value. A second Pod using a volume mount shows the new value. Why the difference?

**Answer:** Environment variables are set once at container startup from the ConfigMap values at that moment. Updating the ConfigMap does not change running containers' environment. Volume-mounted ConfigMaps are refreshed periodically by the kubelet, so file content updates without a restart. To update env-var-based configuration, you must restart the Pod.
:::

Volume mounts handle multi-line config files cleanly and support live updates. The next lesson covers immutable ConfigMaps, a performance optimization for high-scale clusters.
