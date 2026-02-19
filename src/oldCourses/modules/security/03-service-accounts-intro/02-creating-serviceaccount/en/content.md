# Creating a ServiceAccount

Now that you understand what ServiceAccounts are and why they matter, let's create one. The good news is that ServiceAccounts are among the simplest Kubernetes objects — no complex spec is required. Yet this simplicity is deliberate: a ServiceAccount's job is just to exist as an identity. The real power comes when you pair it with RBAC.

## Creating with YAML

Here is a minimal ServiceAccount definition. All you need is a name and a namespace:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: my-namespace
```

Apply it with `kubectl apply -f serviceaccount.yaml`, and you are done. Kubernetes handles the rest — token generation and management happen automatically when a Pod uses this ServiceAccount.

## Creating with kubectl

For quick operations, you can use the imperative command:

```bash
kubectl create serviceaccount my-app-sa -n my-namespace
```

Both approaches produce the same result. The imperative command is convenient for experimentation; the YAML approach is better for version-controlled, reproducible configurations.

## Wiring a ServiceAccount to a Pod

To use your new ServiceAccount, reference it in the Pod spec with the `serviceAccountName` field:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  namespace: my-namespace
spec:
  serviceAccountName: my-app-sa
  containers:
    - name: app
      image: myapp
```

Think of this like assigning a name badge to an employee before they start their shift. The Pod cannot start its "shift" (interact with the API) without this identity in place. If the ServiceAccount does not exist when the Pod is created, Kubernetes keeps the Pod in `Pending` status, and the events will tell you exactly what is missing.

## What Gets Mounted

When the Pod starts, Kubernetes mounts three files into each container at a well-known path:

```
/var/run/secrets/kubernetes.io/serviceaccount/
├── token      # JWT that identifies the ServiceAccount
├── ca.crt     # Cluster CA certificate for TLS verification
└── namespace  # The namespace the Pod runs in
```

Your application can read the `token` file and use it as a Bearer token when calling the Kubernetes API. Most Kubernetes client libraries (like the official Go, Python, or Java clients) detect these files automatically and handle authentication for you — no extra configuration needed.

:::info
Create a **dedicated ServiceAccount** for each application or component that needs API access. Using the `default` ServiceAccount for everything makes it harder to audit who is doing what and to apply least-privilege permissions.
:::

## Controlling Token Mounting

Sometimes a Pod does not need API access at all — a simple web server, for example. In those cases, you can disable the automatic token mount:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: no-api-access
spec:
  serviceAccountName: my-app-sa
  automountServiceAccountToken: false
  containers:
    - name: web
      image: nginx
```

Setting `automountServiceAccountToken: false` prevents the token from being mounted. This is a good practice for workloads that do not interact with the Kubernetes API — it reduces the attack surface by removing credentials that are not needed.

:::warning
A ServiceAccount by itself grants no permissions. If your Pod makes API calls and receives `403 Forbidden` responses, the next step is to create an RBAC RoleBinding that connects the ServiceAccount to a Role. We will cover this in the next lesson.
:::

---

## Hands-On Practice

### Step 1: Create a ServiceAccount

```bash
kubectl create serviceaccount my-sa -n default
```

Creates a ServiceAccount named `my-sa` in the default namespace.

### Step 2: Verify the ServiceAccount

```bash
kubectl get sa my-sa -n default
kubectl describe sa my-sa -n default
```

Confirm the ServiceAccount exists and inspect its details. The describe output shows tokens and any attached secrets.

### Step 3: Create a Pod using the ServiceAccount

Create a Pod manifest `pod-with-sa.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pod-sa
  namespace: default
spec:
  serviceAccountName: my-sa
  containers:
    - name: app
      image: nginx
```

Then apply it:

```bash
kubectl apply -f pod-with-sa.yaml
```

### Step 4: Verify the Pod uses the ServiceAccount

```bash
kubectl get pod test-pod-sa -n default -o jsonpath='{.spec.serviceAccountName}'
```

Output should be `my-sa`. Wait for the Pod to be Running before the next step.

### Step 5: Clean up

```bash
kubectl delete pod test-pod-sa -n default
kubectl delete serviceaccount my-sa -n default
```

Remove the test resources. The ServiceAccount can be deleted even if Pods used it — existing Pods keep their mounted token until they are restarted.

## Wrapping Up

Creating a ServiceAccount is straightforward — a few lines of YAML or a single `kubectl` command. The real value comes from the identity it provides: a clear, auditable answer to "who is this Pod?" that RBAC and audit logs can build upon. In the next lesson, we will connect the dots by linking ServiceAccount tokens to RBAC permissions.
