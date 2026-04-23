---
seoTitle: 'Kubernetes Token Projection, Automount, ServiceAccount Credentials'
seoDescription: 'Learn how Kubernetes injects ServiceAccount tokens into Pods as projected volumes, the three files every Pod receives, and when to disable automounting for least-privilege workloads.'
---

# Token Projection and Automount

You know that Pods authenticate using ServiceAccounts. But how does the token actually get into the Pod? It is not injected by magic. Kubernetes mounts it as a set of files inside every container's filesystem, automatically, every time a Pod starts with a ServiceAccount assigned.

## What Kubernetes injects

When a Pod is created with a ServiceAccount, Kubernetes automatically adds a **projected volume** to the Pod spec. That volume is mounted inside every container at a fixed path.

@@@
graph TB
  SA["ServiceAccount\n(my-app)"]
  PV["Projected Volume\n(ServiceAccount sources)"]
  MNT["Mount path\n/var/run/secrets/kubernetes.io/serviceaccount/"]
  TK["token\n(JWT credential)"]
  CA["ca.crt\n(cluster CA certificate)"]
  NS["namespace\n(namespace name)"]
  SA --> PV
  PV --> MNT
  MNT --> TK
  MNT --> CA
  MNT --> NS
@@@

Three files always appear at that mount path. The `token` file holds the JWT the container uses to authenticate to the API server. The `ca.crt` file holds the cluster's certificate authority certificate, which the container uses to verify the API server's TLS identity. The `namespace` file holds the name of the namespace the Pod runs in. Together, these three files give a container everything it needs to make authenticated API calls without any additional configuration.

Inspect a running Pod to see this in action.

```bash
kubectl get pod app-pod -o yaml
```

Scroll through the output and find the `volumes` section near the bottom. You will see an entry of type `projected` with a `serviceAccountToken` source. In the `containers` section, look for `volumeMounts`. You will find an entry mounting that projected volume at `/var/run/secrets/kubernetes.io/serviceaccount`.

:::quiz
A container inside a running Pod wants to call the Kubernetes API. Which file in the projected volume does it present to authenticate?

**Try it:** `kubectl get pod app-pod -o yaml`

**Answer:** It reads `/var/run/secrets/kubernetes.io/serviceaccount/token`. The `ca.crt` file is used alongside it to verify the server certificate during the TLS handshake, but the `token` file is the actual credential.
:::

## Describing the projected volume

The `describe` command shows the same information in a more readable form.

```bash
kubectl describe pod app-pod
```

Under the `Volumes` section, look for a volume of type `Projected`. It lists the sources: a `ServiceAccountToken` entry, a `ConfigMap` entry for the CA, and a `DownwardAPI` entry for the namespace name. This is the complete picture of what lands at that mount path.

Why does Kubernetes inject these files automatically instead of requiring the application to fetch a token itself? Because the injection makes applications portable. Any application that knows the standard path can authenticate without environment-specific configuration. The path is the same in every cluster, on every cloud, in this simulated cluster and in a real one.

:::info
The `ca.crt` file in the projected volume is the cluster's own certificate authority, not a system-wide CA. It is specific to the Kubernetes API server. Your application uses it to trust the API server's TLS certificate without relying on the system's CA bundle.
:::

## Disabling automount

Not every Pod needs to call the Kubernetes API. A Pod that serves HTTP traffic, reads from a database, and returns responses to users has no reason to carry API credentials. Leaving the token mounted in such a Pod is an unnecessary risk: if the container is ever compromised, the attacker finds a valid Kubernetes credential ready to use.

Kubernetes lets you disable the automatic token mount at the Pod level with one field.

```bash
nano no-token-pod.yaml
```

```yaml
# no-token-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: no-token-pod
  namespace: default
spec:
  serviceAccountName: my-app
  automountServiceAccountToken: false
  containers:
  - name: app
    image: nginx:stable
```

```bash
kubectl apply -f no-token-pod.yaml
```

Now describe the Pod and look at the `Volumes` section.

```bash
kubectl describe pod no-token-pod
```

:::warning
If you set `automountServiceAccountToken: false` on a Pod whose application actually needs to call the Kubernetes API, the application will fail at startup or at runtime with authentication errors. The token file will not exist at the expected path. Confirm whether your application makes API calls before disabling automount. When in doubt, check your application's documentation or source code for references to the `KUBERNETES_SERVICE_HOST` environment variable or the token file path.
:::

You can also set `automountServiceAccountToken: false` on the ServiceAccount object itself. When set there, it applies as a default for all Pods that use that SA. A Pod can override the SA-level setting by declaring its own `automountServiceAccountToken` field.

:::quiz
Why is it a good practice to set `automountServiceAccountToken: false` on Pods that never call the Kubernetes API?

**Answer:** Because the token is a valid Kubernetes credential. If a container is compromised and the token is present, an attacker can use it to interact with the API server under the Pod's ServiceAccount identity. Removing the token from Pods that have no reason to use it reduces the blast radius of any container compromise to the container itself, rather than extending it to the cluster.
:::

With token projection and automount fully understood, you are ready to apply these mechanics to realistic workload designs. Lesson 04 walks through two practical scenarios where ServiceAccount decisions have direct security consequences.
