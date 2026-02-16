# What Are Annotations?

You've learned that labels are for identifying and selecting objects. But what about metadata that doesn't fit the label model — documentation links, build info, tool configuration, ownership details? That's where **annotations** come in.

## Annotations vs Labels

The distinction is simple:

- **Labels** are for **selection** — Services, controllers, and selectors use them to find and group objects
- **Annotations** are for **information** — they store metadata that humans and tools need, but that Kubernetes doesn't use for filtering

Think of it like a library book. The call number (label) tells you where the book belongs on the shelf — it's indexed and searchable. The notes inside the front cover (annotations) might say who donated it, when it was added to the collection, or a URL for supplementary material. Useful information, but not used for shelving.

```yaml
metadata:
  labels:
    app: nginx        # Used by selectors
    env: production   # Used by selectors
  annotations:
    description: "Production web server for the frontend team"
    contact: "frontend-team@example.com"
    docs: "https://wiki.example.com/nginx-setup"
```

## What Annotations Are Used For

Annotations are incredibly versatile. Here are common real-world uses:

- **Ownership and contact info** — `owner: platform-team`, `contact: ops@example.com`
- **Documentation links** — URLs to runbooks, wikis, or architecture diagrams
- **Build and release metadata** — Git commit hashes, CI pipeline URLs, deployment timestamps
- **Tool configuration** — Ingress controllers, monitoring systems, and GitOps tools often read annotations to configure behavior

For example, an Ingress controller might read:

```yaml
annotations:
  nginx.ingress.kubernetes.io/rewrite-target: /
  nginx.ingress.kubernetes.io/ssl-redirect: "true"
```

:::info
Annotations can store much larger values than labels — up to 256KB per key in most implementations. This makes them suitable for structured data like JSON configuration, though for very large config, a ConfigMap is usually better.
:::

## Annotation Keys and Conventions

Annotation keys follow similar rules to labels, but with more freedom in values. For key naming:

- Reserved prefixes (`kubernetes.io/`, `k8s.io/`) are for Kubernetes and official tools
- Use your own domain as a prefix for custom annotations: `mycompany.com/owner`, `mycompany.com/cost-center`
- Third-party tools document which annotations they expect — always check their docs

## Viewing Annotations

```bash
# Full object details including annotations
kubectl describe pod nginx-pod

# Extract annotations specifically
kubectl get pod nginx-pod -o jsonpath='{.metadata.annotations}'
```

Annotations appear under the **Metadata** section in `describe` output.

:::warning
Labels are for selection; annotations are for metadata. Don't put data that selectors need into annotations — it won't work. And don't use labels for large descriptive text — that's what annotations are for.
:::

## Wrapping Up

Annotations complement labels by storing non-identifying metadata — documentation, tool config, build info, and ownership details. They're read by humans, automation, and third-party tools, but never by Kubernetes selectors. In the next lesson, you'll learn how to add, update, and remove annotations on your resources.
