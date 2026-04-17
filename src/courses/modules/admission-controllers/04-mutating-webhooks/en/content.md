---
seoTitle: 'Kubernetes Mutating Admission Webhooks, MutatingWebhookConfiguration, JSON Patch'
seoDescription: 'Learn how Kubernetes mutating admission webhooks patch objects before storage, inject sidecars, add labels, and how JSON Patch responses work.'
---

# Mutating Admission Webhooks

A validating webhook looks at a submitted object and says yes or no. But what if saying no is too blunt? A developer forgets to add the `environment: production` label. A container spec is missing its resource limits. You could reject the request and tell the developer to fix it. Or you could fix it automatically and let the request through. Mutating admission webhooks do exactly that: they intercept the object, change it, and hand a patched version back to the API server.

## How mutation works: JSON Patch

When a mutating webhook is triggered, the API server sends the same `AdmissionReview` payload it would send to a validating webhook. Your webhook server reads it, computes what changes to make, and responds with a JSON Patch (RFC 6902). The API server applies that patch to the original object. The result is what gets stored in etcd.

A JSON Patch is a list of operations. Each operation has an `op` (add, remove, replace), a `path` (a JSON Pointer to the field), and a `value`. This is what the response body looks like:

```json
{
  "response": {
    "uid": "...",
    "allowed": true,
    "patchType": "JSONPatch",
    "patch": "[{\"op\":\"add\",\"path\":\"/metadata/labels/injected\",\"value\":\"true\"}]"
  }
}
```

The `patch` field is a base64-encoded string containing the JSON Patch array. The API server decodes it, applies each operation to the submitted object, and proceeds with the modified version.

@@@
flowchart LR
  K["kubectl apply"] --> A["API Server"]
  A --> MW["MutatingWebhook\nPOST /mutate"]
  MW -- "JSON Patch" --> PA["Patched object"]
  PA --> VW["ValidatingWebhook\nsees patched object"]
  VW -- "allowed" --> E["etcd\n(stores patched object)"]
@@@

Notice the order: mutating runs before validating. The object that validating webhooks inspect is already the patched version. This is a critical ordering guarantee.

You can list all currently registered mutating webhooks:

```bash
kubectl get mutatingwebhookconfigurations
```

## The MutatingWebhookConfiguration manifest

The structure mirrors `ValidatingWebhookConfiguration`. The `kind` changes, and the webhook URL points to your mutation endpoint.

```yaml
# illustrative only
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: inject-labels
```

The `webhooks` list uses the same `rules` and `clientConfig` fields:

```yaml
# illustrative only
webhooks:
  - name: inject-labels.example.com
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        resources: ["pods"]
        operations: ["CREATE"]
    clientConfig:
      url: "https://webhook.example.com/mutate"
      caBundle: <base64-ca>
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Fail
```

The `failurePolicy` carries the same risk as in validating webhooks. If your mutating webhook goes down and `failurePolicy: Fail` is set, Pod creation fails. Scope your webhook with a `namespaceSelector` to protect critical namespaces.

```bash
kubectl describe mutatingwebhookconfigurations inject-labels
```

This shows the full registered configuration: which resources are matched, which namespace selector applies, the timeout, and the failure policy.

:::quiz
A Pod is submitted without an `environment: production` label. A MutatingWebhook adds it. Then a ValidatingWebhook checks that all Pods have the `environment` label. Will the Pod be admitted?

- No, because the Pod spec submitted by the user lacked the label
- Yes, because mutating webhooks run before validating, so the label is present when validation runs
- No, because mutating webhooks cannot add labels

**Answer:** Yes. Mutating webhooks run before validating webhooks. By the time the validating webhook inspects the object, the label has already been injected. The validating webhook sees the patched version, finds the label, and allows the request.
:::

## The sidecar injection pattern

The most widely used application of mutating webhooks is automatic sidecar injection. Service meshes like Istio and Linkerd use this pattern. You deploy the mesh's mutating webhook. You label namespaces where you want the mesh active. Every Pod created in those namespaces is automatically patched to include a proxy sidecar container. Developers write normal Pod specs with no knowledge of the mesh.

This is what the patch looks like conceptually: the webhook receives a Pod with one container and responds with a patch that adds a second container entry to the `spec.containers` array.

:::info
The sidecar injection pattern is why it matters that mutating runs before validating. If a validating webhook enforces a rule like "every Pod must have exactly one sidecar with image `proxy:v2`", the mutating webhook must inject that sidecar first. The validating webhook can then verify it is present. The ordering guarantee is what makes this pattern safe.
:::

@@@
flowchart TD
  PD["Pod spec: 1 container\n(no sidecar)"] --> MW["MutatingWebhook\ninjects proxy sidecar"]
  MW --> PP["Patched Pod spec\n2 containers"]
  PP --> VW["ValidatingWebhook\nverifies sidecar present"]
  VW --> E["etcd"]
@@@

:::warning
Mutating webhooks that add containers or volumes can cause unexpected behavior if the developer is not aware of them. A Pod describe output will show containers the developer never wrote. Always document which namespaces have active mutating webhooks and what they inject, so operators can reason about what is actually running.
:::

:::quiz
Why is it safe for a ValidatingWebhook to check for a label that only a MutatingWebhook adds, even though the user never sets that label?

**Answer:** Mutating webhooks always run before validating webhooks in the admission pipeline. The validating webhook never sees the original user-submitted object. It only sees the object after all mutations have been applied. If the mutating webhook is deployed and functioning correctly, the label is guaranteed to be present by the time any validating webhook checks for it.
:::

You have now covered the full admission pipeline: built-in controllers enforce generic cluster policy, enabling and disabling them is a matter of API server flags, and webhooks extend that pipeline with arbitrary custom logic. Mutating webhooks change objects before storage, validating webhooks approve or reject them after mutation. The next module covers Pod Security Standards, which use the built-in `PodSecurity` admission controller to enforce security profiles across namespaces without any webhook infrastructure required.
