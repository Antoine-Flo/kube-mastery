# Working with Namespaces

## From Concept to Daily Workflow

In the previous lesson, you learned what namespaces are and why they matter. Now let's focus on the practical side: how to navigate between namespaces, set a default so you do not have to type `-n` on every command, create namespaces from manifests, and safely delete them when you are done.

Think of switching namespaces like changing floors in an office building. Most of the time you work on one floor, so you want the elevator to default to that floor instead of making you press the button every trip.

## Targeting a Specific Namespace

Every `kubectl` command for namespaced resources accepts the `-n` (or `--namespace`) flag. For example, `kubectl get pods -n dev` lists Pods in the `dev` namespace, `kubectl get services -n staging` shows Services in `staging`, and `kubectl describe deployment nginx -n prod` describes a specific Deployment in `prod`.

To see resources across _all_ namespaces at once, use `-A` (or `--all-namespaces`):

```bash
kubectl get pods -A
kubectl get deployments -A
```

This is useful when you are looking for something but are not sure which namespace it lives in.

## Setting a Default Namespace

If you spend most of your time in one namespace, you can set it as the default for your current context with `kubectl config set-context --current --namespace=<name>`. After that, every command runs against that namespace unless you override with `-n`, so `kubectl get pods` shows Pods in your chosen namespace instead of `default`. You can verify your current settings:

```bash
kubectl config view --minify | grep namespace
```

:::info
Setting a default namespace saves time and reduces mistakes. If you frequently switch between namespaces, consider tools like `kubens` (part of the <a target="_blank" href="https://github.com/ahmetb/kubectx">kubectx project</a>) that make switching even faster.
:::

## Creating Namespaces from Manifests

While `kubectl create namespace` is great for quick tasks, you can also define namespaces in YAML — which fits naturally into a declarative workflow:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    env: staging
```

Apply it:

```bash
kubectl apply -f namespace.yaml
```

Labels on namespaces are useful for applying policies or quotas to groups of namespaces. For example, you could apply a network policy to all namespaces labeled `env: staging`.

## Deleting a Namespace

When a namespace is no longer needed, you can delete it with `kubectl delete namespace <name>`. This removes the namespace **and everything inside it:** all Pods, Services, Deployments, ConfigMaps, and other namespaced resources. It is a cascade operation, and it can take time if there are many resources or if finalizers need to be processed.

```mermaid
flowchart LR
    D["kubectl delete namespace dev"] --> API["API Server"]
    API --> C1["Delete Pods"]
    API --> C2["Delete Services"]
    API --> C3["Delete Deployments"]
    API --> C4["Delete ConfigMaps"]
    API --> C5["...all namespaced resources"]
```

:::warning
Deleting a namespace is irreversible and removes all namespaced resources inside it. Always double-check the target before running the command. Never delete `kube-system` — it will break your cluster.
:::

## Handling Common Issues

- **"Resource not found":** The most common cause is looking in the wrong namespace. Add `-n <namespace>` or use `-A` to search everywhere.
- **Namespace stuck in "Terminating":** This usually means a finalizer is blocking deletion. Inspect the namespace with `kubectl get namespace dev -o yaml` and look for stuck finalizers.
- **Accidentally working in the wrong namespace:** Always verify your current context with `kubectl config view --minify` before running destructive commands.

---

## Hands-On Practice

### Step 1: Create a new namespace

```bash
kubectl create namespace staging
```

### Step 2: Deploy a Pod into it

```bash
kubectl run nginx --image=nginx -n staging
```

### Step 3: Verify the Pod is in the correct namespace

```bash
kubectl get pods -n staging
```

### Step 4: Set the namespace as your default context

```bash
kubectl config set-context --current --namespace=staging
```

Now `kubectl get pods` without `-n` shows Pods in `staging`.

### Step 5: Switch back to default

```bash
kubectl config set-context --current --namespace=default
```

### Step 6: Clean up

```bash
kubectl delete namespace staging
```

## Wrapping Up

Namespaces become second nature once you build a few habits: use `-n` to target specific namespaces, set a default for your most-used one, and use `-A` when you need a cluster-wide view. Deleting a namespace is a powerful cleanup tool, but it deserves caution since everything inside is removed. With these commands in your toolkit, you can navigate and manage multi-namespace clusters confidently. Next, you will learn about labels — the tagging system that lets you organize and select resources within and across namespaces.
