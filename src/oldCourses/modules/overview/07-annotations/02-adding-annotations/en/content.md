# Adding Annotations

Adding annotations works almost identically to adding labels — in manifests or with `kubectl`. The main difference? Since annotations aren't used for selection, you have more freedom with what you store. Let's walk through the practical workflows.

## Annotations in Manifests

The recommended approach is to include annotations in your YAML manifests, right alongside labels:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  annotations:
    description: "Web server for the frontend team"
    docs.url: "https://wiki.example.com/nginx-runbook"
    deploy.timestamp: "2026-02-16T10:30:00Z"
spec:
  containers:
    - name: nginx
      image: nginx
```

When you `kubectl apply` this manifest, the Pod is created with all three annotations. They're stored in the object's metadata, just like labels.

## Adding Annotations to Existing Resources

Use `kubectl annotate` to add annotations to resources that already exist. You can add multiple annotations at once by listing them one after another.

## Updating and Removing

Just like labels, kubectl refuses to overwrite an existing annotation without explicit permission. Use `--overwrite` to change a value. The trailing hyphen (`key-`) removes an annotation — the same convention as for labels.

:::info
To remove an annotation, append a hyphen to the key: `kubectl annotate pod <name> description-`. This convention is the same as for labels — consistent across all metadata operations in kubectl.
:::

## A Word of Caution

Annotations used by tools and controllers carry real meaning. For example, if an Ingress controller reads `nginx.ingress.kubernetes.io/rewrite-target` to configure URL rewriting, changing that annotation changes the Ingress behavior. Similarly, some operators store state in annotations.

Before modifying annotations on a resource, consider:
- Is any tool reading this annotation?
- Will changing it affect behavior?
- Is the annotation documented somewhere?

:::warning
Some annotations are used by controllers and tools to configure behavior. Overwriting them can change how your application is exposed, monitored, or managed. When in doubt, check the tool's documentation before modifying.
:::

---

## Hands-On Practice

You need a Pod. Run `kubectl run web-app --image=nginx` or use an existing one.

### Step 1: Add Annotations

```bash
kubectl annotate pod web-app description="Production web server"
kubectl annotate pod web-app owner="frontend-team" docs="https://wiki.example.com/nginx"
```

### Step 2: Verify

```bash
kubectl get pod web-app -o jsonpath='{.metadata.annotations}'
```

Or use `kubectl describe pod web-app` and check the Annotations section under Metadata.

### Step 3: Update and Remove

```bash
kubectl annotate pod web-app description="Updated web server" --overwrite
kubectl annotate pod web-app description-
```

The first command updates the value. The second removes the `description` annotation (trailing hyphen).

## Wrapping Up

Adding annotations follows the same patterns as labels: define them in manifests, use `kubectl annotate` for existing resources, `--overwrite` to change values, and `key-` to remove them. Since annotations aren't used for selection, they're lower-risk to modify — but be mindful of annotations that tools and controllers depend on. In the next lesson, we'll look at common annotation patterns used across the Kubernetes ecosystem.
