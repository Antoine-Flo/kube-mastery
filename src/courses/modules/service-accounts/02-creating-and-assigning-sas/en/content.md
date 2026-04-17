---
seoTitle: 'Creating and Assigning Kubernetes ServiceAccounts to Pods'
seoDescription: 'Learn how to create a dedicated ServiceAccount in Kubernetes, assign it to a Pod spec, and verify the assignment. Includes a failure case for missing ServiceAccounts.'
---

# Creating and Assigning ServiceAccounts

The `default` ServiceAccount works, but every Pod in the namespace shares it. If you grant that ServiceAccount any permissions, every Pod in the namespace inherits them. That is a real security problem: a compromised Pod could abuse permissions intended for a completely different application. The fix is straightforward: create one dedicated ServiceAccount per application.

## Creating a ServiceAccount

Creating a ServiceAccount requires a single command.

```bash
kubectl create serviceaccount my-app
```

Kubernetes creates a namespaced object called `my-app` in the current namespace. It has no permissions yet. It is purely an identity. Permissions come from RBAC bindings, which are covered in the RBAC module.

Verify the ServiceAccount exists alongside the automatic `default`.

```bash
kubectl get serviceaccounts
```

You will see both `default` and `my-app` in the list. The `AGE` column on `my-app` will be just a few seconds old.

@@@
graph LR
  CMD["kubectl create serviceaccount my-app"]
  SA["ServiceAccount object\n(my-app, namespace: default)"]
  YAML["Pod spec\nserviceAccountName: my-app"]
  POD["Running Pod\n(identity: my-app)"]
  CMD --> SA
  SA --> YAML
  YAML --> POD
@@@

:::quiz
You run `kubectl create serviceaccount my-app`. What can this ServiceAccount do in the cluster immediately after creation?

**Answer:** Nothing. A ServiceAccount is an identity with no permissions attached by default. It cannot read, write, or watch any resource until a RoleBinding or ClusterRoleBinding connects it to a Role. Creating the SA is just the first step.
:::

## Assigning a ServiceAccount to a Pod

Once the ServiceAccount exists, you declare it in the Pod manifest under `spec.serviceAccountName`. Open a new file.

```bash
nano app-pod.yaml
```

Start with the basic metadata.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
  namespace: default
```

Add the `spec` block and put the ServiceAccount name first, before the containers.

```yaml
spec:
  serviceAccountName: my-app
```

Then add the container definition below it.

```yaml
  containers:
  - name: app
    image: nginx:stable
```

The complete manifest is ready to apply.

```bash
kubectl apply -f app-pod.yaml
```

After the Pod starts, inspect its stored spec to confirm the assignment was recorded correctly.

```bash
kubectl get pod app-pod -o yaml
```

Look for `spec.serviceAccountName: my-app` in the output. That field confirms the identity. You will also notice a `volumes` entry and a corresponding `volumeMounts` entry added automatically by Kubernetes. That is the projected token volume, which delivers the ServiceAccount credentials into the container filesystem. Lesson 03 explains exactly how that works.

:::quiz
After applying the manifest, which field in `kubectl get pod app-pod -o yaml` confirms the ServiceAccount assignment?

**Try it:** `kubectl get pod app-pod -o yaml`

**Answer:** The field `spec.serviceAccountName: my-app` confirms it. The presence of a projected volume mount under `spec.volumes` and `spec.containers[].volumeMounts` also confirms that the token injection is active.
:::

## What happens when the ServiceAccount does not exist

Here is the failure case you need to understand before working with ServiceAccounts in production.

```bash
nano bad-pod.yaml
```

```yaml
# bad-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: bad-pod
  namespace: default
spec:
  serviceAccountName: nonexistent-sa
  containers:
  - name: app
    image: nginx:stable
```

```bash
kubectl apply -f bad-pod.yaml
```

:::warning
The API server may accept the manifest and create the Pod object, but the Pod will never reach `Running` status. The kubelet requires the referenced ServiceAccount to exist before it can set up the token volume. The Pod stays in `Pending` with an event describing the missing ServiceAccount. Always verify that the ServiceAccount exists before applying a Pod that references it. Use `kubectl get serviceaccounts` to confirm before you apply.
:::

Check the Pod status after applying.

```bash
kubectl get pod bad-pod
```

The `STATUS` column will not show `Running`. Describe the Pod to see the events explaining why.

```bash
kubectl describe pod bad-pod
```

The events section will contain the reason. This is a common source of confusion when deploying to a new namespace where the required ServiceAccount was not yet created.

:::quiz
You apply a Pod manifest that references `serviceAccountName: nonexistent-sa`, but that SA was never created. What is the most likely outcome?

- The Pod uses the `default` ServiceAccount as a fallback
- The Pod object is created but stays in Pending because the SA is missing
- The `kubectl apply` command fails immediately with a validation error

**Answer:** The Pod object is created but stays in Pending. The API server does not validate foreign key references at admission time by default, so the manifest is accepted. It is the kubelet that cannot proceed because the token volume cannot be prepared without the SA.
:::

A dedicated ServiceAccount per application, explicitly assigned in the Pod spec, is the foundation of workload identity in Kubernetes. Now that you can create and assign ServiceAccounts, lesson 03 explains how Kubernetes delivers the actual token into the container filesystem through a projected volume.
