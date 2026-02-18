# Creating a Simple kubectl Plugin

In the previous lesson, you learned that a kubectl plugin is just an executable named `kubectl-<name>`. Now let's put that into practice and build something useful — step by step.

We'll start with the simplest possible plugin and gradually make it more practical. By the end, you'll have the pattern down and be able to create plugins for your own daily workflows.

## Starting Simple: Hello World

Every journey starts with a first step. Here's the simplest plugin you can write:

```bash
#!/bin/bash
# Save as: kubectl-hello
echo "Hello from kubectl plugin!"
echo "Current context: $(kubectl config current-context)"
echo "Current namespace: $(kubectl config view --minify -o jsonpath='{.contexts[0].context.namespace}')"
kubectl get nodes
```

Save it, then make it executable with `chmod +x` and move it into your PATH. Now run `kubectl hello` — you should see a greeting, your current context, namespace, and a list of nodes. Not groundbreaking, but it demonstrates the key idea: your plugin runs in the same context as kubectl, with access to the same cluster.

## Building Something Useful: A Pod Inspector

Let's create a more practical plugin that shows Pod details at a glance — status, restarts, node, and age — for a given namespace:

```bash
#!/bin/bash
# Save as: kubectl-podsummary
# Usage: kubectl podsummary [namespace]

NAMESPACE="${1:-default}"

echo "=== Pod Summary for namespace: $NAMESPACE ==="
echo ""

# Show Pods with extra details
kubectl get pods -n "$NAMESPACE" -o wide --sort-by='.status.startTime'

echo ""
echo "=== Resource Usage ==="
kubectl top pods -n "$NAMESPACE" 2>/dev/null || echo "(metrics-server not available)"
```

This plugin accepts an optional namespace argument. If you don't provide one, it defaults to `default`:

```bash
# Use default namespace
kubectl podsummary

# Specify a namespace
kubectl podsummary kube-system
```

:::info
Plugins receive all arguments that come after the plugin name. In `kubectl podsummary kube-system`, the plugin receives `kube-system` as `$1`. You can use standard argument parsing in any language to handle flags like `--namespace` or `--output`.
:::

## Handling Arguments and Flags

For a more robust plugin, you might want to handle flags properly. Here's a pattern that supports both positional arguments and flags:

```bash
#!/bin/bash
# Save as: kubectl-quicklogs
# Usage: kubectl quicklogs <pod-name> [-n namespace] [--previous]

POD=""
NAMESPACE="default"
PREVIOUS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --previous)
      PREVIOUS="--previous"
      shift
      ;;
    *)
      POD="$1"
      shift
      ;;
  esac
done

if [[ -z "$POD" ]]; then
  echo "Usage: kubectl quicklogs <pod-name> [-n namespace] [--previous]"
  exit 1
fi

echo "=== Logs for $POD in $NAMESPACE ==="
kubectl logs "$POD" -n "$NAMESPACE" $PREVIOUS --tail=50
```

Now you have a plugin with proper argument handling:

```bash
kubectl quicklogs my-pod
kubectl quicklogs my-pod -n production
kubectl quicklogs my-pod --previous
```

## Verification: Is Your Plugin Working?

After creating a plugin, verify it's properly installed:

```bash
# Check it's in PATH
which kubectl-podsummary

# Verify kubectl discovers it
kubectl plugin list

# Run it
kubectl podsummary
```

If `kubectl plugin list` doesn't show your plugin, double-check:
- Is the file in a directory that's in your `PATH`?
- Is the file executable? (`ls -la kubectl-podsummary` should show `x` permission)
- Does the filename start with `kubectl-`?

## Beyond Bash: When to Use Other Languages

Bash is great for quick wrappers that call `kubectl` commands. But for more complex plugins, you might want to reach for a more powerful language:

- **Python** — Use the <a target="_blank" href="https://github.com/kubernetes-client/python">kubernetes Python client</a> for structured API access
- **Go** — Use <a target="_blank" href="https://github.com/kubernetes/client-go">client-go</a> for high performance and easy distribution as a single binary

The naming convention is the same regardless of language. A Python plugin looks like:

```bash
#!/usr/bin/env python3
# Save as: kubectl-myplugin
import subprocess
result = subprocess.run(["kubectl", "get", "pods"], capture_output=True, text=True)
print(result.stdout)
```

:::warning
When calling `kubectl` from within a plugin, keep in mind that it spawns a new process each time. For plugins that make many API calls, using the Kubernetes client libraries directly is more efficient — you authenticate once and reuse the connection.
:::

---

## Hands-On Practice

### Step 1: Create a Simple Shell Plugin

```bash
echo '#!/bin/bash
echo "Hello from plugin!"
echo "Context: $(kubectl config current-context 2>/dev/null || echo unknown)"' > kubectl-hello
chmod +x kubectl-hello
```

### Step 2: Install the Plugin to PATH

```bash
mkdir -p ~/bin
mv kubectl-hello ~/bin/
export PATH="$HOME/bin:$PATH"
```

Ensure `~/bin` is in your PATH (add to `.bashrc` or `.zshrc` if needed).

### Step 3: Test the Plugin

```bash
kubectl hello
```

You should see the greeting and your current context.

### Step 4: Clean Up (Optional)

```bash
rm ~/bin/kubectl-hello
```

## Common Pitfalls

- **Missing shebang** — Always include `#!/bin/bash` or `#!/usr/bin/env python3` as the first line. Without it, the system may not know how to execute your script.
- **Assuming kubectl location** — On some systems, `kubectl` might not be in the default PATH. Using `$(which kubectl)` or relying on the user's PATH (which already works if they're running kubectl) is usually fine.
- **Printing secrets to stdout** — Be careful when your plugin handles sensitive data. Don't echo secret values without considering who might see the output.
- **No error handling** — Always check if required arguments are provided and if kubectl commands succeed. A plugin that fails silently is worse than one that fails loudly.

## Wrapping Up

Creating kubectl plugins is a straightforward way to automate your daily Kubernetes workflows. Start with simple Bash scripts, handle arguments properly, and graduate to Go or Python when you need more power. The key pattern is always the same: name it `kubectl-<name>`, make it executable, put it in PATH. In the next lesson, we'll discover Krew — the plugin manager that opens up a whole ecosystem of community-built plugins.
