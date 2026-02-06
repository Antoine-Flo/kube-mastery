# Kubernetes Objects

Kubernetes objects are persistent entities that represent the state of your cluster. Think of them as blueprints that tell Kubernetes what you want your applications to look like and how they should behave.

## What Objects Represent

Kubernetes objects describe three main aspects of your applications:

- **What's running**: Which containerized applications are running and where (on which nodes)
- **What resources they have**: CPU, memory, storage, and network access available to those applications
- **How they behave**: Policies around restart behavior, upgrades, fault tolerance, and more

Imagine you're building a house. The Kubernetes object is like the architectural plan. It specifies what rooms you want, how they should be connected, and what materials to use. Kubernetes then works as the construction crew, making sure your house matches the plan.

## Object Structure

A Kubernetes object is a "record of intent". Once you create it, Kubernetes continuously works to ensure that object exists and matches your specifications. By creating an object, you're telling Kubernetes what you want your cluster's workload to look like. This is your cluster's **desired state**.

The Kubernetes control plane reads your desired state and takes action to make it reality. If something goes wrong, like a container crashes, Kubernetes notices the difference between what you want and what actually exists, then fixes it automatically.

## Working with Objects

To create, modify, or delete Kubernetes objects, you use the Kubernetes API. When you use `kubectl` commands, the tool makes these API calls for you behind the scenes. You can also use the API directly in your own programs using client libraries.

Most often, you'll describe objects in YAML files called **manifests**. These files are like recipes that tell Kubernetes exactly what to create.

To see all objects in your cluster, try:

```bash
kubectl get all
```

This lists pods, services, and deployments in the default namespace.

## Required Fields

Every Kubernetes object manifest must include four essential fields:

- **apiVersion**: Which version of the Kubernetes API you're using to create this object (like `v1` or `apps/v1`)
- **kind**: What type of object you want to create (Pod, Deployment, Service, ConfigMap, etc.)
- **metadata**: Information that uniquely identifies the object, including a `name` (required), `UID` (auto-generated), and optionally a `namespace`
- **spec**: The desired state you want for the object, what it should look like and how it should behave

The `spec` format is different for each object type. A Pod spec describes containers and their images, while a Service spec describes how to expose Pods to the network. The Kubernetes API Reference documents the exact structure for each object type.

To see the structure of an existing object, run:

```bash
kubectl get pod <pod-name> -o yaml
```

Replace `<pod-name>` with an actual pod name to view its complete manifest with all fields.

:::info
When you create an object, Kubernetes automatically assigns it a unique identifier (UID) that never changes, even if you delete and recreate an object with the same name. This helps Kubernetes track objects throughout their lifecycle.
:::

## Example Manifest

Here's a simple example of a Pod manifest showing the required fields:

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

This manifest tells Kubernetes to create a Pod named `nginx-demo` running the nginx web server. Once you apply this with `kubectl apply -f nginx-demo.yaml`, Kubernetes will work to make it happen.
