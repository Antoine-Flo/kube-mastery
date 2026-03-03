# Working with Contexts

You might work with multiple Kubernetes clusters — development, staging, production. Or you might have different identities on the same cluster — admin for maintenance, read-only for monitoring. **Contexts** let you switch between these combinations with a single command.

## Why Contexts Matter

Without contexts, you'd have to manually change the server URL and credentials every time you switch clusters. With contexts, you define the combinations once and switch instantly. The active context determines **everything**: which cluster receives your commands, which identity you authenticate as, and which namespace is used by default.

:::warning
Always verify the active context before running destructive commands. Running `kubectl delete deployment nginx` in the wrong context can have serious consequences. Consider adding the current context to your shell prompt.
:::

## Setting a Default Namespace

Tired of typing `-n team-a` on every command? Set a default namespace on your context:

```bash
kubectl config set-context --current --namespace=team-a
```

Now `kubectl get pods` automatically targets the `team-a` namespace. You can still use `-n other-namespace` to override when needed.

## Creating Contexts

Create a new context that links a cluster, user, and namespace:

```bash
kubectl config set-context prod-admin \
  --cluster=production \
  --user=admin \
  --namespace=default
```

The cluster and user must already exist in your kubeconfig. The context is just a named reference that combines them.

## Managing Contexts

```bash
# Rename a context
kubectl config rename-context old-name new-name

# Delete a context (doesn't delete the cluster or user entries)
kubectl config delete-context unused-context

# View just the current context's config
kubectl config view --minify
```

The `--minify` flag is useful for debugging — it shows only the config relevant to your active context.

## Tools for Context Management

For frequent context switching, several tools make life easier:

- **kubectx:** Fast context switching: `kubectx production` instead of the full `kubectl config use-context production`
- **kubens:** Fast namespace switching: `kubens team-a` instead of `kubectl config set-context --current --namespace=team-a`
- **Shell prompt integration:** Show the current context and namespace in your terminal prompt, so you always know where you are

:::info
When `KUBECONFIG` points to multiple files, context names can collide. If two files define a context named `default`, the first file wins. Use unique, descriptive context names like `prod-admin`, `staging-readonly`, `dev-team-a`.
:::

## A Safety Workflow

Before any important operation:

```bash
# 1. Verify where you are
kubectl config current-context

# 2. Verify what you see
kubectl get nodes

# 3. Only then proceed
kubectl apply -f production-deploy.yaml
```

This three-step check takes seconds and prevents costly mistakes.

---

## Hands-On Practice

### Step 1: List all contexts

```bash
kubectl config get-contexts
```

You'll see each context with its cluster, user, and namespace. The current context is marked with `*`.

### Step 2: Show the current context

```bash
kubectl config current-context
```

This confirms which context is active. All kubectl commands use this context's cluster and credentials.

### Step 3: Switch context (if you have multiple)

```bash
kubectl config use-context <context-name>
```

Replace `<context-name>` with a context from Step 1. If you only have one cluster, this step is optional — but it's essential when managing dev, staging, and production from the same terminal.

## Wrapping Up

Contexts combine a cluster, user, and optional namespace into a named configuration. Use `kubectl config use-context` to switch, `set-context --current --namespace` to set a default namespace, and always verify before destructive operations. In the next lesson, we'll explore the authentication methods that the "user" part of a context can use — certificates, tokens, and exec-based auth.
