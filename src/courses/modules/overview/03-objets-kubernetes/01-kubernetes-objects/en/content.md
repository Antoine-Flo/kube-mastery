# Kubernetes Objects

## Why Objects?

Up to now, you have seen Kubernetes described as an orchestrator that schedules containers, heals failures, and balances traffic. But how does it know *what* you want it to do? The answer is **objects**. Every intention you express to Kubernetes, whether it is "run this container," "expose this service," or "store this config," is recorded as an object. Objects are persistent records stored in etcd, and Kubernetes continuously works to make reality match what those records describe.

Think of objects as entries in a to-do list that never gets lost. You write down "run three copies of my web app," and Kubernetes keeps checking that list, making sure all three copies are always running. If one disappears, it creates a replacement, because the to-do item still says "three."

## What Objects Describe

Kubernetes objects capture three main aspects of your cluster:

- **What is running** — Which containerized applications are deployed and on which nodes.
- **What resources they have** — CPU, memory, storage, and network configuration.
- **How they behave** — Restart policies, update strategies, and fault-tolerance rules.

You create and change objects through the Kubernetes API. When you run a `kubectl` command or apply a YAML manifest, you are sending an API request that creates or modifies an object. The API server validates your input, stores the object in etcd, and controllers take action to bring the cluster in line with your intent.

## The Anatomy of a Manifest

Every Kubernetes object is described by a **manifest**, a YAML (or JSON) file with a consistent structure. Four fields are required in every manifest:

| Field | Purpose | Example |
|---|---|---|
| `apiVersion` | Which version of the API to use | `v1`, `apps/v1` |
| `kind` | The type of object | `Pod`, `Deployment`, `Service` |
| `metadata` | Identity: name, namespace, labels | `name: nginx-demo` |
| `spec` | The desired state you want | Containers, ports, replicas |

Here is a concrete example:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-demo
spec:
  containers:
    - name: nginx
      image: nginx:1.14.2
      ports:
        - containerPort: 80
```

This manifest says: "Create a Pod named `nginx-demo` that runs one container using the `nginx:1.14.2` image, listening on port 80." The `spec` section is where the real detail lives, and its structure varies depending on the `kind` of object. You might wonder whether you need to memorize all these fields. You do not. Kubernetes has a built-in reference you can query at any time (we will try it shortly).

```mermaid
flowchart TB
    M["YAML Manifest"] -->|"kubectl apply"| API["API Server"]
    API -->|"validates & stores"| ETCD["etcd"]
    ETCD -->|"controllers watch"| C["Controllers"]
    C -->|"create/update"| R["Running Resources"]
```

:::info
When you create an object, Kubernetes assigns it a unique **UID** that never changes. Even if you delete and recreate an object with the same name, the new one gets a different UID. The name must be unique within a namespace, but the UID is unique across the entire cluster.
:::

## Try It: Inspect an Object

Let's see objects in action. List what is in the default namespace:

```bash
kubectl get all
```

If you have a Pod running (perhaps the `test-nginx` from an earlier lesson), inspect its full manifest:

```bash
kubectl get pod test-nginx -o yaml
```

You will see the four required fields plus additional fields that Kubernetes added automatically, like `status`, `uid`, and `resourceVersion`. Do not worry about those yet; we will cover `status` in the next lesson.

You can also use `kubectl explain` to explore the structure of any object type:

```bash
kubectl explain pod.spec.containers
```

This command is like a built-in reference manual. It shows you which fields exist, what they mean, and what types they accept. Whenever you are unsure about a field, `kubectl explain` is your first stop.

## Try It: Create an Object

Apply a manifest to create a Pod:

```bash
kubectl apply -f pod.yaml
```

Then verify Kubernetes created it:

```bash
kubectl get pods
```

You should see your Pod with a status of **Running**. This confirm-and-verify cycle, *define, apply, check*, is the fundamental workflow for every Kubernetes object, regardless of type.

:::warning
Resource names must be unique within a namespace. If you try to create a Pod with a name that already exists, the API server will reject the request. Use `kubectl get pods` to check what is already running before creating new objects.
:::

## Wrapping Up

Objects are the language you use to communicate with Kubernetes. Every manifest follows the same four-field structure, `apiVersion`, `kind`, `metadata`, and `spec`, whether you are creating a Pod, a Deployment, or a Service. You describe your intent in the `spec`, and Kubernetes works to make it real. In the next lesson, you will discover how Kubernetes tracks progress toward that intent through the `spec` and `status` pattern, the feedback loop at the heart of the system.
