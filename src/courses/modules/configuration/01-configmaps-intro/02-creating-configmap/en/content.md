# Creating a ConfigMap

You can create a ConfigMap from literal values, files, or directories.

## ConfigMap from Literal Values

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: game-demo
data:
  player_initial_lives: '3'
  ui_properties_file_name: 'user-interface.properties'
  game.properties: |
    enemy.types=aliens,monsters
    player.maximum-lives=5
```

## Creating with kubectl

**From literal values:**

```bash
kubectl create configmap my-config --from-literal=key1=value1 --from-literal=key2=value2
```

**From a file:**

```bash
kubectl create configmap my-config --from-file=path/to/file
```

**From a directory:**

```bash
kubectl create configmap my-config --from-file=path/to/dir
```

## ConfigMap Keys

Each key under the `data` or `binaryData` field must consist of alphanumeric characters, `-`, `_`, or `.`. Keys stored in `data` must not overlap with keys in `binaryData`.
