---
seoTitle: 'Kubernetes imagePullPolicy, Always, IfNotPresent, Never'
seoDescription: 'Learn how Kubernetes imagePullPolicy controls when container images are pulled from a registry, what the default behavior is for latest vs pinned tags, and how to avoid stale cached images.'
---

# Image Pull Policies

Kubernetes does not necessarily pull a fresh image every time a Pod starts. It might use a copy already on the node from a previous pull. Whether it does or not is controlled by `imagePullPolicy`, and the default behavior is less obvious than it appears. Getting this wrong is a common source of "why is my update not showing up" confusion during the CKA exam and in real clusters.

## The three pull policies

`imagePullPolicy` has three possible values: `Always`, `IfNotPresent`, and `Never`. Each one controls what the kubelet does at Pod startup when it is about to run a container.

@@@
graph TD
A["Pod starts on node"] --> B{"imagePullPolicy?"}
B -->|"Always"| C["Pull from registry\nevery time"]
B -->|"IfNotPresent"| D{"Image already\non node?"}
B -->|"Never"| E{"Image already\non node?"}
D -->|"Yes"| F["Use cached image"]
D -->|"No"| G["Pull from registry"]
E -->|"Yes"| H["Use cached image"]
E -->|"No"| I["ErrImageNeverPull"]
@@@

`Always` tells the kubelet to contact the registry on every Pod start, regardless of whether a local copy of the image exists on the node. This ensures you always run exactly what the registry currently has at that tag. The trade-off is that every Pod start incurs a network round-trip to the registry, and startup is slower if the image is large.

`IfNotPresent` tells the kubelet to use the local copy if one exists and only pull if the node has never seen this image before. This is the most common policy in practice: fast startup once an image is cached, and no unnecessary registry traffic. The risk is that the local copy might be stale if the tag was moved at the registry.

`Never` tells the kubelet to never contact the registry. If the image is not already on the node, the Pod fails immediately. This is used in air-gapped environments or when images are pre-loaded onto nodes by a separate mechanism.

## Default rules

Why does Kubernetes not simply pick one default for all images? Because the right default depends on the tag. If you use `latest` or omit the tag entirely, Kubernetes assumes the image is mutable and defaults to `Always`. If you use a specific tag like `1.28`, Kubernetes assumes you intentionally pinned a version and defaults to `IfNotPresent`.

:::quiz
A Pod uses `image: my-app:1.0` with no `imagePullPolicy` specified. The image is already cached on the node from a previous deployment. You delete the Pod and it is recreated. Will Kubernetes pull a fresh image?

**Answer:** No. With a non-latest tag and no explicit policy, Kubernetes defaults to `IfNotPresent`. The node already has the image, so the kubelet uses the cached copy. If the registry has a newer build under `my-app:1.0` (because the tag was moved), you will not get it. To force a fresh pull, either set `imagePullPolicy: Always` or use a new unique tag or a digest.
:::

## Seeing the policy in action

Create a manifest with an explicit pull policy:

```bash
nano pull-policy-pod.yaml
```

```yaml
# illustrative only
apiVersion: v1
kind: Pod
metadata:
  name: pull-policy-pod
spec:
  containers:
    - name: app
      image: nginx:1.28
      imagePullPolicy: Always
```

Apply it:

```bash
kubectl apply -f pull-policy-pod.yaml
```

Check that the Pod started:

```bash
kubectl get pod pull-policy-pod
```

Then describe it to see the resolved policy:

```bash
kubectl describe pod pull-policy-pod
```

In the `Containers` section, look for the `Image pull policy:` field. It will confirm the value Kubernetes applied, whether you set it explicitly or let it default. This field is the authoritative source of truth for what the kubelet will do on the next restart.

:::warning
Setting `imagePullPolicy: Never` when the image is not cached on the node causes the Pod to enter `ErrImageNeverPull` immediately. This is a hard failure: the kubelet does not retry. The Pod will stay in that state until it is deleted. You can reproduce this by setting `Never` on an image that the simulated cluster has not yet pulled. Describe the Pod and read the Events section to see the exact kubelet message.
:::

## The most deterministic combination

`IfNotPresent` with a pinned tag is common, but there is a stronger pattern for production: `Always` combined with a digest reference.

```yaml
# illustrative only
image: nginx@sha256:abc123...
imagePullPolicy: Always
```

A digest cannot change, so every pull is guaranteed to fetch the exact same image content. The `Always` policy ensures the kubelet verifies against the registry on every Pod start rather than trusting the local cache. Together, these two settings eliminate the two most common sources of image drift: a moved tag and a stale cache.

:::info
Using `imagePullPolicy: Always` with a digest is the most deterministic image pattern in Kubernetes. The digest makes the reference immutable, and `Always` ensures the node checks the registry rather than silently falling back to a cached layer. For CKA exam scenarios about image reproducibility, this combination is the correct answer.
:::

:::quiz
You set `imagePullPolicy: IfNotPresent` and deploy `image: nginx:latest`. The first Pod pulls the image and it is cached on the node. A week later a new nginx release lands and the `latest` tag moves. A new Pod is scheduled to the same node. Which nginx version does it run?

**Answer:** The old cached version. `IfNotPresent` means the kubelet sees the image is already on the node and skips the pull entirely, even though the tag now points to something different at the registry. This is why `latest` with `IfNotPresent` is a trap: you think you are getting the newest image, but you are getting whatever was pulled first on that node.
:::

You now control all three layers of image runtime behavior: the image reference that tells Kubernetes where to find the image, the pull secret that authenticates against private registries, and the pull policy that governs when the kubelet actually contacts the registry. The next module covers Admission Controllers, which operate one layer higher and let you enforce cluster-wide rules about what can be created in the first place.
