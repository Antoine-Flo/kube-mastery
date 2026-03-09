# TLS Termination with Ingress

Virtually every production web application needs HTTPS. Browsers warn users about HTTP sites, search engines penalize them, and for anything handling user data or authentication, plain HTTP is simply not acceptable. Kubernetes Ingress makes configuring HTTPS straightforward through **TLS termination**: the controller handles the secure connection with the outside world, while your backend Services keep speaking plain HTTP internally.

## What TLS Termination Means

TLS termination is the act of decrypting an incoming HTTPS connection at a specific point in your infrastructure and forwarding the decrypted traffic to the backend. In the Ingress model, the controller Pod is where TLS terminates.

```mermaid
sequenceDiagram
    participant Browser
    participant IC as Ingress Controller
    participant SVC as Backend Service
    participant Pod

    Browser->>IC: HTTPS (TLS encrypted)
    Note over IC: TLS terminates here\nCertificate validated
    IC->>SVC: HTTP (plain, internal)
    SVC->>Pod: HTTP (plain, internal)
    Pod-->>SVC: HTTP response
    SVC-->>IC: HTTP response
    IC-->>Browser: HTTPS (TLS encrypted)
```

This approach has significant advantages: your application code never has to deal with TLS, all certificate management is centralized at the Ingress layer, and since cluster-internal traffic is already within a trusted network boundary, plain HTTP inside the cluster is a widely accepted trade-off (though service meshes like Istio can encrypt internal traffic too if you need it).

## The TLS Secret

Before you can configure TLS in an Ingress, you need a Kubernetes Secret of type `kubernetes.io/tls`. This Secret holds exactly two pieces of data: the certificate (public) and the private key (private), named `tls.crt` and `tls.key`.

To create a TLS Secret from existing certificate files:

```bash
kubectl create secret tls my-tls-secret \
  --cert=cert.pem \
  --key=key.pem
```

If you want to create a self-signed certificate for testing purposes:

```bash
# Generate a self-signed certificate and key
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key \
  -out tls.crt \
  -subj "/CN=app.example.com/O=my-org"

# Create the Secret
kubectl create secret tls my-tls-secret --cert=tls.crt --key=tls.key
```

You can verify the Secret was created correctly:

```bash
kubectl get secret my-tls-secret
kubectl describe secret my-tls-secret
```

The `describe` output will show two data keys (`tls.crt` and `tls.key`) but will not reveal their values, Kubernetes keeps Secret data protected from casual inspection.

:::warning
The TLS Secret **must be in the same namespace as the Ingress resource** that references it. An Ingress in the `production` namespace cannot reference a Secret in the `default` namespace. If you need the same certificate in multiple namespaces, you must copy the Secret into each one, or use a tool like cert-manager's Certificate resource to manage this automatically.
:::

## Configuring TLS in the Ingress Manifest

Once your Secret exists, referencing it in an Ingress is a single `spec.tls` block:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
      secretName: my-tls-secret
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

The `spec.tls` block is a list, meaning you can specify multiple TLS entries, useful when your Ingress serves multiple hostnames with different certificates. Each entry has a list of `hosts` and a `secretName` pointing to the Secret containing the certificate and key. The controller automatically watches the Secret and reloads when the certificate is renewed.

## Automatic HTTP to HTTPS Redirect

Most of the time you want to ensure that any HTTP request is redirected to HTTPS. With ingress-nginx, you can enable this with an annotation:

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
```

When this annotation is set, the controller will respond to any HTTP request on port 80 with a `301 Moved Permanently` redirect to the equivalent HTTPS URL.

:::info
With ingress-nginx, when you configure TLS in the Ingress spec, `ssl-redirect` defaults to `true`. You only need to explicitly set the annotation if you want to disable the redirect (e.g., for internal tooling that uses HTTP). For most production workloads, the default is exactly what you want.
:::

## cert-manager: Automatic Certificate Management

Managing TLS certificates manually, generating them, tracking expiry dates, renewing before they expire, and updating Secrets, is tedious and error-prone. A missed renewal means users see scary certificate error pages.

**cert-manager** is a Kubernetes add-on that automates the entire certificate lifecycle. It integrates with Let's Encrypt (free, publicly trusted certificates) and internal PKI systems. You add annotations to your Ingress resource; cert-manager handles the rest:

- Requests the certificate from the configured issuer (e.g., Let's Encrypt).
- Proves domain ownership via ACME challenge (HTTP-01 or DNS-01).
- Stores the resulting certificate in a Secret.
- Automatically renews it before expiry and updates the Secret.

The typical annotation for cert-manager with Let's Encrypt looks like this:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
```

And you add a `tls` block to your Ingress as normal, pointing to a Secret name that cert-manager will create:

```yaml
spec:
  tls:
    - hosts:
        - app.example.com
      secretName: app-example-com-tls
```

The Ingress controller picks up the Secret once cert-manager has populated it and starts serving HTTPS. Zero manual intervention required.

## Hands-On Practice

Let's create a TLS-terminated Ingress using a self-signed certificate.

**Step 1: Generate a self-signed TLS certificate**

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key \
  -out tls.crt \
  -subj "/CN=app.example.com/O=kube-mastery"
```

**Step 2: Create the TLS Secret**

```bash
kubectl create secret tls demo-tls-secret --cert=tls.crt --key=tls.key
```

Verify it:

```bash
kubectl get secret demo-tls-secret
```

Expected output:

```
NAME              TYPE                DATA   AGE
demo-tls-secret   kubernetes.io/tls   2      5s
```

**Step 3: Deploy a backend Service**

```bash
kubectl create deployment web --image=nginx
kubectl expose deployment web --port=80 --name=web-service
```

**Step 4: Create a TLS-enabled Ingress**

```yaml
# tls-demo-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tls-demo
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
      secretName: demo-tls-secret
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-service
                port:
                  number: 80
```

```bash
kubectl apply -f tls-demo-ingress.yaml
```

**Step 5: Get the Ingress controller IP and test HTTPS**

```bash
INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Ingress IP: $INGRESS_IP"

# Test HTTPS (--insecure because it's a self-signed cert)
curl -k -H "Host: app.example.com" https://$INGRESS_IP/
```

Expected output:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Welcome to nginx!</title>
    ...
  </head>
</html>
```

**Step 6: Verify the redirect from HTTP to HTTPS**

```bash
# Should return 308 redirect to https://
curl -v -H "Host: app.example.com" http://$INGRESS_IP/
```

Look for `Location: https://app.example.com/` in the response headers, confirming the HTTP-to-HTTPS redirect is working.

**Step 7: Inspect the certificate the controller is serving**

```bash
openssl s_client -connect $INGRESS_IP:443 -servername app.example.com -showcerts </dev/null 2>/dev/null | openssl x509 -noout -text | grep -E "Subject:|Not After"
```

This should show your certificate's subject (`CN=app.example.com`) and expiry date.

**Step 8: Clean up**

```bash
kubectl delete ingress tls-demo
kubectl delete secret demo-tls-secret
kubectl delete service web-service
kubectl delete deployment web
rm tls.crt tls.key
```
