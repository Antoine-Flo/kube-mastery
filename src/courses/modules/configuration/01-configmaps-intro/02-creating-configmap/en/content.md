# Creating a ConfigMap

There are several ways to create ConfigMaps, each suited to different workflows. Manifests are best for version-controlled, repeatable configuration. kubectl commands are convenient for quick experiments. Let's walk through each approach.

## From a YAML Manifest

The most common approach — define the ConfigMap in a YAML file alongside your other manifests:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: game-demo
data:
  player_initial_lives: "3"
  ui_properties_file_name: "user-interface.properties"
  game.properties: |
    enemy.types=aliens,monsters
    player.maximum-lives=5
```

Simple key-value pairs (`player_initial_lives: "3"`) work for individual settings. The pipe (`|`) syntax lets you embed entire files — the key `game.properties` holds the full content of a properties file.

Apply it like any other Kubernetes resource:

```bash
kubectl apply -f configmap.yaml
```

## From Literal Values

For quick experiments or CI/CD scripts:

```bash
kubectl create configmap my-config \
  --from-literal=LOG_LEVEL=info \
  --from-literal=DATABASE_HOST=postgres.default
```

Each `--from-literal` creates one key-value pair. Useful when you don't need a manifest file.

## From Files

When you have existing configuration files on disk:

```bash
# The filename becomes the key
kubectl create configmap nginx-config --from-file=nginx.conf

# Custom key name
kubectl create configmap nginx-config --from-file=my-nginx=nginx.conf

# All files in a directory
kubectl create configmap app-config --from-file=config/
```

With `--from-file`, the file name becomes the ConfigMap key, and the file content becomes the value. With a directory, each top-level file becomes a key — subdirectories are not included.

:::info
When using `--from-file` with a directory, only top-level files are included. Subdirectories and their contents are ignored. Use multiple `--from-file` flags for specific files from different locations.
:::

## Key Naming Rules

ConfigMap keys must follow these rules:
- Alphanumeric characters, hyphens (`-`), underscores (`_`), or dots (`.`)
- No overlap between `data` and `binaryData` keys

When keys are used as environment variables (via `envFrom`), they must be valid environment variable names — alphanumeric and underscore only. Keys with hyphens or dots will be silently skipped.

## Verifying Your ConfigMap

```bash
# See the full content
kubectl get configmap my-config -o yaml

# Quick overview with key list
kubectl describe configmap my-config
```

:::warning
Values with special characters (colons, quotes, newlines) can be tricky in YAML. Wrap values in quotes or use `--from-file` for complex content to avoid parsing issues.
:::

## Wrapping Up

Create ConfigMaps from YAML manifests for version-controlled configuration, `--from-literal` for quick values, or `--from-file` for existing files and directories. Use manifests for production (GitOps-friendly) and kubectl commands for experimentation. In the next lesson, you'll learn how to consume ConfigMaps in your Pods — as environment variables or mounted files.
