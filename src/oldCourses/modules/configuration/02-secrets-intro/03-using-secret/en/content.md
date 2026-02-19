# Using Secrets in Pods

Secrets are consumed in Pods the same way as ConfigMaps — as environment variables or volume mounts. The difference is in the security precautions: values aren't displayed in `kubectl get`, volume mounts should be read-only, and you should be mindful of where Secret values end up.

## As Environment Variables

Reference individual keys with `secretKeyRef`:

```yaml
spec:
  containers:
    - name: app
      image: myapp
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
```

Or import all keys with `envFrom`:

```yaml
spec:
  containers:
    - name: app
      envFrom:
        - secretRef:
            name: db-credentials
```

The Secret values are injected as plain text into the container's environment. The key advantage of `secretKeyRef`: the values don't appear in the Pod spec — they're resolved at runtime.

## As Volume Mounts

Mount a Secret as files — each key becomes a file in the mount directory:

```yaml
spec:
  containers:
    - name: app
      volumeMounts:
        - name: secret-vol
          mountPath: /etc/secrets
          readOnly: true
  volumes:
    - name: secret-vol
      secret:
        secretName: db-credentials
```

This creates `/etc/secrets/username` and `/etc/secrets/password` with the decoded values as file contents. Some applications (like TLS-enabled servers) expect certificates as files rather than environment variables.

:::info
Always set `readOnly: true` when mounting Secrets as volumes. This prevents containers from modifying the secret files — following the principle of least privilege.
:::

## File Permissions

Some applications expect specific file permissions on secret files (like SSH keys needing `0600`):

```yaml
volumes:
  - name: ssh-key
    secret:
      secretName: ssh-credentials
      defaultMode: 0600
```

Or set permissions per item:

```yaml
volumes:
  - name: tls-vol
    secret:
      secretName: tls-secret
      items:
        - key: tls.key
          path: server.key
          mode: 0600
        - key: tls.crt
          path: server.crt
          mode: 0644
```

## Update Behavior

Same rules as ConfigMaps:

- **Environment variables** are fixed at Pod startup — changes require a restart
- **Volume mounts** are synced periodically (typically within a minute)
- **subPath mounts** are never updated — avoid them for Secrets you might rotate

## Optional Secrets

If a Secret might not exist in all environments:

```yaml
env:
  - name: OPTIONAL_KEY
    valueFrom:
      secretKeyRef:
        name: maybe-exists
        key: api-key
        optional: true
```

Without `optional: true`, the Pod won't start if the Secret is missing.

:::warning
Pods can only reference Secrets in the same namespace. Cross-namespace Secret access is not supported — this is a security feature that prevents accidental or intentional access to Secrets in other namespaces.
:::

## Security Considerations

Even though Kubernetes injects Secrets securely, be mindful of where values end up:

- **Don't log Secret values:**  Avoid `echo $DB_PASSWORD` in scripts or `env | grep` in debug output
- **Don't expose via APIs:**  Ensure your application doesn't include Secret values in error responses or health endpoints
- **Limit RBAC:**  Restrict who can `kubectl get secret` in production namespaces

---

## Hands-On Practice

### Step 1: Create a Secret

```bash
kubectl create secret generic app-secret --from-literal=api-key=mykey123
```

### Step 2: Create a Pod that mounts the Secret as a volume

Create `pod-secret.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-demo
spec:
  containers:
    - name: app
      image: busybox
      command: ["sleep", "3600"]
      volumeMounts:
        - name: secret-vol
          mountPath: /etc/secrets
          readOnly: true
  volumes:
    - name: secret-vol
      secret:
        secretName: app-secret
```

Apply it:

```bash
kubectl apply -f pod-secret.yaml
```

### Step 3: Read the mounted Secret in the Pod

```bash
kubectl exec secret-demo -- cat /etc/secrets/api-key
```

You should see `mykey123` — the Secret value is decoded and available as a file inside the container. Each Secret key becomes a file; the key name is the filename.

### Step 4: Clean up

```bash
kubectl delete pod secret-demo
kubectl delete secret app-secret
```

## Wrapping Up

Secrets are consumed as environment variables (`secretKeyRef`) or volume mounts (`secret`), following the same patterns as ConfigMaps. Always use `readOnly: true` for volume mounts, set appropriate file permissions, and be careful about where Secret values end up in logs or API responses. Next up: resource management — how to tell Kubernetes how much CPU and memory your containers need.
