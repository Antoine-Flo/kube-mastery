---
seoTitle: 'Kubernetes imagePullSecrets, Private Registry Credentials'
seoDescription: 'Learn how to pull container images from private registries in Kubernetes using dockerconfigjson Secrets, imagePullSecrets in Pod specs, and ServiceAccount-level pull credentials.'
---

# Pulling from Private Registries with imagePullSecrets

Your company stores its container images in a private registry. No one outside the organization can pull them without credentials. Kubernetes needs those credentials too, but you do not hardcode them into the Pod spec where every developer on the team can read them. Instead, you store them in a Secret and reference that Secret from the Pod. The kubelet reads the Secret at pull time and authenticates against the registry on behalf of the Pod.

## Storing credentials in a Secret

Docker registry credentials are stored as a Secret of type `kubernetes.io/dockerconfigjson`. This type is exactly what it sounds like: a base64-encoded version of the JSON config file that Docker writes to `~/.docker/config.json` when you run `docker login`. Kubernetes knows how to hand this to the container runtime when pulling an image.

You create this Secret with a single command:

```bash
kubectl create secret docker-registry my-registry-creds --docker-server=registry.example.com --docker-username=myuser --docker-password=mypassword
```

:::info
In the simulator, this command creates the Secret object with placeholder credential values since no real external registry is reachable from the browser environment. The Secret structure and all subsequent steps work identically to a real cluster.
:::

After creating it, confirm the Secret exists and has the correct type:

```bash
kubectl get secret my-registry-creds
```

The output will show the type as `kubernetes.io/dockerconfigjson`. You can also describe it to see its metadata, though the data field will be redacted in normal output:

```bash
kubectl describe secret my-registry-creds
```

:::quiz
What Kubernetes Secret type holds Docker registry credentials?

**Answer:** `kubernetes.io/dockerconfigjson`. Kubernetes treats this type specially: the kubelet knows to extract the credential payload and pass it to the container runtime when pulling an image. A generic `Opaque` Secret would not work for this purpose.
:::

## Referencing the Secret in a Pod

Once the Secret exists, you reference it in the Pod spec under `spec.imagePullSecrets`. Create the manifest:

```bash
nano private-pod.yaml
```

```yaml
# illustrative only
apiVersion: v1
kind: Pod
metadata:
  name: private-pod
spec:
  imagePullSecrets:
    - name: my-registry-creds
  containers:
    - name: app
      image: registry.example.com/myapp:1.0
```

`imagePullSecrets` is a list, so you can reference multiple Secrets if the Pod needs images from more than one private registry. Apply the manifest:

```bash
kubectl apply -f private-pod.yaml
```

Then describe the Pod to verify that the pull secret was picked up:

```bash
kubectl describe pod private-pod
```

Look at the `Image:` field to confirm the full image reference, and at the `Events` section to see whether the pull succeeded. In a real cluster, the kubelet would contact `registry.example.com`, present the credentials from the Secret, and pull the image. In the simulator the image is resolved locally, but the pull secret reference is validated against cluster state.

@@@
graph TD
A["kubectl create secret\ndocker-registry"] --> B["Secret stored\nin cluster state"]
B --> C["Pod spec references\nimagePullSecrets"]
C --> D["kubelet reads\ncredentials from Secret"]
D --> E["Authenticates to\nprivate registry"]
E --> F["Image pulled\nsuccessfully"]
@@@

:::warning
A Pod that tries to pull from a private registry without `imagePullSecrets` will enter `ImagePullBackOff` with a clear error in its events: `unauthorized: authentication required`. Kubernetes makes no attempt to guess credentials. If the Secret name in `imagePullSecrets` is wrong or the Secret does not exist in the same namespace as the Pod, the result is the same failure. Secrets are namespace-scoped: a Secret in `default` cannot be referenced by a Pod in `staging`.
:::

## Attaching pull secrets to a ServiceAccount

Referencing `imagePullSecrets` on every individual Pod spec gets tedious quickly, especially in a namespace with dozens of Pods. There is a cleaner approach: attach the pull secret to the namespace's ServiceAccount instead.

Every Pod in Kubernetes uses a ServiceAccount. Unless you specify one, it uses the `default` ServiceAccount of its namespace. If you patch `imagePullSecrets` onto that ServiceAccount, every Pod that uses it will inherit the pull secret automatically, with no change to individual Pod specs.

```bash
kubectl patch serviceaccount default -p '{"imagePullSecrets":[{"name":"my-registry-creds"}]}'
```

:::quiz
How can you avoid adding `imagePullSecrets` to every Pod spec individually?

**Answer:** Attach the pull Secret to the namespace's ServiceAccount. Every Pod using that ServiceAccount inherits the pull credentials automatically. This is the standard approach for namespaces where all Pods pull from the same private registry.
:::

:::warning
The `--docker-password` flag you pass to `kubectl create secret docker-registry` is visible in your shell history and in process listings while the command runs. In a real production environment, prefer passing the password through an environment variable or reading it from a secrets manager. In the simulator this is not a concern, but forming the habit matters for the CKA exam context.
:::

You can now authenticate Kubernetes against a private registry, store the credentials safely in a Secret, and apply them at Pod or ServiceAccount scope. The remaining question is: once Kubernetes has access to the image, when does it actually pull? That is controlled by `imagePullPolicy`, which is the subject of the next lesson.
