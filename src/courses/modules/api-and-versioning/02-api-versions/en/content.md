---
seoTitle: 'Kubernetes API Versions, alpha beta stable, apiVersion maturity'
seoDescription: 'Learn how Kubernetes API versions signal stability, what alpha, beta, and stable mean for reliability, and how to check which version a resource is currently on.'
---

# API Versions

You now know that `apiVersion: apps/v1` routes your manifest to the `apps` group at version `v1`. But what does the `v1` part actually promise? If you look at the history of Deployment, it started as `extensions/v1beta1`, moved to `apps/v1beta1`, then `apps/v1beta2`, and finally landed on `apps/v1`. That progression reflects a formal maturity model, and every number and suffix is a deliberate signal.

## The Three Levels

Kubernetes uses three maturity levels to communicate how stable an API is.

@@@
graph LR
  A["v1alpha1\nExperimental\nMay change or disappear"] --> B["v1beta1\nMostly stable\nBreaking changes need notice"]
  B --> C["v1\nStable\nProduction-ready"]
@@@

**Alpha** versions carry a suffix like `v1alpha1` or `v2alpha1`. An alpha API is experimental. The design is still being validated with real usage. Fields may be renamed, semantics may shift, and the entire API may be removed in a future release without a migration path. Alpha features are typically disabled by default and require a feature gate to enable on a real cluster. You will rarely encounter them outside of development environments.

**Beta** versions carry a suffix like `v1beta1`. A beta API has had significant real-world usage, the design is mostly settled, and any breaking changes require a formal deprecation notice before removal. Beta APIs are generally enabled by default. Running beta versions in production is common, but you should plan for a migration to stable at some point.

**Stable** versions use a plain number: `v1`, `v2`. A stable API is production-ready. The Kubernetes project commits to not introducing breaking changes within a major version, and removal requires a long deprecation window. The `v1` you see on Pod, Service, and ConfigMap has been stable for years.

:::quiz
A manifest uses `apiVersion: v1alpha1`. What should you expect?

- It is experimental and may change or be removed without notice
- It is stable and safe for production use
- It is the latest version and recommended for all new workloads

**Answer:** Experimental, may change or be removed. Alpha APIs carry no stability guarantees. They are early feedback channels, not production contracts.
:::

## Checking the Current Version

To see which version each resource currently uses in the simulated cluster:

```bash
kubectl api-resources
```

Look at the `APIVERSION` column. Deployments are at `apps/v1`. Jobs are at `batch/v1`. These are stable versions. CronJob also reached `batch/v1` in Kubernetes 1.21, graduating from a long beta period.

:::quiz
What version is the CronJob resource currently at?

**Try it:** `kubectl api-resources --api-group=batch`

**Answer:** `batch/v1`. CronJob graduated to stable in Kubernetes 1.21. Before that, it existed as `batch/v1beta1` for several years.
:::

## Multiple Versions Can Coexist

During a transition from beta to stable, both versions can be registered simultaneously. When you apply a manifest using the older but still-supported version, the API server converts it internally to the storage version. The resource is created successfully. You will not see the conversion: it happens transparently.

@@@
graph LR
  OLD["kubectl apply\napps/v1beta1"] --> CONV["API server\nconverts to apps/v1"]
  CONV --> ETCD["Stored as apps/v1"]
  STABLE["kubectl apply\napps/v1"] --> ETCD
@@@

This conversion is why manifests written for older clusters sometimes still work on newer ones. But it depends entirely on the old version still being registered. Once a version is removed, that fallback disappears, and the manifest fails with a clear error.

:::quiz
You apply a manifest using an older beta version of an API that is still registered on the cluster. The resource is created without errors. Why?

**Answer:** The API server performs internal conversion between registered versions of the same resource. As long as the old version is still registered, the request is accepted and converted to the internal storage version. The user sees a successful response.
:::

## Why This Matters When Writing Manifests

When you write a manifest, the version label is a commitment you are making. Using `v1` means you are relying on a production-grade contract. Using `v1beta1` means you accept that a future upgrade may require you to update your manifests. Using `v1alpha1` means you accept that the entire resource could disappear.

The practical rule: always use the stable version when one exists. Run `kubectl api-resources` to verify before writing a new manifest type for the first time.

The next lesson covers what happens when that maturity process includes removing an old version, and what the formal deprecation policy means for your existing manifests.
