---
seoTitle: 'kubectl Switching Contexts, use-context, set-context Namespace, Multi-Cluster'
seoDescription: 'Learn how to switch between Kubernetes contexts with kubectl config use-context, set a default namespace, and run commands against a non-active context.'
---

# Switching Contexts

You work with three clusters: a dev cluster where you experiment freely, a staging cluster that mirrors production, and a production cluster you treat with care. Each one has its own context entry in your kubeconfig. Switching between them is a one-command operation, and you never touch the cluster itself to do it.

Start by seeing all available contexts in the simulator:

```bash
kubectl config get-contexts
```

The output is a table. The column headers are `CURRENT`, `NAME`, `CLUSTER`, `AUTHINFO`, and `NAMESPACE`. The row with an asterisk in the `CURRENT` column is the active context. Every `kubectl` command you run right now goes to the cluster that context points to.

@@@
graph LR
  CF["kubeconfig\ncurrent-context: kind-dev"]
  C1["context: kind-dev\n-> cluster-dev\n-> user-dev"]
  C2["context: kind-staging\n-> cluster-staging\n-> user-staging"]
  C3["context: kind-prod\n-> cluster-prod\n-> user-prod"]
  KC["kubectl get pods"]
  CF -->|"active"| C1
  CF -.->|"inactive"| C2
  CF -.->|"inactive"| C3
  C1 --> KC
@@@

## Switching the active context

To make a different context active, use `use-context`:

```bash
kubectl config use-context kind-dev
```

Output:

```
Switched to context "kind-dev".
```

From this point forward, every `kubectl` command goes to the cluster that `kind-dev` points to. The change is written immediately to the `current-context` field in `~/.kube/config`. Run `kubectl config get-contexts` again and you will see the asterisk has moved.

:::quiz
After running `kubectl config use-context kind-staging`, where do you see confirmation that the switch worked?

**Try it:** `kubectl config get-contexts`

**Answer:** The asterisk moves to the `kind-staging` row. The `CURRENT` column marks the active context. You can also run `kubectl config current-context` which prints just the active context name on a single line.
:::

## What happens when you switch to a context that does not exist

Try switching to a context that is not in the kubeconfig:

```bash
kubectl config use-context does-not-exist
```

Output:

```
error: no context exists with the name: "does-not-exist"
```

:::warning
`use-context` will not create a missing context. It fails immediately if the name does not match any entry in the `contexts` list. If you see this error, run `kubectl config get-contexts` to list the valid context names and pick the correct one.
:::

## Setting the default namespace for the current context

A context can have a default namespace. When it does, every `kubectl` command that omits `-n` queries that namespace. This is not about restricting what you can see. It is about convenience: if you spend most of your time in the `payments` namespace, you set it as the default and stop typing `-n payments` on every command.

```bash
kubectl config set-context --current --namespace=staging
```

Output:

```
Context "kind-dev" modified.
```

Now run any command without a namespace flag and it will target `staging`. Verify by running:

```bash
kubectl config get-contexts
```

The `NAMESPACE` column for the current context now shows `staging`.

Why does this matter for the CKA exam? Because many exam tasks start with "work in namespace X." Setting the default namespace at the start of each task means fewer flags to type and fewer namespace mistakes.

:::quiz
You set `--namespace=staging` on the current context, then run `kubectl get pods`. Which namespace does kubectl query?

- The `default` namespace, because `-n` was not specified
- The `staging` namespace, because the context default overrides the built-in default
- All namespaces, because no filter was applied

**Answer:** The `staging` namespace. The context's default namespace replaces the built-in `default`. The `-n` flag always wins if you provide it, but without it, kubectl uses the context's namespace setting.
:::

## Running a single command against a different context

Sometimes you want to check something in another cluster without switching your active context. Every `kubectl` command accepts a `--context` flag:

```bash
kubectl config get-contexts
```

Then run a read command targeting a specific context directly:

```bash
kubectl config view --context=kind-staging
```

The `--context` flag takes effect only for that single command. Your active context does not change. This is the correct pattern when you need to do a quick lookup in a non-active cluster without disrupting your current workflow.

@@@
graph TB
  U["You"]
  AC["Active context: kind-dev"]
  SC["--context=kind-staging\n(single command only)"]
  U -->|"normal commands"| AC
  U -->|"one-off lookup"| SC
  AC -->|"writes current-context"| CF["~/.kube/config"]
  SC -.->|"no file write"| CF
@@@

:::quiz
How do you run a single kubectl command against a non-active context without switching the active context?

**Answer:** Use the `--context=<name>` flag on the command. For example: `kubectl get pods --context=kind-prod`. The flag applies only to that invocation. The `current-context` field in kubeconfig is not modified.
:::

Context switching is the most frequent kubeconfig operation in multi-cluster work. You now know how to list contexts, switch between them, set a default namespace, and run one-off commands against non-active contexts. The next lesson goes deeper: building a kubeconfig from scratch when a cluster admin hands you raw certificate files.
