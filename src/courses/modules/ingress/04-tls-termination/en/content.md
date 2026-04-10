---
seoTitle: 'TLS Termination with Gateway API and Envoy Gateway in Kubernetes'
seoDescription: 'Learn how to configure HTTPS with Kubernetes Gateway API, how TLS termination works at the Envoy data plane, and how TLS Secrets are referenced by Gateway listeners.'
---

# Securing Traffic with TLS Termination

Your API is live and reachable over HTTP. Every request, including authentication tokens and sensitive response payloads, travels across the network in plain text. You want to serve it over HTTPS so all communication is encrypted in transit. The good news is that Gateway API handles encryption at the Gateway layer, not inside your Pods: your application containers keep receiving plain HTTP connections, and the Envoy proxy handles the encryption and decryption at the edge.

@@@
graph LR
    Client["Client\nHTTPS request"]
    GW["Gateway\nTLS termination\ncert from Secret"]
    POD["Pod\nplain HTTP"]

    Client --> GW
    GW --> POD
@@@

This pattern is called TLS termination. The client establishes a TLS-encrypted connection with the Gateway. The Gateway decrypts the connection, reads the request, and forwards it over plain HTTP to the backend Pod. The Pod has no certificate to manage and no TLS configuration of its own. Encryption is handled in one place, at the edge, making certificate management centralized and consistent.

## Creating the TLS Secret

TLS termination requires a certificate and a private key. Kubernetes stores these in a `Secret` of type `kubernetes.io/tls`. The Secret must exist before the Gateway listener that references it is applied, otherwise the listener cannot be programmed.

Create the Secret from certificate and key files:

```bash
kubectl create secret tls my-tls-secret --cert=tls.crt --key=tls.key
```

If you prefer to declare it as a manifest, create the file first:

```bash
nano my-tls-secret.yaml
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-tls-secret
  namespace: default
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-certificate>
  tls.key: <base64-encoded-private-key>
```

```bash
kubectl apply -f my-tls-secret.yaml
```

Verify the Secret exists and carries the correct type:

```bash
kubectl get secret my-tls-secret
```

The `TYPE` column must read `kubernetes.io/tls`. An `Opaque` Secret with the same keys will be rejected by the Gateway controller because it enforces the type constraint.

:::info
In the simulated cluster, TLS certificates are not cryptographically validated. You can use a placeholder or self-signed certificate to test the Gateway configuration. The simulator focuses on structural correctness, not actual TLS handshake behavior.
:::

:::quiz
What Secret type must you use for a Gateway TLS listener to accept the certificate reference?

- `Opaque`
- `kubernetes.io/tls`
- `kubernetes.io/dockerconfigjson`

**Answer:** `kubernetes.io/tls`. The Gateway controller specifically checks for this type. An `Opaque` Secret containing the same `tls.crt` and `tls.key` fields will be rejected with a `ResolvedRefs: False` condition.
:::

## Configuring the HTTPS Listener

With the Secret in place, update the Gateway to add an HTTPS listener. A Gateway can have multiple listeners running concurrently, so you can serve both HTTP and HTTPS without replacing the existing HTTP listener:

```bash
nano my-gateway.yaml
```

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: my-gateway
  namespace: default
spec:
  gatewayClassName: eg
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: "*.myapp.com"
    - name: https
      protocol: HTTPS
      port: 443
      hostname: "*.myapp.com"
      tls:
        mode: Terminate
        certificateRefs:
          - name: my-tls-secret
            kind: Secret
```

The `mode: Terminate` instructs Envoy to decrypt TLS at this listener and forward plain HTTP upstream. The `certificateRefs` field points to the Secret you created. The Secret must be in the same namespace as the Gateway unless a `ReferenceGrant` explicitly allows a cross-namespace reference.

```bash
kubectl apply -f my-gateway.yaml
kubectl describe gateway my-gateway
```

In the output, look at the `Status.Listeners` section. Each listener has its own conditions. The HTTPS listener should show `ResolvedRefs: True` once the Secret is found, and `Programmed: True` once Envoy has loaded the certificate.

:::warning
If the Secret referenced in `certificateRefs` does not exist, or exists in a different namespace without a `ReferenceGrant`, the HTTPS listener will remain in state `Programmed: False` with a `ResolvedRefs: False` condition. The HTTP listener is not affected and continues to work. Only the listener that failed to resolve its certificate stops being programmed.
:::

:::quiz
You update the TLS Secret with a renewed certificate but do not restart any pods. Does Envoy pick up the new certificate automatically?

**Answer:** Yes. The Envoy Gateway controller watches Secrets for changes. When the Secret is updated, the controller detects the change and re-programs Envoy with the new certificate without any manual intervention.
:::

## Your HTTPRoute Stays Unchanged

One of the clean properties of TLS termination at the listener level is that HTTPRoute resources need no modifications. The HTTPRoute defines routing logic in terms of hostnames and paths. Whether the incoming connection arrived over HTTP or HTTPS is handled entirely at the listener level.

If you want to restrict a specific HTTPRoute to HTTPS only, add a `sectionName` to its `parentRef`:

```yaml
  parentRefs:
    - name: my-gateway
      sectionName: https
```

The `sectionName` value must match the `name` field of the listener in the Gateway spec. Without it, the HTTPRoute attaches to all listeners whose hostname matches, meaning the same route responds to both HTTP and HTTPS.

TLS termination in Gateway API requires three things to work together: a `kubernetes.io/tls` Secret holding the certificate and key, a Gateway listener configured with `mode: Terminate` pointing to that Secret, and an active controller to reconcile the configuration into Envoy. Your Pods and HTTPRoutes need no changes at all.
