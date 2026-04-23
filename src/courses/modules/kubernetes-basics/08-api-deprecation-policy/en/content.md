---
seoTitle: 'Kubernetes API Deprecation Policy, deprecated APIs, manifest migration'
seoDescription: 'Understand the Kubernetes API deprecation policy, how long deprecated versions remain available, and how to update manifests when an API version is removed.'
---

# API Deprecation Policy

You inherit a set of manifests from a project set up two years ago. You run `kubectl apply -f deployment.yaml` and get back: `no matches for kind "Deployment" in version "extensions/v1beta1"`. The manifest worked fine on the original cluster. It fails completely on the current one. This is the API deprecation policy at work.

## What Deprecation Actually Means

Deprecating an API version means the Kubernetes project has officially scheduled that version for removal. The resource type is not going away: Deployment still exists. What is going away is the specific version path used to reach it. `extensions/v1beta1` was the old address. `apps/v1` is the current address. The old address was eventually decommissioned after a migration window.

Deprecation is not immediate removal. The policy defines minimum support windows so teams have time to update their manifests before the old version disappears.

@@@
graph LR
  D["Version deprecated\nin release N"] --> W["Migration window\nbeta: 9 months or 3 releases\nstable: 12 months or 3 releases"]
  W --> R["Version removed\nin release M"]
  R --> E["kubectl apply returns:\nno matches for kind X\nin version Y"]
@@@

## The Support Windows

The policy sets different minimum windows depending on maturity level.

**Stable** APIs (`v1`, `v2`) require at least 12 months or 3 minor releases between the deprecation announcement and removal, whichever is longer. This is the strongest commitment. Stable APIs are what production workloads rely on.

**Beta** APIs (`v1beta1`, `v2beta2`) require at least 9 months or 3 minor releases. Beta APIs are expected to graduate to stable or be deprecated and replaced within a reasonable timeframe.

**Alpha** APIs have no minimum window. They can be removed in any release without a deprecation notice. This is one more reason not to run alpha APIs in production.

:::quiz
A beta API is deprecated in Kubernetes 1.24. What is the earliest release where it can legally be removed?

- 1.25
- 1.27
- 1.30

**Answer:** 1.27. Three minor releases after 1.24 are 1.25, 1.26, and 1.27. The policy requires the version to remain available for at least those three releases. Removing it in 1.25 or 1.26 would violate the policy.
:::

## Finding the Current Version

When you encounter the "no matches for kind" error, the fix is always the same: find the current registered `apiVersion` for that resource and update the manifest.

```bash
kubectl api-resources | grep -i deployment
```

The `APIVERSION` column shows `apps/v1`. That is the address you need. Update your manifest header:

```yaml
apiVersion: apps/v1  # illustrative only
kind: Deployment
```

Then reapply. The resource definition itself does not change, only the routing key you used to reach it.

:::quiz
You see this error: `no matches for kind "CronJob" in version "batch/v1beta1"`. How do you find the correct apiVersion?

**Try it:** `kubectl api-resources | grep -i cronjob`

**Answer:** The output shows `batch/v1`. Update `apiVersion` in your manifest from `batch/v1beta1` to `batch/v1` and reapply. The CronJob spec does not need to change.
:::

## Why This Policy Exists

Without a formal deprecation policy, every cluster upgrade would be unpredictable. Manifests that ran for years could break silently, or succeed with changed semantics. The policy makes the trade explicit: if you use `v1`, the project commits to years of stability and a long removal window. If you use `v1alpha1`, you accept that the next upgrade might require a full rewrite.

:::warning
The most common version mismatch trap is copying manifests from tutorials or StackOverflow. Older posts often reference long-deprecated versions like `extensions/v1beta1` for Deployments or `networking.k8s.io/v1beta1` for Ingress. Always verify the current version with `kubectl api-resources` before applying an external manifest to any cluster.
:::

:::quiz
Why does Kubernetes maintain a formal deprecation window instead of removing old API versions as soon as a new one is available?

**Answer:** Because clusters run workloads across many teams and many manifests. Not all of them can be updated instantly after a release. The deprecation window gives operators a predictable migration schedule: they know how long the old path will still work, and they can plan the update accordingly without being forced to act immediately after each release.
:::

The `apiVersion` field you have been writing in manifests is now fully explained: it is a routing key that encodes both the domain group and the stability contract. The next module covers the complete structure of a Kubernetes manifest, where `apiVersion` and `kind` combine with `metadata` and `spec` to form the declaration that Kubernetes stores and reconciles.
