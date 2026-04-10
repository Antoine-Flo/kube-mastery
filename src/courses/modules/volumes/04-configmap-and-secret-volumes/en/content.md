---
seoTitle: 'Kubernetes ConfigMap and Secret Volumes, Files, Reload'
seoDescription: 'Learn how to mount ConfigMaps and Secrets as files in Kubernetes Pods, use selective key mapping, and enable live configuration reload without Pod restarts.'
---

# ConfigMap and Secret Volumes

Your application reads its configuration from `/etc/app/config.yaml` at startup. You want to change the log level without rebuilding the Docker image. Passing the value as an environment variable will not work because the app reads a file, not env vars, and the codebase is not yours to modify. What you need is a way to inject a file into the container that Kubernetes manages for you.

Mounting a ConfigMap as a volume solves this exactly.

## How ConfigMap volumes work

When you mount a ConfigMap as a volume, Kubernetes takes every key in the ConfigMap and creates a file for it in the mounted directory. The key becomes the filename and the value becomes the file content. The container sees real files at the mount path; it does not need to know anything about Kubernetes.

@@@
graph LR
    CM[ConfigMap\nkey: config.yaml\nvalue: debug: true]
    subgraph Pod
        V[(volume mount\n/etc/app)]
        C[container\nreads /etc/app/config.yaml]
    end
    CM -- projected as files --> V
    V --> C
@@@

Think of it like a shared network folder that Kubernetes populates from a dictionary. Every entry in the dictionary becomes a file on the folder. Your application just reads a file like it always has.

## Step 1: create the ConfigMap

Create a ConfigMap with a key named `config.yaml`:

```bash
kubectl create configmap app-config --from-literal=config.yaml="log_level: debug"
```

Confirm it was created:

```bash
kubectl describe configmap app-config
```

You will see the key `config.yaml` with its value in the `Data` section.

:::quiz
You run `kubectl create configmap app-config --from-literal=config.yaml="log_level: debug"`. How many files will appear in the container's mount directory?

- Zero. ConfigMap values are only available as environment variables.
- One file named `config.yaml` containing `log_level: debug`.
- One file named `app-config` containing all key-value pairs.

**Answer:** One file named `config.yaml`. Each key in the ConfigMap becomes its own file. The ConfigMap name (`app-config`) does not become a filename.
:::

## Step 2: mount it in a Pod

Now declare the volume referencing the ConfigMap and mount it into the container:

`nano config-pod.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: config-reader
spec:
  volumes:
    - name: app-config-volume
      configMap:
        name: app-config
  containers:
    - name: app
      image: nginx:1.28
      volumeMounts:
        - name: app-config-volume
          mountPath: /etc/app
```

```
kubectl apply -f config-pod.yaml
```

```
kubectl describe pod config-reader
```

In the `Volumes:` section you will see `app-config-volume` with type `ConfigMap` and the source ConfigMap name. The `Mounts:` line confirms `/etc/app`.

## Selective key mounting with items

If your ConfigMap has multiple keys but you only want one of them in the container, or you want to rename the file, use the `items` field:

```yaml
# illustrative only
spec:
  volumes:
    - name: app-config-volume
      configMap:
        name: app-config
        items:
          - key: config.yaml
            path: application.yaml
```

This mounts only the `config.yaml` key, but the file inside the container is named `application.yaml`. The container sees `/etc/app/application.yaml`, not `config.yaml`.

Why would you rename it? Because the application might expect a specific filename that does not match the key name you chose in the ConfigMap. The `items` field lets you bridge that gap without changing the ConfigMap structure.

:::quiz
Your ConfigMap has three keys: `config.yaml`, `feature-flags.json`, and `limits.conf`. You mount the ConfigMap without an `items` field. How many files appear in the container's mount directory?

- One. Kubernetes only mounts the first key.
- Three. One file per key.
- Zero. You must use `items` to specify which keys to mount.

**Answer:** Three. Without `items`, every key in the ConfigMap is projected as a file. Use `items` when you need to mount a subset or rename files.
:::

## Mounting Secrets as volumes

The pattern for Secrets is identical to ConfigMaps. The difference is that Secret values are base64-encoded in the API, but Kubernetes automatically decodes them when projecting the files. The container reads plain text, not base64.

```yaml
# illustrative only
spec:
  volumes:
    - name: db-credentials
      secret:
        secretName: my-db-secret
  containers:
    - name: app
      volumeMounts:
        - name: db-credentials
          mountPath: /etc/secrets
```

Each key in the Secret becomes a file under `/etc/secrets`. If your Secret has a key `password`, the container can read it at `/etc/secrets/password` as plain text.

:::warning
Secrets mounted as volumes are plain text files inside the container. Any process running in the container can read them. An attacker with `kubectl exec` access to the Pod, or with a shell inside the container, can read your secrets directly. Mounting a Secret as a volume does not add encryption at the container level. Protect access to the Pod and limit who can exec into it.
:::

## Live reload: the key advantage over environment variables

When you update a ConfigMap and re-apply it, Kubernetes automatically updates the files mounted from that ConfigMap in running Pods. The update propagates in a few seconds without any Pod restart. Applications that watch their configuration files for changes (many web servers and agents do this) will pick up the new configuration automatically.

This is the main reason to prefer ConfigMap volumes over environment variables for configuration. Environment variables from ConfigMaps are read once at Pod startup and do not change while the Pod is running. A configuration change requires a Pod restart to take effect.

:::info
The live reload applies to volumes only. If you inject ConfigMap data as environment variables using `envFrom` or `env[].valueFrom.configMapKeyRef`, those values are baked in at Pod start and do not update dynamically. For configuration that changes frequently, volumes are the right choice.
:::

:::quiz
You update a ConfigMap that is mounted as a volume in a running Pod. You do NOT restart the Pod. What happens to the files inside the container?

- Nothing changes. ConfigMap updates only apply to new Pods.
- The files are updated automatically within a few seconds.
- The container crashes and restarts to reload the configuration.

**Answer:** The files are updated automatically. Kubernetes propagates ConfigMap changes to mounted volumes without restarting the Pod. The container process needs to detect the file change itself to act on the new configuration.
:::

ConfigMap and Secret volumes let you externalize configuration as files that your application reads naturally. The two-step pattern (declare the volume, mount it in the container) keeps the ConfigMap separate from the Pod, so you can update configuration independently of the workload definition.
