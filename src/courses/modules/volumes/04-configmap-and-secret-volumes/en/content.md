# Mounting ConfigMaps and Secrets as Volumes

In earlier lessons you likely encountered ConfigMaps and Secrets used as environment variables , a quick way to inject a database URL or an API key into a running container. But injecting config as environment variables has real limitations. Some applications don't read environment variables at all; they expect a config file at a specific path. Others have configuration that's too complex for a flat list of key-value pairs , think a multi-section NGINX config, a full application properties file, or a TLS certificate bundle. And sometimes you have many related values that logically belong together in one file rather than scattered across environment variables.

Kubernetes solves all of this by letting you mount ConfigMaps and Secrets directly as files inside your containers, using the same volume mechanism you've already learned.

## The Core Idea: Keys Become Files

When you mount a ConfigMap (or Secret) as a volume, each key in that ConfigMap becomes a file inside the container at the specified mount path. The file's content is the key's value. It's a direct, one-to-one mapping between the key-value data in your Kubernetes object and the file structure inside the container.

Imagine you have a ConfigMap with two keys: `app.properties` and `log4j.xml`. After mounting it, the container sees exactly those two files inside the mount directory, with exactly the correct content in each. The application can read them like any ordinary files , it doesn't need to know they came from Kubernetes at all.

## Mounting a ConfigMap as a Volume

Here's the complete process. First, create a ConfigMap with some configuration data:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  database.conf: |
    host=postgres-service
    port=5432
    name=mydb
    pool_size=10
  logging.conf: |
    level=INFO
    format=json
    output=stdout
```

Then reference it as a volume in your Pod spec:

```yaml
spec:
  volumes:
    - name: app-config
      configMap:
        name: app-config
  containers:
    - name: app
      image: my-app:latest
      volumeMounts:
        - name: app-config
          mountPath: /etc/config
```

Inside the container, the directory `/etc/config` will contain exactly two files: `database.conf` and `logging.conf`, each with the correct multi-line content. The application can open `/etc/config/database.conf` the same way it would open any file , no Kubernetes SDK needed, no special integration required.

## Mounting a Secret as a Volume

The syntax for mounting a Secret is nearly identical , you just replace `configMap:` with `secret:` and provide the Secret's name:

```yaml
spec:
  volumes:
    - name: tls-certs
      secret:
        secretName: my-tls-secret
  containers:
    - name: app
      image: my-app:latest
      volumeMounts:
        - name: tls-certs
          mountPath: /etc/tls
          readOnly: true
```

When mounted, Secret files have restrictive permissions by default , `0400` (readable only by the owner). This means the container process can read them, but other users on the same node generally cannot. This is intentional: Secrets often contain credentials or private keys that should be tightly restricted.

:::info
Setting `readOnly: true` on the volumeMount is a best practice for both ConfigMap and Secret mounts. Your application should be reading configuration files, not writing to them. A readOnly mount prevents accidental writes and makes it immediately clear in the manifest that this volume is input data.
:::

## The Keys-to-Files Mapping

```mermaid
graph LR
    subgraph "ConfigMap: app-config"
        K1["Key: database.conf\nValue: host=postgres..."]
        K2["Key: logging.conf\nValue: level=INFO..."]
    end

    subgraph "Container filesystem at /etc/config"
        F1["/etc/config/database.conf\n(file contents = key value)"]
        F2["/etc/config/logging.conf\n(file contents = key value)"]
    end

    K1 -->|"becomes"| F1
    K2 -->|"becomes"| F2

    style K1 fill:#4A90D9,color:#fff,stroke:#2c6fad
    style K2 fill:#4A90D9,color:#fff,stroke:#2c6fad
    style F1 fill:#7ED321,color:#fff,stroke:#5a9c18
    style F2 fill:#7ED321,color:#fff,stroke:#5a9c18
```

## Mounting Only Specific Keys

If a ConfigMap contains many keys but you only want to mount a subset of them , or you want to control what the file is named inside the container , you can use the `items` field:

```yaml
volumes:
  - name: partial-config
    configMap:
      name: app-config
      items:
        - key: database.conf
          path: db/connection.conf
        - key: logging.conf
          path: logs/settings.conf
```

With this declaration, the container will see two files: `/etc/config/db/connection.conf` and `/etc/config/logs/settings.conf`. The key named `database.conf` in the ConfigMap is mounted at the custom path `db/connection.conf` relative to the `mountPath`. This lets you adapt the Kubernetes key names to whatever file layout your application expects, without modifying the ConfigMap.

Any keys in the ConfigMap not listed in `items` are simply not mounted , they don't appear in the container's filesystem at all.

## The Hot-Reload Superpower

Here's one of the most compelling advantages of volume-mounted ConfigMaps over environment variables: **when the ConfigMap changes, the mounted files update automatically:**  no Pod restart required.

Kubernetes's kubelet periodically syncs volume-mounted ConfigMaps (typically within 30-60 seconds, sometimes up to 2 minutes). When it detects that the ConfigMap has been updated, it writes the new file contents to the mounted directory. Applications that watch for file changes (inotify-based watchers, or applications that poll their config file) can pick up the new configuration entirely live.

This enables a powerful operational pattern: update a ConfigMap, and within a minute, your application reloads its configuration without any downtime, without any rollout, without any Pod restart. For things like feature flags, logging levels, or tunable parameters, this is extremely convenient.

:::warning
**Environment variables from ConfigMaps do NOT hot-reload.** If you inject a ConfigMap key as an environment variable (`env.valueFrom.configMapKeyRef`), the only way to pick up a changed value is to restart the Pod. Volume mounts are the only path to live configuration updates. This is a significant operational difference , choose your injection method based on whether live reload matters to you.
:::

## Practical Example: NGINX Configuration

Let's tie this together with a realistic scenario. You want to run NGINX with a custom configuration stored in a ConfigMap, so you can update the config without rebuilding the container image.

First, the ConfigMap with the NGINX configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  nginx.conf: |
    events {}
    http {
      server {
        listen 80;
        location / {
          return 200 "Hello from configmap-driven nginx!\n";
          add_header Content-Type text/plain;
        }
      }
    }
```

Then the Pod that mounts it:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-custom
spec:
  volumes:
    - name: nginx-config
      configMap:
        name: nginx-config
  containers:
    - name: nginx
      image: nginx:1.25
      volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/nginx.conf
          subPath: nginx.conf
          readOnly: true
```

Notice the `subPath` field here. Normally, mounting a volume to `/etc/nginx/nginx.conf` would replace the entire `/etc/nginx/` directory with the ConfigMap's contents. That would wipe out all the other NGINX configuration files in that directory. `subPath` lets you mount a single key from the ConfigMap to a single specific file path, without disturbing anything else in the parent directory.

:::warning
There is an important limitation of `subPath`: **files mounted with `subPath` do NOT receive live updates when the ConfigMap changes**. The hot-reload feature only works for full-directory mounts, not `subPath` mounts. If you need hot reloading, mount the ConfigMap to a separate directory and symlink your target path to it, or restructure your configuration to use a directory-based layout.
:::

## Default File Permissions

By default, files mounted from a ConfigMap have permissions `0644` , readable by everyone, writable only by the owner. Secrets default to `0400` , readable only by the owner. You can override the default permissions for all files in a volume with the `defaultMode` field, expressed as a decimal integer:

```yaml
volumes:
  - name: app-config
    configMap:
      name: app-config
      defaultMode: 0640
```

You can also set different permissions for individual keys when using `items[]`, using the `mode` field on each item.

## Hands-On Practice

Let's mount a ConfigMap as files and then update the ConfigMap to see the live reload. Use the terminal on the right panel.

**1. Create a ConfigMap with some configuration data:**

```bash
kubectl create configmap demo-config \
  --from-literal=greeting.txt="Hello from ConfigMap!" \
  --from-literal=settings.conf="color=blue\nsize=large"
```

**2. Verify the ConfigMap was created:**

```bash
kubectl get configmap demo-config -o yaml
```

**3. Create a Pod that mounts the ConfigMap:**

```bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: config-reader
spec:
  volumes:
    - name: config-vol
      configMap:
        name: demo-config
  containers:
    - name: reader
      image: busybox:1.36
      command: ["sh", "-c", "while true; do echo '---'; ls /config; cat /config/greeting.txt; sleep 10; done"]
      volumeMounts:
        - name: config-vol
          mountPath: /config
          readOnly: true
EOF
```

**4. Wait for it to start, then check the logs:**

```bash
kubectl get pod config-reader
kubectl logs config-reader
```

You should see the directory listing showing both files, and the content of `greeting.txt`.

**5. List the files inside the mounted directory:**

```bash
kubectl exec config-reader -- ls /config
kubectl exec config-reader -- cat /config/greeting.txt
kubectl exec config-reader -- cat /config/settings.conf
```

**6. Update the ConfigMap and watch for the live update:**

```bash
kubectl create configmap demo-config \
  --from-literal=greeting.txt="Updated greeting , no restart needed!" \
  --from-literal=settings.conf="color=green\nsize=small" \
  --dry-run=client -o yaml | kubectl apply -f -
```

**7. Wait about 60 seconds, then check the file contents inside the container:**

```bash
kubectl exec config-reader -- cat /config/greeting.txt
```

After the sync period, you should see the updated greeting without having restarted the Pod.

**8. Verify the Pod was NOT restarted:**

```bash
kubectl get pod config-reader
```

The restart count should still be 0. The configuration updated live.

**9. Now create a Secret and mount it the same way:**

```bash
kubectl create secret generic demo-secret \
  --from-literal=api-key="super-secret-value-12345" \
  --from-literal=token="eyJhbGciOiJIUzI1NiJ9..."

kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: secret-reader
spec:
  volumes:
    - name: secret-vol
      secret:
        secretName: demo-secret
  containers:
    - name: reader
      image: busybox:1.36
      command: ["sh", "-c", "ls /secrets && cat /secrets/api-key && sleep 3600"]
      volumeMounts:
        - name: secret-vol
          mountPath: /secrets
          readOnly: true
EOF
```

**10. Read the secret file from inside the container:**

```bash
kubectl logs secret-reader
```

**11. Check file permissions on the Secret mount , they should be 0400:**

```bash
kubectl exec secret-reader -- ls -la /secrets/
```

Notice the permissions: `-r--------` , readable only by the owner, as expected for sensitive data.

**12. Clean up:**

```bash
kubectl delete pod config-reader secret-reader
kubectl delete configmap demo-config
kubectl delete secret demo-secret
```

You've now mastered all four volume types covered in this module. You understand the ephemeral nature of container filesystems, the Pod-scoped persistence of `emptyDir`, the node-coupled power and danger of `hostPath`, and the elegant configuration injection capabilities of ConfigMap and Secret volumes. These tools, used thoughtfully, cover the vast majority of storage needs you'll encounter for stateless and semi-stateful workloads in Kubernetes.
