---
seoTitle: 'Kubernetes Validating Admission Webhooks, ValidatingWebhookConfiguration'
seoDescription: 'Learn how Kubernetes validating admission webhooks enforce custom rules by calling an external HTTPS service to approve or reject API requests.'
---

# Validating Admission Webhooks

Built-in admission controllers handle generic cluster concerns: resource quotas, limit defaults, namespace lifecycle. But your organization has its own rules. Every Pod must carry a `team` label. Images must come from `registry.internal.example.com` only. No privileged containers, ever, regardless of namespace. None of these rules exist in any built-in plugin. You need a way to write your own enforcement logic and plug it into the admission pipeline.

That is what validating admission webhooks are for.

## How the API server calls your webhook

When a matching resource event occurs (a Pod creation, for example), the API server serializes the request into an `AdmissionReview` object. This JSON payload contains the full object spec, the user who submitted it, and metadata about the operation. The API server sends this payload via an HTTPS POST to a URL you have registered. Your server reads the payload, applies its logic, and responds with a JSON body that contains `allowed: true` or `allowed: false`.

@@@
flowchart LR
  K["kubectl apply"] --> A["API Server"]
  A --> W["ValidatingWebhook\nHTTPS POST /validate"]
  W -- "allowed: true" --> E["etcd"]
  W -- "allowed: false\nmessage: missing label" --> R["Request rejected\n403 Forbidden"]
@@@

The API server requires a valid TLS connection to your webhook server. You supply the CA certificate that signed the webhook server's cert as a base64-encoded value in the `caBundle` field. Without this, the API server refuses to call the webhook.

You can list all currently registered validating webhooks in the simulated cluster:

```bash
kubectl get validatingwebhookconfigurations
```

If the list is empty, no custom validating webhooks are registered. In a production cluster this list often contains webhooks installed by cert-manager, OPA Gatekeeper, or Kyverno.

## The ValidatingWebhookConfiguration manifest

The `ValidatingWebhookConfiguration` is a cluster-scoped resource. It does not live in a namespace. You register it once and it applies globally, filtered by the rules you define.

Start with the `apiVersion` and `kind`:

```yaml
# illustrative only
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: require-labels
```

Then define the `webhooks` list. Each entry describes one webhook endpoint. The `rules` field tells the API server which operations on which resources should trigger this webhook:

```yaml
# illustrative only
webhooks:
  - name: require-labels.example.com
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        resources: ["pods"]
        operations: ["CREATE"]
```

The `clientConfig` section tells the API server where to send the request and how to verify the TLS certificate:

```yaml
# illustrative only
    clientConfig:
      url: "https://webhook.example.com/validate"
      caBundle: <base64-ca>
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Fail
```

`sideEffects: None` signals that your webhook does not write to any external system when it processes dry-run requests. This is required for `kubectl apply --dry-run` to work correctly.

:::quiz
Why must a webhook server present a TLS certificate that the API server can verify?

**Answer:** The API server sends `AdmissionReview` objects that contain the full resource spec, including potentially sensitive data like environment variable values. The TLS connection ensures the data reaches only the intended webhook server and cannot be intercepted by a third party. The `caBundle` field in the `clientConfig` is how the API server knows which certificate authority to trust for that specific webhook.
:::

## The failurePolicy field is a security decision

`failurePolicy` controls what happens if the webhook server is unreachable or times out. Setting it to `Fail` means the API server rejects the resource creation if the webhook cannot be contacted. Setting it to `Ignore` means the API server allows the request through as if the webhook said yes.

For any security-critical rule, always use `Fail`. If your webhook enforces that all images come from an internal registry and the webhook goes down, `Ignore` would let any image through silently. That is a security hole.

:::warning
If a `ValidatingWebhookConfiguration` has `failurePolicy: Fail` and the webhook server crashes or becomes unreachable, every matching resource operation fails. In a production cluster, this can block Pod creation in all namespaces. Always scope webhooks with a `namespaceSelector` to exclude `kube-system` and other critical namespaces, so control plane operations are never blocked.
:::

## Scoping with namespaceSelector

A `namespaceSelector` lets you restrict which namespaces the webhook applies to. The common pattern is to exclude `kube-system`:

```yaml
# illustrative only
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: NotIn
          values: ["kube-system", "kube-public"]
```

This means the webhook is called for resources in all namespaces except those two. Control plane Pods in `kube-system` are not subject to your custom rules.

You can inspect the full configuration of any registered webhook:

```bash
kubectl describe validatingwebhookconfigurations require-labels
```

The output shows every rule, the timeout, the failure policy, and the namespace selector. This is the fastest way to understand what a webhook covers and diagnose why a resource creation is being rejected.

@@@
flowchart TD
  NS["Namespace: production\n(not kube-system)"] --> WH["Webhook called\nPOST /validate"]
  KS["Namespace: kube-system"] --> SK["Webhook skipped\n(namespaceSelector)"]
  WH -- "label missing" --> REJ["Rejected"]
  WH -- "label present" --> OK["Allowed"]
@@@

:::quiz
A `ValidatingWebhookConfiguration` is deployed with `failurePolicy: Fail` and no `namespaceSelector`. The webhook server pod is deleted. What happens next?

**Try it:** `kubectl get validatingwebhookconfigurations`

**Answer:** Every create or update operation on matching resources in every namespace, including `kube-system`, fails with a timeout or connection refused error. The cluster control plane itself may be affected if the matched resources include types that the control plane creates internally. This is why `namespaceSelector` excluding `kube-system` is not optional for production webhooks.
:::

Validating webhooks let you enforce any rule you can express in code, without touching the API server binary. The next lesson covers mutating webhooks, which go a step further: instead of only approving or rejecting, they can change the object itself before it is stored.
