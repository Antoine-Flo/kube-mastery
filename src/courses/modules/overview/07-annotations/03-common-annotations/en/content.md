# Common Annotations

Now that you know how to add and manage annotations, let's look at how they're used in practice. The Kubernetes ecosystem has developed conventions for common annotation patterns — knowing them will help you organize your resources effectively and work smoothly with popular tools.

## Ownership and Contact Information

One of the most valuable uses of annotations is tracking who owns a resource and how to reach them. When something breaks at 2 AM, these annotations tell the on-call engineer who to contact:

```yaml
metadata:
  annotations:
    owner.team: "platform"
    contact.email: "platform-team@example.com"
    contact.slack: "#platform-ops"
    docs.runbook: "https://wiki.example.com/nginx-runbook"
```

This is especially valuable in multi-team clusters where dozens of applications share the same infrastructure.

## Build and Release Metadata

Annotations are perfect for recording deployment context — when something was deployed, from which commit, by which pipeline:

```yaml
metadata:
  annotations:
    deploy.timestamp: "2026-02-16T10:30:00Z"
    deploy.git-commit: "a1b2c3d"
    deploy.pipeline-url: "https://ci.example.com/pipelines/12345"
    deploy.version: "v2.4.1"
```

When debugging a production issue, these annotations let you quickly answer "What version is running?" and "When was it deployed?" without digging through CI/CD logs.

## Tool-Specific Annotations

Many Kubernetes tools use annotations to configure behavior. Here are some you'll encounter frequently:

**Ingress controllers** use annotations to configure routing, TLS, and rewriting:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
```

**Prometheus** uses annotations to discover scrape targets:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
```

:::info
Tool-specific annotations are documented by each tool. Always check the official documentation for the exact key names and expected formats — they can change between versions.
:::

## Kubernetes Standard Annotations

Kubernetes itself defines a few standard annotations under the `kubernetes.io/` prefix:

```yaml
metadata:
  annotations:
    kubernetes.io/change-cause: "Updated nginx to 1.25"
```

The `change-cause` annotation is particularly useful — it's displayed by `kubectl rollout history` to show why each revision was made. When you deploy with `--record` (deprecated) or manually set this annotation, your deployment history becomes self-documenting.

## Best Practices for Custom Annotations

When creating your own annotation conventions:

- **Use a domain prefix** — `mycompany.com/owner` instead of just `owner`. This prevents clashes with other tools and makes it clear which annotations are yours.
- **Be consistent** — Decide on a convention and stick to it across all resources and teams.
- **Keep values reasonable** — While annotations can hold large values, etcd stores everything. Use ConfigMaps for large configuration data.
- **Document your conventions** — Maintain a reference of which annotations your team uses and what they mean.

You can apply these conventions with `kubectl annotate`, passing multiple key-value pairs in a single command — for example, setting `mycompany.com/owner` and `mycompany.com/cost-center` on a Deployment.

:::warning
Reserved prefixes `kubernetes.io/` and `k8s.io/` should only be used for annotations documented by Kubernetes or official tools. Using them for custom data risks conflicts with future Kubernetes features.
:::

---

## Hands-On Practice (Optional)

This is a reference lesson — the step below is optional. If you have a Deployment named `nginx`:

### Step 1: Add and View Organizational Annotations

```bash
kubectl annotate deployment nginx mycompany.com/owner="platform-team" mycompany.com/cost-center="engineering"
kubectl get deployment nginx -o jsonpath='{.metadata.annotations}'
```

Using a domain prefix for custom annotations avoids clashes with Kubernetes and third-party tools.

## Wrapping Up

Annotations are the standard way to attach operational metadata to Kubernetes resources — ownership, build info, documentation links, and tool configuration. Use domain prefixes for custom annotations, respect reserved prefixes, and keep your conventions consistent across the team. Well-annotated resources make your cluster easier to understand, debug, and operate — especially when you're not the person who deployed them.
