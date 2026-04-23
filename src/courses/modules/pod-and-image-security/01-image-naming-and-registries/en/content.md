---
seoTitle: 'Kubernetes Image Naming, Registries, Tags, and Digests'
seoDescription: 'Understand the full Kubernetes image name format, how Docker Hub is the default registry, why tags are mutable, and how digests give you truly immutable image references.'
---

# Image Naming and Registries

You write `image: nginx:1.28` in a Pod spec and Kubernetes pulls the container image without a word of complaint. But where does it actually pull from? The answer involves a registry, a namespace, a repository, and a tag, and if any part of that chain is wrong or ambiguous, your Pod will fail before it runs a single line of code.

## How Kubernetes reads an image reference

Every image reference follows a structured format. The full form is:

`[registry/][namespace/]repository[:tag][@digest]`

Most of those fields are optional, and that is exactly where surprises happen. When you write `nginx:1.28`, Kubernetes silently expands it to its fully qualified form before the kubelet ever contacts a registry.

@@@
graph LR
A["nginx:1.28\n(what you write)"] --> B["docker.io\n(registry)"]
A --> C["library\n(namespace)"]
A --> D["nginx\n(repository)"]
A --> E["1.28\n(tag)"]
B --> F["docker.io/library/nginx:1.28\n(what Kubernetes pulls)"]
C --> F
D --> F
E --> F
@@@

The default registry is Docker Hub, which Kubernetes addresses as `docker.io`. The default namespace for official images is `library`. So `nginx:1.28` expands to `docker.io/library/nginx:1.28` inside the kubelet. You can verify the resolved reference for any running Pod by describing it:

```bash
kubectl describe pod <pod-name>
```

Scroll to the `Containers` section. The `Image:` field shows the expanded reference the node actually used. This is useful when debugging pull failures because the error message will reference the fully qualified name, not the short form you wrote in your manifest.

:::quiz
What is the fully qualified image reference for `nginx:1.28` on Docker Hub?

**Answer:** `docker.io/library/nginx:1.28`. Kubernetes expands the short form automatically. The registry defaults to `docker.io`, and official images fall under the `library` namespace. Your manifest never needs to spell this out, but knowing it explains why error messages look different from what you typed.
:::

## Public versus private registries

Not every image lives on Docker Hub. Your company might store private images on Google Artifact Registry, Amazon ECR, GitHub Container Registry, or a self-hosted registry. When you include a full registry hostname at the start of the image field, Kubernetes skips Docker Hub entirely and contacts that registry directly:

`registry.example.com/myteam/myapp:2.1`

To see which images are currently running in the simulated cluster and on which node they are scheduled:

```bash
kubectl get pods -o wide
```

Public registries serve images to anyone without authentication. Private registries require credentials. This distinction matters: if you accidentally write `image: myapp` without a registry prefix, Kubernetes will look on Docker Hub for a public image named `myapp`, find nothing, and fail with `ErrImagePull`. Credentials for private registries are stored in Secrets and covered in the next lesson.

## Tags are mutable, digests are not

A tag is just a label. The image maintainer can move that label to a different image layer at any time. `nginx:1.28` today might point to a different build next week if the maintainer decides to re-tag. `nginx:latest` is even less predictable: it changes every time a new release is pushed and is effectively a moving target.

The only truly immutable image reference is a **digest**:

`nginx@sha256:abc123...`

A digest is the cryptographic hash of the image manifest. It cannot change because the hash is derived from the content itself. If you write `nginx@sha256:abc123`, you will get exactly that image on every node, in every cluster, every time.

@@@
graph LR
T["nginx:1.28\n(tag)"] -->|"can change"| M["mutable\nreference"]
D["nginx@sha256:abc123\n(digest)"] -->|"content-addressed"| I["immutable\nreference"]
@@@

:::warning
When a tag does not exist on the registry, the Pod enters `ErrImagePull` and then cycles into `ImagePullBackOff`. Kubernetes retries with exponential backoff but will never succeed until you correct the image reference. To read the pull error, describe the Pod and look at the `Events` section at the bottom. The event will contain the registry's error message verbatim, such as `manifest unknown: manifest tagged by "nonexistent" is not found`. The Pod will stay in this state until you fix the manifest and redeploy.
:::

```bash
kubectl get pods
```

A Pod stuck in `ImagePullBackOff` will show that status in the `STATUS` column. To read the full error from the kubelet:

```bash
kubectl describe pod <pod-name>
```

:::quiz
You deploy a Pod using `image: nginx:1.28`. Three months later you delete it and recreate it with the same manifest. Is it guaranteed to pull the same nginx binary?

**Answer:** No, unless you use a digest. A tag is a mutable pointer. The maintainer could have moved `nginx:1.28` to a different image layer in the meantime. The only way to guarantee bit-for-bit identity across deployments is to use a digest reference such as `nginx@sha256:abc123...`.
:::

You now know how Kubernetes parses an image reference and why the registry, namespace, tag, and digest each play a distinct role. The next step is handling private registries: your simulated cluster does not have open access to pull every image, and when authentication is required, Kubernetes needs credentials stored in a Secret.
