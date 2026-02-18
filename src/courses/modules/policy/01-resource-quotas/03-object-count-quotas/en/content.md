# Object Count Quotas

So far, we've looked at quotas for compute resources — CPU, memory. But ResourceQuotas can also limit the **number of objects** in a namespace: how many ConfigMaps, Secrets, PVCs, Services, Deployments, and other resources can exist.

This is about keeping things tidy and preventing namespace bloat — especially in multi-tenant clusters where unchecked object creation can strain etcd and make management painful.

## Why Object Counts Matter

Every Kubernetes object is stored in etcd, the cluster's key-value store. While individual objects are small, hundreds of abandoned ConfigMaps, forgotten Secrets, or orphaned PVCs add up. They consume etcd space, slow API responses, and create operational noise.

Object count quotas put a ceiling on how many of each resource type a namespace can hold. Think of it as a storage unit rental: you can keep things there, but there's a limit on how full the unit can get.

## Common Countable Resources

Here are the types you'll most commonly want to limit:

- `pods` — Total Pods in the namespace
- `services` — Services (ClusterIP, NodePort, LoadBalancer)
- `configmaps` — ConfigMaps
- `secrets` — Secrets
- `persistentvolumeclaims` — PVCs
- `count/deployments.apps` — Deployments (using the extended format)
- `count/ingresses.networking.k8s.io` — Ingresses

The `count/<resource>.<group>` format works for any API resource, including custom resources.

## Example: Object Count Quota

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: object-quota
  namespace: dev
spec:
  hard:
    configmaps: "20"
    secrets: "20"
    persistentvolumeclaims: "10"
    services: "5"
    replicationcontrollers: "0"
```

A few things to notice:

- Each type has its own independent limit
- Setting a count to `"0"` effectively **disables** creation of that resource type. Here, `replicationcontrollers: "0"` prevents anyone from using the legacy ReplicationController, steering them toward Deployments instead.

:::info
Setting a resource count to `"0"` is a useful policy tool. You can use it to block deprecated resource types (like ReplicationControllers) or resource types that shouldn't exist in a particular namespace (like Ingresses in a backend-only namespace).
:::

## Custom Resource Quotas

For Deployments, Ingresses, and custom resources, use the `count/<resource>.<group>` format:

```yaml
spec:
  hard:
    count/deployments.apps: "10"
    count/ingresses.networking.k8s.io: "5"
    count/cronjobs.batch: "3"
```

This works for any resource type registered in the API, including CRDs.

## Checking Usage

Use `kubectl describe resourcequota <name> -n <namespace>` to see `Hard` and `Used` for each type — this shows exactly how close the namespace is to its limits. To discover the correct resource name for the `count/` syntax, run `kubectl api-resources --verbs=list`.

:::warning
Object count quotas are **independent of compute quotas**. Having 10 Pods within your compute budget doesn't mean you can create 100 — if the `pods` count quota is set to 10, you're blocked. Both quota types can coexist in the same namespace.
:::

---

## Hands-On Practice

### Step 1: Create an Object Count Quota

Create and apply a quota that limits the number of Pods:

```bash
kubectl create namespace dev 2>/dev/null || true
kubectl apply -f - <<EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: object-quota
  namespace: dev
spec:
  hard:
    pods: "5"
EOF
```

### Step 2: Verify the Quota

```bash
kubectl describe resourcequota object-quota -n dev
```

You'll see `pods: "5"` in the Hard column and current usage in Used.

### Step 3: Try Exceeding the Quota

Create Pods until the quota blocks you:

```bash
for i in 1 2 3 4 5 6; do kubectl run pod-$i --image=nginx -n dev 2>&1; done
```

After 5 Pods, the 6th creation will fail with "exceeded quota" or similar.

### Step 4: Clean Up

```bash
kubectl delete namespace dev
```

Or delete the quota and Pods individually.

## Wrapping Up

Object count quotas prevent namespace bloat by capping how many ConfigMaps, Secrets, Services, PVCs, and other resources can exist. They complement compute quotas for comprehensive namespace governance. Use the `count/<resource>.<group>` format for Deployments, Ingresses, and custom resources, and set counts to `"0"` to block deprecated or unwanted resource types. In the next chapter, we'll explore LimitRanges — which control per-object defaults and bounds, working hand-in-hand with the namespace-level quotas we've covered here.
