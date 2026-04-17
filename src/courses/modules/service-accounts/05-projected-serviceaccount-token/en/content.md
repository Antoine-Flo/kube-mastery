---
seoTitle: 'Kubernetes Projected ServiceAccount Tokens, Token Expiry, TokenRequest API'
seoDescription: 'Learn the difference between legacy Kubernetes token Secrets and modern projected ServiceAccount tokens with automatic expiry, audience binding, and kubelet rotation.'
---

# Projected ServiceAccount Tokens

In older Kubernetes versions, every ServiceAccount got a long-lived token stored in a Secret object. That token never expired. If it was stolen from a Pod or leaked in a log file, an attacker could use it indefinitely without any way to time-limit the damage. Kubernetes 1.21 changed this with **projected ServiceAccount tokens**: short-lived, audience-bound tokens that expire automatically and are rotated by the kubelet before the Pod ever sees a stale credential.

## The old approach and its problem

Before projected tokens, Kubernetes created a Secret of type `kubernetes.io/service-account-token` for every ServiceAccount automatically. This Secret held a JWT token that was valid forever. Pods received it through a volume mount, and there was no built-in rotation mechanism.

@@@
graph TB
  subgraph legacy ["Legacy flow (pre-1.21)"]
    SA1["ServiceAccount"]
    SEC["Secret\ntype: service-account-token\nnever expires"]
    POD1["Pod\n/var/run/secrets/.../token\n(static, permanent)"]
  end
  subgraph modern ["Modern flow (1.21+)"]
    SA2["ServiceAccount"]
    TRA["TokenRequest API\n(audience + expiry)"]
    POD2["Pod\n/var/run/secrets/.../token\n(expires, auto-rotated)"]
  end
  SA1 --> SEC
  SEC --> POD1
  SA2 --> TRA
  TRA --> POD2
@@@

The modern flow replaces the static Secret with a call to the TokenRequest API each time a Pod starts. The token that lands at the familiar path has a defined expiry (default one hour), is bound to a specific audience (the Kubernetes API server), and is automatically renewed by the kubelet before it expires. The Pod's application does not need to do anything. It reads the same file path as before, but the content is a short-lived credential rather than a permanent one.

:::info
The file path `/var/run/secrets/kubernetes.io/serviceaccount/token` is identical in both systems. Applications written before Kubernetes 1.21 continue to work without modification. The difference is entirely in what the token contains and how long it remains valid.
:::

Inspect a ServiceAccount to see the change.

```bash
kubectl get serviceaccount my-app -o yaml
```

In the output, notice that there is no `secrets` field listing a long-lived token Secret. That field is absent or empty in clusters using projected tokens. The token only exists when a running Pod holds it in memory as a projected volume file.

:::quiz
What is the main security improvement of projected tokens over legacy `kubernetes.io/service-account-token` Secrets?

- They are stored in a ConfigMap instead of a Secret, reducing exposure
- They expire automatically and are audience-bound, limiting the window of misuse
- They use a stronger hashing algorithm than legacy tokens

**Answer:** They expire automatically and are audience-bound. A leaked projected token stops working after its expiry (typically within an hour). A leaked legacy token required manual deletion of the Secret to revoke, and in practice that step was often missed.
:::

## Creating a token on demand

Sometimes you need a short-lived token outside of a running Pod context, for a test script or a debugging session. The `kubectl create token` command issues one directly from the TokenRequest API.

```bash
kubectl create token my-app
```

The output is a JWT string. It is valid for a short period and bound to the `my-app` ServiceAccount. You can decode the base64-encoded payload section to see the claims it contains. The `aud` claim lists the intended audience. The `exp` claim holds the Unix timestamp at which the token expires.

```bash
kubectl create token my-app
```

Now do the same for the monitoring agent ServiceAccount.

```bash
kubectl create token monitoring-agent
```

Each call produces a fresh, independently expiring token. No Secret is created. The token is not stored anywhere by Kubernetes. When the token expires, it is simply gone.

:::quiz
You want a short-lived token for the `web-app` ServiceAccount to test a script. Which command produces one without creating any persistent Kubernetes object?

**Try it:** `kubectl create token web-app`

**Answer:** `kubectl create token web-app`. This calls the TokenRequest API and returns a JWT with a built-in expiry. It does not create a Secret and does not persist anywhere in etcd. Once the token expires, there is nothing to revoke or clean up.
:::

## Customizing the projected token in a Pod spec

Kubernetes injects the projected volume automatically when you do not specify it. You can also configure the token projection explicitly in the Pod spec when you need to set a custom expiry or a specific audience. This is useful when your application authenticates to an external service that accepts Kubernetes-issued tokens.

```bash
nano projected-pod.yaml
```

Start with the metadata.

```yaml
# projected-pod.yaml - illustrative only
apiVersion: v1
kind: Pod
metadata:
  name: projected-pod
  namespace: default
```

Add the volume definition with an explicit `expirationSeconds`.

```yaml
spec:
  serviceAccountName: my-app
  volumes:
  - name: kube-api-access
    projected:
      sources:
      - serviceAccountToken:
          expirationSeconds: 3600
          path: token
```

Then add the container and its volume mount.

```yaml
  containers:
  - name: app
    image: nginx:stable
    volumeMounts:
    - name: kube-api-access
      mountPath: /var/run/secrets/kubernetes.io/serviceaccount
      readOnly: true
```

:::warning
Writing the projected volume manually is only necessary when you need to override the defaults, such as setting a custom `expirationSeconds` or an `audience` for an external workload identity use case. For normal in-cluster API access, Kubernetes injects the correct projection automatically. Do not copy this manifest pattern unless you have a specific reason to customize those fields.
:::

## Automatic rotation

The kubelet refreshes the projected token before its expiry. The application does not need to re-read the file on a schedule or implement any rotation logic. The kubelet overwrites the `token` file at the mount path with a fresh credential before the current one expires. From the application's perspective, the file always contains a valid token as long as the kubelet is healthy.

:::quiz
A projected token is mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`. The token was issued one hour ago and is about to expire. What happens next, without any action from the application?

**Answer:** The kubelet detects that the token is approaching expiry and requests a new one from the TokenRequest API. It then overwrites the token file with the fresh credential. The application continues reading the same path and always receives a valid token, without implementing any rotation logic.
:::

You now have the full picture of workload identity in Kubernetes: what a ServiceAccount is, how to create and assign one, how its credentials are delivered into the Pod through projected volumes, and how the modern token system eliminates the permanent-credential problem of earlier Kubernetes versions. The next module covers RBAC, where you will define exactly what each of these identities is allowed to do inside the cluster.
