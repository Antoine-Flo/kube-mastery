---
seoTitle: Kubernetes Annotations - Metadata, Tool Configuration
seoDescription: Explore how Kubernetes annotations store rich metadata for tools, operators, and CI/CD pipelines, and learn how they differ from labels.
---

# Annotations

Suppose you want to attach some metadata to a Deployment: the name of the team that owns it, the Jira ticket that triggered the last change, a link to the runbook. You could put all of that in labels. But labels are for selection, and none of this information needs to be selectable. Packing labels with operational metadata also pollutes the selector namespace, making it harder to reason about which labels matter for controllers. Annotations exist to carry exactly this kind of data.

@@@
graph LR
    LABELS["Labels\nkey=value\nUsed for selection\n63-char value limit\nKubernetes reads them"]
    ANN["Annotations\nkey=value\nNot used for selection\nLarger values OK\nTools and operators read them"]
@@@

Annotations are key-value pairs like labels, but with two important differences. First, Kubernetes itself never uses annotations for selection: no controller reads an annotation to decide which Pods to manage or which endpoints to route traffic to. Second, annotations can hold much larger values, including multi-line strings and JSON blobs. Labels cap at 63 characters per value. Annotations can hold up to 256 KB total per object.

Here is what annotations look like in a manifest:

```yaml
# illustrative only
metadata:
  annotations:
    owner: platform-team
    ticket: INFRA-1234
    docs: https://wiki.internal/services/web
```

## Adding and Reading Annotations

Create a Deployment and attach an annotation to it:

```bash
kubectl create deployment web --image=nginx:1.28
kubectl annotate deployment web owner=platform-team
kubectl describe deployment web
```

Look at the `Annotations:` field in the `describe` output. It appears near the top of the resource description, just below `Labels`. The value is exactly the string you passed.

Now look at the raw object to see what else is there:

```bash
kubectl get deployment web -o yaml
```

Scroll to the `metadata.annotations` section. You will see a second annotation that you did not add: `kubectl.kubernetes.io/last-applied-configuration`. This one was written by `kubectl apply` automatically. It stores the full manifest you applied, as a JSON string, so that the next `apply` can compute a three-way diff between what was applied last time, what is in the cluster now, and what you want to apply next.

:::warning
The `kubectl.kubernetes.io/last-applied-configuration` annotation stores the complete applied manifest in plain text. If your manifest contains sensitive values, such as image pull secrets or API tokens, those values are readable by anyone with `get deployment` access. Be mindful of what you embed in manifests you apply with `kubectl apply`.
:::

## How the Ecosystem Uses Annotations

Annotations are the primary way external tools configure their behavior without modifying the Kubernetes API schema. A few common examples:

Prometheus uses `prometheus.io/scrape: "true"` and `prometheus.io/port` on Pods to know which ones to scrape for metrics. NGINX Ingress reads `nginx.ingress.kubernetes.io/rewrite-target` to configure URL rewriting. Helm writes `meta.helm.sh/release-name` to track which release owns a resource. None of these annotations mean anything to Kubernetes itself. The cluster stores them and ignores them. The tools that understand them do the reading.

:::quiz
A tool needs to know if a Pod should be scraped for metrics. Should this be stored as a label or an annotation?

- A label, because tools use label selectors to find resources
- An annotation, because this is configuration consumed by an external tool, not used for Kubernetes-native selection
- Either works, it is a matter of convention

**Answer:** An annotation. Kubernetes-native controllers use labels for selection and lifecycle management. External tools like Prometheus use annotations for their own configuration signals. Storing it as a label would work mechanically, but it pollutes the label space and creates confusion about what is selectable versus what is tool configuration.
:::

## Modifying and Removing Annotations

Overwriting an existing annotation follows the same `--overwrite` pattern as labels:

```bash
kubectl annotate deployment web owner=infra-team --overwrite
kubectl describe deployment web
```

Removing an annotation uses the same trailing `-` syntax:

```bash
kubectl annotate deployment web owner-
kubectl describe deployment web
```

The `owner` annotation is gone. The `kubectl.kubernetes.io/last-applied-configuration` annotation remains because it is managed by kubectl, not by you.

:::quiz
Why does `kubectl apply` store the last-applied manifest in an annotation instead of keeping that information locally on the client?

**Answer:** Kubernetes objects have no dedicated "last applied" field in their schema. kubectl apply needed a way to compute a three-way diff without requiring any local state on the machine running the command. By writing the last-applied manifest onto the object itself as an annotation, that data travels with the object. Any machine running `kubectl apply` against the same cluster picks up the annotation and can compute the diff correctly, even if it has never seen the object before.
:::

## Cleanup

```bash
kubectl delete deployment web
```

Labels and annotations together form the metadata layer of Kubernetes objects. Labels drive selection and grouping by controllers; annotations carry rich, non-selectable metadata for human operators and ecosystem tools. The next lesson covers a standard set of labels the Kubernetes project recommends so that tooling across teams works out of the box.
