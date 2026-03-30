# ConfigMap and Secret Volumes

In the workloads module you learned to inject ConfigMap and Secret values as environment variables. That works well for simple scalar values - a log level, a port number, a feature flag. But some applications need their configuration as files. An nginx server expects a `.conf` file in a specific directory. A TLS-enabled application needs certificate and key files on disk. A complex app might have a multi-section configuration file with dozens of settings that are cumbersome to express as individual environment variables.

Kubernetes supports mounting ConfigMaps and Secrets as volumes, where each key in the object becomes a file and the corresponding value becomes the file's content. The application reads its configuration from disk, exactly as it would from a locally managed config file, without knowing or caring that the content comes from the Kubernetes API.

:::info
When a ConfigMap or Secret is mounted as a volume, each key becomes a filename and its value becomes the file content. The application sees regular files, not environment variables.
:::

## Mounting a ConfigMap as Files

The volume declaration references the ConfigMap by name, and the mount path is where the files will appear inside the container's filesystem:

```yaml
spec:
  volumes:
    - name: config
      configMap:
        name: nginx-config
  containers:
    - name: web
      image: nginx:1.28
      volumeMounts:
        - name: config
          mountPath: /etc/nginx/conf.d
```

If the ConfigMap named `nginx-config` has a key called `default.conf`, the container will see a file at `/etc/nginx/conf.d/default.conf` containing the value from that key. If the ConfigMap has ten keys, the container sees ten files in that directory. The directory is entirely managed by Kubernetes - you can't mix ConfigMap files with other files in the same mount path.

If you only want to mount specific keys, or you want to control the filename that appears inside the container, use the `items` field:

```yaml
volumes:
  - name: config
    configMap:
      name: app-config
      items:
        - key: production.yaml   # key in the ConfigMap
          path: config.yaml      # filename inside the container
```

## Mounting a Secret as Files

Secrets mount the same way, with `secret` instead of `configMap` in the volume declaration. Files created from Secret keys are given restrictive permissions by default, and marking the mount `readOnly` is a good practice for credentials that your application only needs to read:

```yaml
spec:
  volumes:
    - name: tls-certs
      secret:
        secretName: my-tls-secret
  containers:
    - name: app
      image: my-app:1.0
      volumeMounts:
        - name: tls-certs
          mountPath: /etc/ssl/certs
          readOnly: true
```

## When Files Are Better Than Environment Variables

Environment variables are set once at container startup and don't change until the container restarts. ConfigMap and Secret volumes, on the other hand, are updated automatically when the underlying object changes - with a short delay, typically under a minute. This means that for applications capable of reloading their configuration from disk without restarting (nginx with `nginx -s reload`, for example), you can update a ConfigMap and have the change propagate to running containers without any redeployment.

This is also why TLS certificates are almost always mounted as files rather than injected as environment variables. Certificate rotation tools update the Secret object, the files inside the container are updated, and the application is signaled to reload its TLS configuration - all without a container restart.

## Hands-On Practice

**1. Create a ConfigMap with a multi-line configuration value:**

```yaml
# nginx-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  default.conf: |
    server {
      listen 80;
      location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
      }
    }
```

```bash
kubectl apply -f nginx-configmap.yaml
```

**2. Mount it into an nginx Pod:**

```yaml
# nginx-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-config-demo
spec:
  volumes:
    - name: nginx-conf
      configMap:
        name: nginx-config
  containers:
    - name: web
      image: nginx:1.28
      volumeMounts:
        - name: nginx-conf
          mountPath: /etc/nginx/conf.d
```

```bash
kubectl apply -f nginx-pod.yaml
kubectl get pod nginx-config-demo
```

**3. Verify the file exists inside the container:**

```bash
kubectl exec nginx-config-demo -- ls /etc/nginx/conf.d/
kubectl exec nginx-config-demo -- cat /etc/nginx/conf.d/default.conf
```

The file content matches the value in the ConfigMap.

**4. Create a Secret and mount it as files:**

```bash
kubectl create secret generic app-creds \
  --from-literal=username=admin \
  --from-literal=password=s3cret
```

```yaml
# secret-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-volume-demo
spec:
  volumes:
    - name: creds
      secret:
        secretName: app-creds
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'ls -la /credentials && echo "---" && cat /credentials/username && sleep 3600']
      volumeMounts:
        - name: creds
          mountPath: /credentials
          readOnly: true
```

```bash
kubectl apply -f secret-pod.yaml
kubectl logs secret-volume-demo
```

You'll see the two files - `username` and `password` - with restricted permissions, and then the content of the `username` file.

**5. Clean up:**

```bash
kubectl delete pod nginx-config-demo secret-volume-demo
kubectl delete configmap nginx-config
kubectl delete secret app-creds
```
