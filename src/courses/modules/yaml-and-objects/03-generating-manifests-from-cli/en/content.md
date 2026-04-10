---
seoTitle: 'Generate Kubernetes Manifests with --dry-run and kubectl'
seoDescription: 'Learn how to use kubectl --dry-run=client -o yaml to generate valid manifests for Pods, Deployments, and Services without creating cluster resources.'
---

# Generating Manifests from the CLI

Writing a Kubernetes manifest from scratch is surprisingly error-prone. You need the exact indentation, the correct `apiVersion` for each `kind`, and precise field names. A single typo in a field name, an extra space before a key, or the wrong nesting level causes the API server to reject the entire manifest with a cryptic validation error. There is a better starting point.

## The Generate-Then-Edit Pattern

`kubectl` can generate a structurally valid manifest for you without creating anything in the simulated cluster. The two flags that make this work are `--dry-run=client` and `-o yaml`.

`--dry-run=client` tells kubectl to compute the manifest locally and print it, without sending a creation request to the API server. Nothing is created, nothing changes in the cluster.

`-o yaml` formats the output as YAML rather than the default table view.

Together, they give you a valid template you can redirect into a file, edit, and apply.

```bash
kubectl run web --image=nginx:1.28 --dry-run=client -o yaml
```

Look at the output. Every field is correctly named, correctly indented, and uses the right `apiVersion` for a Pod. You did not have to know any of that. kubectl knew it.

@@@
graph LR
    GEN["kubectl ... --dry-run=client -o yaml"]
    FILE["pod.yaml\n(generated template)"]
    EDIT["nano pod.yaml\n(customize)"]
    APPLY["kubectl apply -f pod.yaml\n(create in cluster)"]
    GEN -->|"> pod.yaml"| FILE --> EDIT --> APPLY
@@@

The workflow is always the same: generate the template, save it to a file, edit what you need, apply. This pattern eliminates an entire class of syntax errors before they ever reach the API server.

## Saving the Generated Manifest

To save the output directly into a file:

```bash
kubectl run web --image=nginx:1.28 --dry-run=client -o yaml > pod.yaml
```

Then inspect it:

```bash
cat pod.yaml
```

You will see fields like `creationTimestamp: null` and a mostly empty `status: {}`. These are artifacts of the generation process. You do not need them. In the next step, open the file and clean it up:

```bash
nano pod.yaml
```

Remove any `null` fields and the empty `status` block. Keep only `apiVersion`, `kind`, `metadata.name`, and `spec.containers`. A minimal, readable manifest is easier to understand and maintain than one cluttered with generated noise.

:::quiz
Why is `--dry-run=client -o yaml` more reliable than writing a manifest from scratch when starting out?

**Answer:** The generated manifest is structurally guaranteed to be valid. The field names, indentation, and correct `apiVersion` for the chosen `kind` are all correct from the start. You edit a working template rather than building from a blank page, which removes a whole class of typo-driven API server rejections.
:::

## Generating a Deployment Manifest

`kubectl run` generates a Pod. To generate a Deployment, use `kubectl create deployment`:

```bash
kubectl create deployment web --image=nginx:1.28 --dry-run=client -o yaml
```

The output is a Deployment manifest with `apiVersion: apps/v1`, a `selector`, a `template`, and a `replicas` field set to 1. Notice the nested structure: the Deployment contains a Pod template inside `spec.template`, which itself has `spec.containers`. This nesting is something you would have to recall perfectly if writing from scratch.

Save it to a file to customize it:

```bash
kubectl create deployment web --image=nginx:1.28 --dry-run=client -o yaml > deployment.yaml
```

```bash
nano deployment.yaml
```

From here you can change `replicas`, add environment variables, set resource limits, or anything else the Deployment spec supports.

:::warning
The generated manifest often contains more fields than you need, including `null` values, empty annotations, and a pre-populated but empty `status` block. Leaving these in is not harmful, but it makes the manifest harder to read and review. Get into the habit of cleaning generated manifests before committing them. A manifest with 15 meaningful lines is far easier to audit than one with 60 lines, half of which are `null`.
:::

## Client-Side vs Server-Side Dry Run

You will occasionally see `--dry-run=server` mentioned. The difference matters.

`--dry-run=client` computes the manifest entirely in kubectl without contacting the API server. It is fast and works offline, but it does not validate webhook rules or admission controller policies that exist only in the cluster.

`--dry-run=server` sends the manifest to the API server, which validates it fully including admission webhooks, then discards it without persisting. It gives you more accurate validation at the cost of a network round trip.

For generating a starting template, `--dry-run=client` is always sufficient. For validating a manifest before applying it in a production environment, `--dry-run=server` gives stronger guarantees.

:::quiz
What is the difference between `kubectl run` and `kubectl create deployment` when used with `--dry-run=client -o yaml`?

- Both generate the same Deployment manifest
- `kubectl run` generates a Pod manifest, `kubectl create deployment` generates a Deployment manifest
- `kubectl run` generates a Deployment, `kubectl create deployment` generates a Pod

**Answer:** `kubectl run` generates a Pod manifest, `kubectl create deployment` generates a Deployment manifest. They produce different `kind` values and different structure. This distinction matters when you need a bare Pod versus a managed workload.
:::

## Desirable Difficulty

You have now seen how to generate both a Pod and a Deployment manifest. Without looking back at the commands above, generate a Deployment manifest for an image called `myapp:1.0` with the deployment named `backend`, and save it to a file called `backend.yaml`. You have everything you need.

In the next lesson, you will look at how Kubernetes enforces naming rules for objects and why those rules have direct consequences for DNS-based service discovery inside the cluster.

