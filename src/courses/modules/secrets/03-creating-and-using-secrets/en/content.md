---
seoTitle: 'Using Kubernetes Secrets in Pods, env vars, volume mounts'
seoDescription: 'Learn how to inject Kubernetes Secrets into containers via environment variables and volume mounts, with practical examples and the key differences from ConfigMaps.'
---

# Creating and Using Secrets in Pods

The injection mechanics for Secrets are identical to ConfigMaps: `valueFrom.secretKeyRef` for individual keys, `envFrom.secretRef` for all keys, and volume mounts for file-based injection. You already know the pattern. This lesson focuses on where Secrets behave differently and what to watch for.

Create a Secret to work with:

```bash
kubectl create secret generic app-secret \
  --from-literal=DB_PASSWORD=s3cr3t \
  --from-literal=API_KEY=abc123xyz
```

## Injecting via environment variables

The `secretKeyRef` field mirrors `configMapKeyRef` exactly:

```bash
nano secret-env-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-env-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'echo DB_PASSWORD is set: $DB_PASSWORD && sleep 3600']
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secret
              key: DB_PASSWORD
  restartPolicy: Never
```

```bash
kubectl apply -f secret-env-pod.yaml
kubectl logs secret-env-pod
```

The output prints the password value. This is one of the risks of injecting Secrets as environment variables: the application can accidentally log them, they appear in crash dumps, and they are visible to any process in the container.

:::warning
Environment variables injected from Secrets are accessible to every process inside the container, including child processes started by the main process. They can leak into logs if the application is not careful. Volume-mounted Secrets as files are slightly better: the application reads the file explicitly, and you can set file permissions. For high-security workloads, prefer volume mounts over environment variables for Secrets.
:::

## Injecting via volume mount

Mounting a Secret as a volume works exactly like ConfigMaps. Each key becomes a file:

```bash
nano secret-volume-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-volume-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'ls /etc/secrets/ && cat /etc/secrets/DB_PASSWORD']
      volumeMounts:
        - name: secret-vol
          mountPath: /etc/secrets
          readOnly: true
  volumes:
    - name: secret-vol
      secret:
        secretName: app-secret
  restartPolicy: Never
```

```bash
kubectl apply -f secret-volume-pod.yaml
kubectl logs secret-volume-pod
```

Two files appear: `DB_PASSWORD` and `API_KEY`. The contents are the plain text values (already decoded from base64 by Kubernetes). The container reads raw values, not base64.

Note the `readOnly: true` on the volume mount. This prevents the container from writing back to the Secret volume, which is a good default for credentials.

:::quiz
A Secret stores a password as a base64-encoded value. A Pod mounts it as a volume. What does the container read from the mounted file?

**Answer:** The decoded plain text value. Kubernetes decodes the base64 automatically when projecting Secret data into a volume or environment variable. The container always receives the raw string, not the base64-encoded form. Base64 encoding is a storage detail of the Kubernetes API, transparent to the consuming workload.
:::

## Verifying what the Pod actually sees

For debugging, check the mounted Secret content without printing the value in commands:

```bash
kubectl exec secret-volume-pod -- ls -la /etc/secrets/
```

The file listing shows the permissions on each file. By default, Secret volume files are mode `0644`. If your application requires stricter permissions (e.g., SSH keys require `0600`), set `defaultMode` on the volume:

```yaml
volumes:
  - name: secret-vol
    secret:
      secretName: app-secret
      defaultMode: 0400
```

```bash
kubectl delete pod secret-env-pod secret-volume-pod
kubectl delete secret app-secret
```

:::quiz
You need to inject a TLS certificate and private key into a container as files. The application reads `/etc/tls/tls.crt` and `/etc/tls/tls.key`. Which approach is correct?

- Inject via environment variables with `secretKeyRef`
- Mount the TLS Secret as a volume at `/etc/tls`
- Store the cert and key in a ConfigMap and mount as volume

**Answer:** Mount the TLS Secret as a volume. TLS certificates and private keys are binary data stored as a `kubernetes.io/tls` Secret. Volume mounts project them as files at the specified path. Environment variables cannot hold arbitrary binary data reliably. ConfigMaps are for non-sensitive data and should not hold private keys.
:::

Secrets and ConfigMaps share the same injection patterns. The critical difference is access control: use `secretKeyRef` and Secret volumes for sensitive values, respect `readOnly: true` on mounts, and prefer volume mounts over env vars for high-sensitivity data. The next lesson covers encryption at rest, which adds real cryptographic protection to Secrets stored in etcd.
