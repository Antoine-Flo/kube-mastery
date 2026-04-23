---
seoTitle: 'Kubernetes Secrets Security Best Practices, RBAC, Audit Logs'
seoDescription: 'Learn Kubernetes Secrets security best practices: RBAC restriction, avoiding env var leaks, audit logging, avoiding Secret data in manifests committed to git.'
---

# Secrets Security Best Practices

Knowing how Secrets work is not enough. The most common vulnerabilities are not technical misunderstandings: they are workflow mistakes that expose Secret values despite correct configuration. This lesson covers the practical habits that prevent those mistakes.

## Restrict access with RBAC

The first line of defense is RBAC. By default, a namespace-scoped ServiceAccount or user with `get` or `list` access to Secrets can read any Secret in the namespace. Scope the access down.

Check which roles have Secret access in the default namespace:

```bash
kubectl get rolebindings -n default -o yaml
```

Look for any binding that grants `secrets` resources with `get`, `list`, or `watch` verbs. Each such binding is a potential exposure surface.

The principle of least privilege applied to Secrets means:
- Applications that do not need to read Secrets should not have `get` access to them
- Even among applications that do read Secrets, scope access to specific Secret names using `resourceNames`

```yaml
rules:
  - apiGroups: ['']
    resources: ['secrets']
    resourceNames: ['db-credentials']
    verbs: ['get']
```

This rule allows reading only the `db-credentials` Secret, not any other Secret in the namespace.

:::quiz
A developer role has `get` and `list` on all Secrets in the production namespace. What is the security problem?

**Answer:** `list` on Secrets allows the developer to enumerate all Secret names and values in the namespace. Any Secret created in that namespace (database passwords, API keys, TLS private keys) is readable by this role. The RBAC restriction should be scoped to specific Secret names with `resourceNames` and should grant `get` but not `list` for most use cases.
:::

## Never commit Secret values to version control

The most common real-world Secret leak is a Secret manifest committed to a git repository:

```yaml
# DO NOT DO THIS
apiVersion: v1
kind: Secret
metadata:
  name: db-creds
data:
  password: cGFzc3dvcmQxMjM=  # base64 of "password123"
```

Base64 is not encryption. Anyone who clones the repository can decode this in seconds. Even private repositories can be exposed through leaks, misconfigured access controls, or third-party integrations.

Safe patterns for Secret management in version control:
- Commit Secret manifests without the `data` field, populate values at deploy time from a vault or CI/CD secrets store
- Use tools like Sealed Secrets (encrypts the Secret data itself) or External Secrets Operator (fetches from an external vault at deploy time)
- Use environment-specific values injected by the deployment pipeline, never stored in the repo

:::warning
If a Secret value is ever committed to a git repository, consider it compromised regardless of whether the commit was later reverted. Git history preserves all commits. Rotate the credential immediately and audit who had access to the repository.
:::

## Prefer volume mounts over environment variables

Covered briefly in the previous lesson, but worth restating as a practice: mount Secrets as files rather than injecting them as environment variables when possible.

Environment variable risks:
- Process inspection tools (`/proc/<pid>/environ`) expose all env vars to other processes with sufficient permission
- Application crash dumps often include environment variable contents
- Logging frameworks may accidentally capture env var values

Volume mount advantages:
- Files can have restricted permissions (`0400`) limiting who inside the container can read them
- Applications read the file explicitly at the moment they need the value
- File-based Secrets update automatically when the Secret changes (same live-reload behavior as ConfigMaps)

## Enable audit logging for Secret access

Audit logs record every API server request, including reads of Secrets. With audit logging enabled, you can detect unexpected Secret access and investigate potential leaks.

```bash
kubectl get pods -n kube-system | grep audit
```

Audit configuration is covered in the observability module. For the purposes of Secrets, the key audit events to watch for are:
- `get` and `list` on Secret resources by unexpected principals
- `create` and `update` on Secrets from outside normal deployment pipelines

:::quiz
An application uses `envFrom.secretRef` to load all keys from a Secret. A new key is added to the Secret for a different application. Does the original application see the new key?

**Answer:** Yes, unless the Pod is restarted after the Secret update. `envFrom` injects all keys at startup. If the Secret gains a new key after the Pod starts, the old Pod does not see it. But when the Pod is next restarted, it will load all current keys including the new one. This is another reason to use `env.valueFrom.secretKeyRef` for specific keys rather than `envFrom` for all: you control exactly what each Pod receives and avoid accidental injection of unrelated values.
:::

The security posture for Secrets rests on four habits: restrict RBAC to specific Secrets and specific verbs, never commit values to version control, prefer volume mounts for sensitive data, and audit access regularly. The next module covers resource management, which ensures Pods consume predictable amounts of CPU and memory.
