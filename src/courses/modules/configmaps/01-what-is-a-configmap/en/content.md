---
seoTitle: 'Kubernetes ConfigMap, Separate Config from Container Image'
seoDescription: 'Learn what a ConfigMap is, why separating configuration from container images matters, and how ConfigMaps let you reuse the same image across environments.'
---

# What Is a ConfigMap

An application needs a database endpoint, a feature flag, a log level. You build the image with those values hardcoded. When the staging configuration differs from production, you build two images. When a value changes, you rebuild. The image is no longer reusable: it is environment-specific.

A ConfigMap stores configuration data outside the container image as key-value pairs. The same image can run in development, staging, and production by loading different ConfigMaps. You change the configuration without touching the image.

```bash
kubectl get configmaps -n kube-system
```

Kubernetes itself uses ConfigMaps extensively. You will see entries like `kubeadm-config`, `coredns`, and `kube-proxy`. These are the system-level configurations managed the same way you will manage your application configuration.

## The structure of a ConfigMap

@@@
graph LR
subgraph cm ["ConfigMap: app-config"]
  K1["LOG_LEVEL = info"]
  K2["DB_HOST = db.prod.svc"]
  K3["MAX_CONNECTIONS = 50"]
end
subgraph pod ["Pod"]
  ENV["Container reads\nconfiguration\nvia env vars\nor files"]
end
cm -->|"inject"| pod
@@@

A ConfigMap stores arbitrary key-value pairs. Values can be short strings like `info` or `true`, or entire multi-line files like an Nginx config or a properties file. The ConfigMap itself has no concept of what the data means: it is just a named collection of strings.

The two ways a Pod consumes a ConfigMap are:
- **Environment variables**: individual keys mapped to env vars, or all keys injected at once
- **Volume mounts**: keys mounted as files in a directory inside the container

The next two lessons cover each method in detail. This lesson focuses on understanding what ConfigMaps contain and when to use them.

## When to use a ConfigMap

ConfigMaps are for non-sensitive configuration: server addresses, timeouts, feature flags, mode switches, config file content. The key characteristic is that the data is not a secret. It will appear in plain text in etcd, in `kubectl get configmap -o yaml` output, and in Pod descriptions.

```bash
kubectl describe configmap coredns -n kube-system
```

The full CoreDNS configuration is visible in plain text. This is intentional: configuration should be auditable and inspectable. Anyone with read access to the namespace can see it.

:::warning
Never store passwords, tokens, API keys, or TLS certificates in a ConfigMap. That data belongs in a Secret. The Secrets module covers this in detail. The distinction matters because Secrets have additional access controls and can be encrypted at rest. A ConfigMap has neither of these protections.
:::

## Seeing ConfigMap data

Create a minimal ConfigMap directly from the command line to see the structure:

```bash
kubectl create configmap app-config \
  --from-literal=LOG_LEVEL=info \
  --from-literal=DB_HOST=db.default.svc.cluster.local
```

```bash
kubectl get configmap app-config -o yaml
```

The output shows the `data` section with your two key-value pairs. This is exactly what a Pod will read when it consumes this ConfigMap. The `apiVersion`, `kind`, and `metadata` fields are the same structure you have seen on every Kubernetes object.

```bash
kubectl describe configmap app-config
```

The `describe` output is easier to read for quick inspection: it lists each key and its value without the YAML framing.

:::quiz
You run `kubectl get configmap app-config -o yaml` and see the `data` section contains a key with a multi-line value. How is this possible?

**Answer:** ConfigMap values are strings and can contain any characters, including newlines. A multi-line value is simply a YAML multiline string in the data field. This is how entire config files (nginx.conf, application.properties, .env files) are stored as a single ConfigMap key. The container then receives the full file content as the value.
:::

```bash
kubectl delete configmap app-config
```

:::quiz
A developer wants to store the database password in a ConfigMap alongside the database hostname. Is this a valid use of ConfigMap?

**Answer:** No. ConfigMaps are for non-sensitive configuration only. Passwords are sensitive data and belong in a Secret. ConfigMap data is stored unencrypted in etcd and visible to anyone with read access to the namespace. Use ConfigMaps for hostnames, ports, and flags. Use Secrets for passwords, tokens, and certificates.
:::

ConfigMaps cleanly separate configuration from code. The next lesson covers the different ways to create them: from literal values on the command line, from existing files, and from full YAML manifests.
