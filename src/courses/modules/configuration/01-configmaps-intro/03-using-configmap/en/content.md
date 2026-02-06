# Using ConfigMaps

There are different ways to use a ConfigMap to configure a container inside a Pod.

## As Environment Variables

You can use ConfigMap data as environment variables:

```yaml
spec:
  containers:
    - name: my-container
      env:
        - name: PLAYER_LIVES
          valueFrom:
            configMapKeyRef:
              name: game-demo
              key: player_initial_lives
```

Or use `envFrom` to import all keys:

```yaml
spec:
  containers:
    - name: my-container
      envFrom:
        - configMapRef:
            name: game-demo
```

## As Volume Mounts

You can mount a ConfigMap as a volume, making each key a file:

```yaml
spec:
  containers:
    - name: my-container
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: game-demo
```

## Important Notes

- ConfigMaps consumed as environment variables are not updated automatically and require a pod restart
- ConfigMaps consumed as volumes are updated automatically (with some delay)
- The Pod and ConfigMap must be in the same namespace

:::info
Use environment variables for simple configuration values. Use volume mounts when you need to provide configuration files or when you want automatic updates without pod restarts.
:::
