---
seoTitle: 'Kubernetes API Groups, apiVersion, resource organization'
seoDescription: 'Understand how Kubernetes API groups organize resources by domain, why some resources use v1 while others use apps/v1, and how to discover available groups with kubectl.'
---

# API Groups

You have seen `apiVersion: v1` for Pods and ConfigMaps, and `apiVersion: apps/v1` for Deployments. That slash-separated prefix is not decoration. It tells the API server exactly which group this resource belongs to, and which version of that group you are targeting.

## Why Groups Exist

Early Kubernetes had one flat list of resource types. As the project grew, that single surface became difficult to evolve: adding RBAC resources meant they sat next to Pod definitions in the same codebase, changes to batch workloads could affect storage classes, and external teams had no clean namespace to add their own resource types.

Groups solved this by organizing resources by domain. All workload controllers live in `apps`. Batch workloads live in `batch`. RBAC lives in `rbac.authorization.k8s.io`. Each group evolves independently, gets its own versioning, and can be extended without touching unrelated domains.

@@@
graph TD
  G0["Core group\n(apiVersion: v1)"] --> R0["Pod\nService\nConfigMap\nSecret\nNamespace"]
  G1["apps"] --> R1["Deployment\nReplicaSet\nDaemonSet\nStatefulSet"]
  G2["batch"] --> R2["Job\nCronJob"]
  G3["rbac.authorization.k8s.io"] --> R3["Role\nClusterRole\nRoleBinding"]
  G4["networking.k8s.io"] --> R4["NetworkPolicy"]
@@@

## The Core Group

Some resources have no group prefix at all: `apiVersion: v1`. These are in the "core" group, which predates the group system. Pods, Services, ConfigMaps, Secrets, Namespaces, and PersistentVolumes all live here. They kept the short form for backward compatibility. When you see `v1` with no slash, it means core group.

All other groups follow the `group/version` pattern. `apps/v1` means the `apps` group at version `v1`. `batch/v1` means the `batch` group at version `v1`.

Run this to see every resource, its group, and its short name in the simulated cluster:

```bash
kubectl api-resources
```

The `APIVERSION` column shows the group and version for each resource. Resources with just `v1` are in the core group. Resources with a slash are in a named group.

:::quiz
What does `apiVersion: batch/v1` mean in a manifest?

- The resource is in the core group at version v1
- The resource is in the `batch` group at version `v1`
- The resource is deprecated and will be replaced by a newer version

**Answer:** The `batch` group at version `v1`. The part before the slash is the group name, the part after is the version. Core group resources use just `v1` with no slash.
:::

## Filtering by Group

When you want to see all resources in a specific group, pass `--api-group` to the same command:

```bash
kubectl api-resources --api-group=apps
```

You will see Deployments, ReplicaSets, DaemonSets, and StatefulSets. Every resource in that list manages workload lifecycles. Now try the batch group:

```bash
kubectl api-resources --api-group=batch
```

Job and CronJob. Each group has a focused domain. This is not just for humans: the API server uses the group to route requests to the correct handler and apply the correct validation schema.

:::quiz
You want to create a resource that schedules periodic work. Which `apiVersion` should you use?

**Try it:** `kubectl api-resources --api-group=batch`

**Answer:** `batch/v1`. CronJob lives in the `batch` group, which handles run-to-completion and scheduled workloads.
:::

## Groups as a Routing Key

Every field in a manifest is validated against the schema for the declared group and version. If you write `apiVersion: apps/v1` and `kind: Job`, the API server rejects it: Job is not registered under `apps`. The group and kind must match.

@@@
graph LR
  M1["apiVersion: apps/v1\nkind: Deployment"] --> L1["API server: look up\napps/v1/Deployment"]
  L1 --> OK["Found: validate and store"]
  M2["apiVersion: apps/v1\nkind: Job"] --> L2["API server: look up\napps/v1/Job"]
  L2 --> ERR["Not found: reject with error"]
@@@

This is why `apiVersion` is not optional boilerplate. It is a routing key. Getting it wrong produces an immediate rejection before any resource is created.

:::quiz
You apply a manifest with `apiVersion: v1` and `kind: Deployment`. What happens?

**Answer:** The API server rejects the request. Deployment is in the `apps` group, not the core group. The correct `apiVersion` is `apps/v1`. The API server returns a "no matches for kind" error before anything is written to etcd.
:::

The group organizes the resource by domain. The version tells you how stable and mature the API is. The next lesson covers what the version labels actually mean, and why a resource can move from `v1beta1` to `v1` over time.
