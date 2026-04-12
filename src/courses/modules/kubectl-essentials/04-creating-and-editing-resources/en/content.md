---
seoTitle: 'Manage Kubernetes Resources, apply, edit, patch, set image'
seoDescription: 'Learn how to create and update Kubernetes resources using kubectl apply, edit, patch, and set image for idempotent declarative workflows.'
---

# Creating and Editing Resources

You already know `kubectl apply`. But there are several other ways to create and modify resources in Kubernetes, and each follows its own logic. Knowing which one to use, and when, prevents frustrating drift between what your files say and what the cluster actually runs.

@@@
graph TD
CREATE["kubectl create\nImperative, fails if already exists"]
APPLY["kubectl apply -f\nDeclarative, idempotent, recommended"]
EDIT["kubectl edit\nOpens a live editor on the object"]
PATCH["kubectl patch\nTargeted change without an editor"]
SETIMG["kubectl set image\nChanges a container image specifically"]

    CREATE -->|"one-shot creation"| APPLY
    EDIT -->|"live edit"| PATCH
    PATCH -->|"targeted update"| SETIMG

@@@

## kubectl apply: the declarative foundation

`kubectl apply -f` is the main command for declarative workflows. It creates the resource if it does not exist, and updates it if it does. The API server calculates the difference between what you submit and what is currently stored, then applies only the changes.

```bash
nano web-deployment.yaml
```

```yaml
# illustrative only
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.28
```

```bash
kubectl apply -f web-deployment.yaml
kubectl get deployment web
```

Run `kubectl apply -f` a second time without changing the file. The output says `unchanged`. That is idempotency in action: the command is safe to run repeatedly.

:::quiz What does "idempotent" mean in the context of `kubectl apply`?
**Answer:** Running the same `kubectl apply -f` command multiple times produces the same result. If the resource already matches the manifest, nothing changes. There are no duplicate creations or unexpected side effects.
:::

## kubectl create: imperative, one-shot

`kubectl create` is the imperative counterpart. It creates an object and fails with an `AlreadyExists` error if the resource is already there. That makes it unsuitable for repeated workflows, but excellent for quick one-off operations and for its specialized subcommands.

```bash
kubectl create namespace staging
kubectl create configmap app-config --from-literal=LOG_LEVEL=info
kubectl get configmap app-config
```

`kubectl create deployment` is especially useful when you want to generate a YAML template without applying it. You learned this in the yaml-and-objects module: combine `--dry-run=client` with `-o yaml` to produce a ready-to-edit manifest.

```bash
kubectl create deployment web --image=nginx:1.28 --dry-run=client -o yaml
```

Nothing is created in the simulated cluster. The output is a valid Deployment manifest you can redirect into a file, adjust, then apply.

:::quiz You want to generate a Service manifest without creating the resource. Which flag combination achieves this?

- `--skip-create -o yaml`
- `--dry-run=client -o yaml`
- `--output=yaml --simulate`
  **Answer:** `--dry-run=client -o yaml` - `--dry-run=client` tells kubectl to perform all validation locally without sending anything to the API server. Combined with `-o yaml`, it prints the manifest that would have been submitted.
  :::

## kubectl edit: direct live editing

`kubectl edit` fetches the current live state of a resource and opens it in an editor. On a real cluster this is typically `vi`. In the simulator, changes take effect immediately after you confirm.

```bash
kubectl create deployment web --image=nginx:1.28
kubectl edit deployment web
```

Why is this convenient but risky? Because `kubectl edit` modifies the live object without touching any local file. If you later run `kubectl apply -f web-deployment.yaml` with your original file, the API server will overwrite everything `kubectl edit` changed. Your file wins, and the edit-based change is silently gone.

This is why production workflows stay on `kubectl apply -f`. Interactive edits with `kubectl edit` are fine for exploration and debugging, but they should not be the primary mechanism for changing resources in a team environment.

## kubectl set image: targeted image update

`kubectl set image` changes the container image in a Deployment, DaemonSet, or Pod without opening any editor or touching a file.

```bash
kubectl set image deployment/web web=nginx:1.26
kubectl get deployment web -o yaml
```

This triggers a rolling update on the Deployment. The old ReplicaSet gradually scales down as a new one scales up with the updated image. It is practical for a quick rollout, but it has the same drawback as `kubectl edit`: your local YAML file no longer reflects what is running.

:::warning `kubectl edit` and `kubectl set image` both modify the live state of the cluster without updating your local files. After either command, your YAML file and the cluster are out of sync. In a team using version control, this is a source of confusion: a colleague who runs `kubectl apply -f` from the repository will silently revert your change. Always prefer editing the file and applying it.
:::

:::quiz You need to change the number of replicas for a production Deployment. What is the best approach?

- Use `kubectl edit deployment <name>` and change `replicas` in the editor
- Run `kubectl scale deployment <name> --replicas=5`
- Edit `replicas` in the local YAML file, then run `kubectl apply -f`
  **Answer:** Edit the YAML file and apply it. This is the only approach that keeps the file as the source of truth. `kubectl edit` and `kubectl scale` both modify the cluster without touching the file, which creates drift that future applies will silently overwrite.
  :::

:::quiz Why is `kubectl apply` idempotent but `kubectl create` is not?
**Answer:** `kubectl apply` sends the manifest to the API server, which computes the diff against the existing object and applies only what changed. If nothing changed, nothing happens. `kubectl create` is a pure creation instruction: if the object exists, it returns an error. `apply` was designed for repeatable workflows, `create` for one-shot actions.
:::

```bash
kubectl delete deployment web
kubectl delete namespace staging
kubectl delete configmap app-config
```

You now have four ways to create and modify resources, each with a clear scope. The next lesson covers the other end: how deletion works, what cascade means, and how to clean up a namespace safely.
