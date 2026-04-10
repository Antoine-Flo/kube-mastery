---
seoTitle: 'Kubernetes Object Model, apiVersion, kind, spec, metadata'
seoDescription: 'Understand the Kubernetes object model, how every resource is a persistent declaration in etcd, and the role of apiVersion, kind, metadata, and spec fields.'
---

# The Kubernetes Object Model

Imagine you want to deploy a web application. On a classic server, you would run a command: start the process, open the port, done. If the process crashes, it stays down until someone restarts it. Kubernetes works differently. Instead of issuing a one-time order, you write a declaration, and Kubernetes stores it permanently and keeps checking that reality matches what you wrote.

Think of it like a recipe in a cookbook that the cluster reads continuously, not a single instruction you shout at a chef. The chef executes and forgets. The cookbook is always there.

## Everything Is an Object

In Kubernetes, every resource you interact with, a Pod, a Deployment, a Service, is an **object**. An object is a structured declaration stored persistently in etcd, the cluster's database. It is not a command that fires and disappears. It is a record of intent that Kubernetes monitors and reconciles at all times.

This is why you say "I have a Deployment" and not "I ran a Deployment". The Deployment exists as a record, and Kubernetes continuously works to make the world match that record.

@@@
graph TD
    OBJ["Kubernetes Object"]
    OBJ --> AV["apiVersion\nwhich API group and version"]
    OBJ --> K["kind\nwhich resource type"]
    OBJ --> M["metadata\nname, namespace, labels"]
    OBJ --> SPEC["spec\ndesired state (you write this)"]
    OBJ --> STATUS["status\ncurrent state (Kubernetes writes this)"]
@@@

Every Kubernetes object has these five top-level fields. They are not optional. The API server will reject any manifest that is missing one of the required ones.

## The Five Top-Level Fields

**`apiVersion`** tells Kubernetes which API group and version to use to interpret the rest of the manifest. Core resources like Pods and Services use `v1`. Workload resources like Deployments use `apps/v1`. ConfigMaps use `v1`. When you are unsure which `apiVersion` to use for a given `kind`, `kubectl api-resources` lists them all.

**`kind`** names the type of resource you are declaring. `Pod`, `Deployment`, `Service`, `ConfigMap`, and so on. Combined with `apiVersion`, it uniquely identifies the schema Kubernetes will use to validate your manifest.

**`metadata`** holds identity information. The minimum required field is `name`. You can also set `namespace` to place the object in a specific namespace, `labels` to attach key-value pairs for selection and grouping, and `annotations` for non-identifying metadata.

**`spec`** is where you describe the desired state. This is the part you write and control. For a Pod, `spec` contains the list of containers and their images. For a Deployment, it contains the number of replicas and the Pod template.

**`status`** is where Kubernetes records the current observed state. You never write this field. The controllers that manage each resource type update `status` continuously based on what they observe in the cluster. When you run `kubectl get pod my-pod -o yaml`, the `status` section shows you exactly what the cluster sees right now.

Here is the minimal form of a Pod manifest to make this concrete:

```yaml
# illustrative only
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
    - name: web
      image: nginx:1.28
```

Notice that there is no `status` field here. You do not write it, Kubernetes fills it in after the object is created.

:::quiz
What is the difference between `spec` and `status` in a Kubernetes object?

- `spec` is filled by Kubernetes, `status` is written by the user
- `spec` is the desired state declared by the user, `status` is the current state observed by Kubernetes
- Both `spec` and `status` contain the desired state, but in different formats

**Answer:** `spec` is the desired state declared by the user, `status` is the current state observed by Kubernetes. The other options reverse the ownership or incorrectly describe both as containing desired state.
:::

## Why Keep Them Separate?

Why does Kubernetes store `spec` and `status` in the same object but in two distinct fields? You might wonder if it would be simpler to just have one block that shows everything.

The separation exists because each field has a different owner. You own `spec`. Kubernetes controllers own `status`. If they were merged, every time a controller updated the current state, it might accidentally overwrite something you wrote. Every time you updated your desired state, you might accidentally erase what a controller reported. The two-field separation enforces clear ownership, and that makes the reconciliation loop predictable.

:::warning
If you forget `kind` or `apiVersion` in a manifest, the API server will reject it immediately with a validation error. This is one of the most common mistakes when writing manifests by hand. The error message will tell you which field is missing, but it is easy to miss if you are copying a snippet and removing lines.
:::

:::quiz
Why does Kubernetes split desired state (`spec`) and current state (`status`) into two distinct fields rather than keeping everything in one place?

**Answer:** Because `spec` is written by the user and `status` is written by Kubernetes controllers. Merging them would create ownership conflicts where controller writes could overwrite user intent. The separation lets each party write exactly what belongs to them without interference.
:::

Once you understand that every resource is an object with these five fields, the rest of Kubernetes becomes much more readable. In the next lesson, you will look at a live manifest in full detail and trace how the reconciliation loop moves `status` toward `spec`.

