---
seoTitle: 'Immutable ConfigMap Kubernetes, Performance and Safety'
seoDescription: 'Learn how to mark a Kubernetes ConfigMap as immutable, why it improves cluster performance at scale, and what constraints apply when you use it.'
---

# Immutable ConfigMaps

In a large cluster, the kubelet on every node watches every ConfigMap that any of its Pods reference. With thousands of Pods and hundreds of ConfigMaps, this generates a constant stream of watch events to the API server, even for ConfigMaps that never change. An immutable ConfigMap tells the API server: this data will never change. The kubelet stops watching it. The load drops.

Beyond performance, immutability is a safety property. A ConfigMap that cannot be edited cannot be accidentally misconfigured after deployment. It forces the discipline of creating a new ConfigMap for each configuration change.

## Marking a ConfigMap as immutable

Add `immutable: true` to the ConfigMap spec:

```bash
nano stable-config.yaml
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: stable-config
immutable: true
data:
  APP_VERSION: '2.4.1'
  FEATURE_FLAGS: 'payments,search'
  TIMEOUT_SECONDS: '30'
```

```bash
kubectl apply -f stable-config.yaml
```

The ConfigMap is created as immutable. Confirm:

```bash
kubectl get configmap stable-config -o yaml
```

The `immutable: true` field appears in the spec.

## What immutability prevents

Try to edit the ConfigMap:

```bash
kubectl edit configmap stable-config
```

Change any value and try to save. The API server rejects the change with:

```
configmaps "stable-config" is forbidden: field is immutable
```

You cannot change the `data` field or set `immutable: false` once immutability is set. The only way to update the configuration is to create a new ConfigMap with a new name (or a new version suffix) and update the Pod spec to reference it.

:::warning
Immutability is permanent. Once you set `immutable: true`, you cannot unset it. The only way to modify the data is to delete the ConfigMap and create a new one. This means any Pods referencing the old ConfigMap must be updated to reference the new name. Plan your naming convention before marking a ConfigMap immutable: using versioned names like `app-config-v3` makes rotation natural.
:::

:::quiz
You have an immutable ConfigMap named `app-config-v1`. You need to update one value. What is the correct process?

**Answer:** Create a new ConfigMap with a new name (e.g., `app-config-v2`) with the updated value. Update all Pods or Deployment manifests that reference `app-config-v1` to reference `app-config-v2`. Apply the changes. Once no Pods reference the old ConfigMap, delete `app-config-v1`. You cannot modify the data of an immutable ConfigMap.
:::

## When to use immutable ConfigMaps

The performance benefit is most relevant at scale, but the safety benefit applies even in small clusters. Good candidates for immutability:

- ConfigMaps holding a released application version's config
- Environment-specific config that is promoted through stages and should not change once deployed
- Shared config referenced by many Deployments that should have a known-stable state

ConfigMaps that change frequently (feature flags in active development, dynamic tuning parameters) are not good candidates. The overhead of creating new versions and updating references outweighs the benefit.

```bash
kubectl delete configmap stable-config
```

:::quiz
A cluster has 500 nodes and 200 ConfigMaps. 180 of them have not changed in months. You mark those 180 as immutable. What changes in cluster behavior?

**Answer:** The kubelet on each node stops watching those 180 ConfigMaps. Instead of sending watch event updates for each of those ConfigMaps to 500 nodes regularly, the API server simply stops serving watch streams for them. This reduces both API server load and network traffic. The remaining 20 mutable ConfigMaps continue to be watched normally.
:::

Immutable ConfigMaps are a small change with a clear safety and performance upside. Use them for stable configuration that has reached a known-good state. The next module covers Secrets, which follow the same injection patterns as ConfigMaps but add protection for sensitive data.
