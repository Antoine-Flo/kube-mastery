---
seoTitle: Kubernetes Recommended Labels, app.kubernetes.io Convention
seoDescription: Learn the app.kubernetes.io standard label convention to make dashboards, cost tools, and deployment systems work out of the box.
---

# Recommended Labels

Three teams each label their Pods differently. One uses `app=frontend`, another uses `service=frontend`, a third uses `component=frontend`. When a monitoring tool tries to group workloads by application name, it cannot work across all three without special-casing each team's convention. Multiply that across dozens of services and the metadata layer becomes noise rather than signal.

Standard labels exist to solve exactly this problem. The Kubernetes project defines a set of recommended labels under the `app.kubernetes.io/` prefix. Kubernetes itself does not enforce them, but tools in the ecosystem, including dashboards, cost analyzers, service meshes, and deployment systems, know to read them.

## The Recommended Label Set

@@@
graph TD
APP["app.kubernetes.io/name: wordpress"]
INST["app.kubernetes.io/instance: wordpress-prod"]
COMP1["app.kubernetes.io/component: frontend"]
COMP2["app.kubernetes.io/component: database"]
APP --> INST
INST --> COMP1
INST --> COMP2
@@@

The main labels and their purpose:

`app.kubernetes.io/name` is the name of the application, such as `mysql` or `wordpress`. It identifies what the software is, independent of how many instances are running.

`app.kubernetes.io/instance` is a unique identifier for a specific deployment of the application. If you run `mysql` twice in the same cluster (once for staging, once for production), each instance gets a different value here: `mysql-staging`, `mysql-prod`.

`app.kubernetes.io/version` is the current version of the application, such as `8.0.32` or `6.4`. This is particularly useful in dashboards and for tracking rollouts.

`app.kubernetes.io/component` describes the role of this resource within the application: `frontend`, `backend`, `database`, `cache`.

`app.kubernetes.io/part-of` names the higher-level application this resource belongs to. A `mysql` Deployment that is part of a `wordpress` installation carries `part-of: wordpress`.

`app.kubernetes.io/managed-by` identifies the tool managing the resource: `helm`, `kustomize`, or `kubectl`.

## Creating a Deployment with Recommended Labels

```bash
nano wordpress-dep.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wordpress
  labels:
    app.kubernetes.io/name: wordpress
    app.kubernetes.io/instance: wordpress-prod
    app.kubernetes.io/version: '6.4'
    app.kubernetes.io/component: frontend
    app.kubernetes.io/managed-by: kubectl
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: wordpress
      app.kubernetes.io/instance: wordpress-prod
  template:
    metadata:
      labels:
        app.kubernetes.io/name: wordpress
        app.kubernetes.io/instance: wordpress-prod
        app.kubernetes.io/component: frontend
    spec:
      containers:
        - name: wordpress
          image: nginx:1.28
```

```bash
kubectl apply -f wordpress-dep.yaml
kubectl get pods --show-labels
```

Now filter using the recommended labels:

```bash
kubectl get pods -l app.kubernetes.io/component=frontend
kubectl get all -l app.kubernetes.io/instance=wordpress-prod
```

The second command returns all resource types that carry the instance label, giving you a full picture of everything that belongs to this deployment.

:::info
Labels with a `/` in the key use a **prefix** to prevent collisions between teams and tools. The part before `/` is the prefix (written in domain-style), and the part after is the name. Using `app.kubernetes.io/name` and `mycompany.com/name` simultaneously on the same object is perfectly valid: the prefixes namespace them independently. Any team can define their own prefix without colliding with the Kubernetes project or with other teams.
:::

:::quiz
You want to update the `app.kubernetes.io/version` label on a running Deployment's Pod template. Is this safe?

- No, version is in the selector, changing it would orphan running Pods
- Yes, if `version` is in `template.metadata.labels` only and not in `selector.matchLabels`, changing it triggers a rolling update without breaking the selector
- Labels in the Pod template cannot be changed once the Deployment is created

**Answer:** Yes, as long as `version` is only in `template.metadata.labels` and not in `selector.matchLabels`. Labels outside the selector are free to change. Kubernetes will roll out new Pods with the updated label and terminate the old ones. This is exactly why the manifest above puts `version` on the Deployment metadata and the Pod template, but keeps only `name` and `instance` in the selector.
:::

:::warning
Any labels you put in `selector.matchLabels` become immutable after creation. Choose your selector labels carefully. The convention is to use only `app.kubernetes.io/name` and `app.kubernetes.io/instance` in the selector. Labels like `version`, `component`, and `managed-by` belong in the template labels only, where they can be updated freely with each new rollout.
:::

Now try this on your own: filter all resources in the simulated cluster that belong to the `wordpress-prod` instance. You have already seen the flag and the label key earlier in this lesson.

:::quiz
Why does the Kubernetes project recommend a prefix like `app.kubernetes.io/` instead of short keys like `app`, `name`, or `version`?

**Answer:** Short keys collide immediately. Two teams both using `app=frontend` means the same key with potentially different semantics. Prefixed keys create an ownership namespace: `app.kubernetes.io/name` is clearly defined by the Kubernetes project, while `mycompany.com/name` is clearly your team's. Tools know which prefix to read, which removes ambiguity and makes the label scheme reliable across the entire ecosystem.
:::

## Cleanup

```bash
kubectl delete deployment wordpress
```

Labels and annotations together form the metadata layer that makes Kubernetes resources discoverable, manageable, and composable. Labels drive selection and grouping; annotations carry rich metadata for tools. The next module builds directly on this foundation: ReplicaSets use label selectors to claim and manage their Pods, and understanding selectors is what makes the rest of the workload layer readable.
