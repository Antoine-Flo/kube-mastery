---
seoTitle: 'Kubernetes ConfigMap and Secret Volumes, Injecting Configuration as Files'
seoDescription: 'Learn how to mount ConfigMaps and Secrets as files inside a container, giving applications access to configuration and credentials without rebuilding images.'
---

# ConfigMap and Secret Volumes

Your application needs a configuration file at startup. The naive approach is to bake the file into the image. But then every environment change requires a new image build, a new push, and a new deployment. Configuration and code are now coupled in the worst possible way.

Kubernetes separates them. A ConfigMap stores arbitrary key-value pairs or file contents as a cluster object. A Secret stores the same but for sensitive data. Both can be mounted into a container as files, appearing at a path of your choice. The application reads its config file normally, with no awareness that Kubernetes put it there.

## ConfigMap as a Volume

Start by creating a ConfigMap that holds a configuration file:

```bash
nano app-config.yaml
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  config.yaml: |
    log_level: info
    max_connections: 100
    timeout_seconds: 30
```

```bash
kubectl apply -f app-config.yaml
```

The key `config.yaml` becomes the filename. The value is the file content.

Now mount it into a Pod. Build the spec step by step.

First, declare the volume in `spec.volumes`, referencing the ConfigMap by name:

```yaml
# illustrative only
spec:
  volumes:
    - name: config
      configMap:
        name: app-config
```

Then mount it in the container:

```yaml
# illustrative only
  containers:
    - name: app
      image: nginx:1.28
      volumeMounts:
        - name: config
          mountPath: /etc/app
```

The full manifest:

```bash
nano config-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: config-pod
spec:
  volumes:
    - name: config
      configMap:
        name: app-config
  containers:
    - name: app
      image: nginx:1.28
      volumeMounts:
        - name: config
          mountPath: /etc/app
```

```bash
kubectl apply -f config-pod.yaml
```

Once the Pod is running, verify the file is there:

```bash
kubectl exec config-pod -- ls /etc/app
kubectl exec config-pod -- cat /etc/app/config.yaml
```

You should see `config.yaml` with the content from the ConfigMap. The container has no special code to read it, it is just a file on the filesystem.

:::quiz
You update the ConfigMap with a new `log_level: debug`. Does the running Pod see the change immediately?

**Answer:** Eventually yes, with a short delay. Kubernetes syncs ConfigMap-backed volume mounts periodically (default: around 60 seconds). The file on disk is updated automatically without restarting the container. However, whether the application picks up the change depends on how it reads config: applications that re-read config files on a signal or interval will see it; applications that only read config at startup will not until the Pod restarts.
:::

@@@
graph LR
    CM["ConfigMap<br/>app-config<br/>key: config.yaml"]
    VOL["Volume: config<br/>configMap: app-config"]
    FS["/etc/app/config.yaml<br/>inside container"]

    CM --> VOL --> FS
@@@

## Secret as a Volume

Secrets work identically to ConfigMaps from a volume mount perspective. The difference is that Secret values are base64-encoded at rest and Kubernetes handles their distribution more carefully than plain ConfigMaps.

Create a Secret with a database password:

```bash
kubectl create secret generic db-credentials \
  --from-literal=password=s3cr3tpassword \
  --from-literal=username=admin
```

Mount it as a volume:

```bash
nano secret-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-pod
spec:
  volumes:
    - name: creds
      secret:
        secretName: db-credentials
  containers:
    - name: app
      image: nginx:1.28
      volumeMounts:
        - name: creds
          mountPath: /etc/credentials
          readOnly: true
```

```bash
kubectl apply -f secret-pod.yaml
```

```bash
kubectl exec secret-pod -- ls /etc/credentials
kubectl exec secret-pod -- cat /etc/credentials/password
```

Each key in the Secret becomes a file. The value is the decoded content. The `readOnly: true` field prevents the container from modifying the mounted Secret, which is a good default for credentials.

:::warning
Mounting a Secret as a volume does not make it invisible inside the container. Any process running as root can read `/etc/credentials/password`. The `readOnly` flag prevents the container from writing to the mount, not from reading it. Proper security requires also restricting which containers have access to the Secret and running containers as non-root users.
:::

:::quiz
A container needs a TLS certificate and its private key to serve HTTPS. Both are stored as keys in a Secret. After mounting the Secret as a volume at `/etc/tls`, what does the container see at that path?

**Try it:** `kubectl exec <pod> -- ls /etc/tls`

**Answer:** Two files, one per key in the Secret. If the Secret has keys `tls.crt` and `tls.key`, the container sees `/etc/tls/tls.crt` and `/etc/tls/tls.key`. The application reads them as regular files with no knowledge of Kubernetes.
:::

Clean up:

```bash
kubectl delete pod config-pod secret-pod
kubectl delete configmap app-config
kubectl delete secret db-credentials
```

ConfigMap and Secret volumes decouple configuration from images. You update the cluster object, and the mounted files update in running Pods without a rebuild. The next lesson steps up to a different class of storage problem: data that must outlive the Pod entirely, across deletions, restarts, and rescheduling events.
