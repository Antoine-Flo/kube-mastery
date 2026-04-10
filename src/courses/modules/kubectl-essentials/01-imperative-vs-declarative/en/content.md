---
seoTitle: 'Imperative vs Declarative kubectl, apply vs create, run'
seoDescription: 'Understand the difference between imperative and declarative Kubernetes commands, when to use kubectl apply versus kubectl create, and why declarative wins in practice.'
---

# Imperative vs Declarative

You want to create a Pod running nginx. You have two options: type a single command and let Kubernetes handle it, or write a YAML file and tell Kubernetes to apply it. Both work. But they behave very differently over time, and understanding why is fundamental to working with Kubernetes as a team.

@@@
graph LR
    IMP["Imperative\nkubectl run / create\nOne-time order\nNo file, no history"]
    DEC["Declarative\nkubectl apply -f\nIdempotent\nFile = source of truth"]
    GIT["Git repository\n(tracks changes over time)"]
    DEC --> GIT
@@@

## The imperative approach

When you issue an imperative command, you give Kubernetes a direct order. It executes that order immediately, and then it is done. There is no file left behind, no record of what you intended, and no easy way to reproduce the same result later.

```bash
kubectl run web --image=nginx:1.28
```

This creates a Pod named `web` using the `nginx:1.28` image. Fast and convenient for a quick experiment. But if you need to create the same Pod tomorrow, on a different cluster, or share the setup with a teammate, you have nothing to hand them. You would have to remember the exact command and all its flags.

:::quiz
What does `kubectl run web --image=nginx:1.28` produce that you could hand to a colleague?
**Answer:** Nothing. Imperative commands leave no artifact. The Pod exists in the cluster, but there is no file describing how it was created. That is the core limitation of imperative workflows.
:::

## The declarative approach

With the declarative approach, you describe the desired state in a YAML file and tell Kubernetes to reconcile the cluster toward that state using `kubectl apply`. The file becomes your source of truth.

```bash
nano web-pod.yaml
```

```yaml
# illustrative only
apiVersion: v1
kind: Pod
metadata:
  name: web
spec:
  containers:
    - name: web
      image: nginx:1.28
```

```bash
kubectl apply -f web-pod.yaml
```

Think of it like the difference between calling a restaurant to dictate your order versus sending a pre-filled order form that the restaurant keeps on file and can re-execute identically. The imperative call is quicker, but the form is reproducible.


## Why `kubectl apply` is idempotent

Why does running `kubectl apply` twice on the same file not cause an error? Because `kubectl apply` sends the entire manifest to the API server, which computes a diff against the object that already exists and applies only what changed. If nothing changed, Kubernetes responds with `unchanged` and does nothing.

Run it a second time to see this in action:

```bash
kubectl apply -f web-pod.yaml
```

The output reads `pod/web unchanged`. No new Pod was created, no error was thrown. This is idempotence: the same input always produces the same result, regardless of how many times you run it.

:::warning
`kubectl create` is not idempotent. If you run `kubectl create -f web-pod.yaml` a second time, Kubernetes responds with `Error from server (AlreadyExists)`. For any workflow you plan to repeat, always prefer `kubectl apply`.
:::

:::quiz
You apply a manifest for the first time and a Pod is created. You update the image field in the file and run `kubectl apply -f web-pod.yaml` again. What happens?
- `kubectl apply` fails because the Pod already exists
- `kubectl apply` updates the Pod in place if the field is mutable, or reports an error if the field is immutable
- `kubectl apply` creates a second Pod with the updated image
**Answer:** The second option. `kubectl apply` attempts to update the existing object. For a Pod, the image field is actually immutable after creation, so Kubernetes would reject the change with a validation error. The correct workflow in that case is `kubectl delete pod web` followed by `kubectl apply -f web-pod.yaml`. For a Deployment, `kubectl apply` triggers a clean rolling update automatically.
:::

## When imperative commands are appropriate

Imperative commands have a legitimate place in your workflow: exploration, quick debugging, and one-off cleanup. If you want to spin up a temporary Pod to test network connectivity, `kubectl run` is exactly right. If you want to remove a stuck resource, `kubectl delete` is the right tool. The rule is simple: use imperative commands for things you will never need to reproduce, and declarative files for everything else.

```bash
kubectl delete pod web
```

:::quiz
Why do teams prefer the declarative approach in production environments?
**Answer:** Because YAML files can be committed to a Git repository. The desired state of the cluster becomes auditable, versioned, and reproducible. Anyone can recreate the same environment by applying the same directory of files. Imperative commands leave no trace and cannot be reviewed, rolled back, or shared in a pull request.
:::

The distinction between imperative and declarative is not just a style preference. It is the foundation of GitOps and every team workflow that values reproducibility. In the next lesson, you will learn how to read what Kubernetes knows about your resources, using `kubectl get` and `kubectl describe`.
