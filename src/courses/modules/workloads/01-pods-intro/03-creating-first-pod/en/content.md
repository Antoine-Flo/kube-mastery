# Creating Your First Pod

Let's create your first Pod using a YAML manifest. This will help you understand how Pods are defined and how Kubernetes creates them.

## A Simple Pod Manifest

Here's a basic Pod manifest that runs the nginx web server:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
spec:
  containers:
  - name: nginx
    image: nginx:1.14.2
    ports:
    - containerPort: 80
```

This manifest tells Kubernetes to create a Pod named `nginx-pod` with a single container running the nginx web server image.

## Understanding the Fields

Let's break down each part of this manifest:

- **apiVersion: v1**: This tells Kubernetes which version of the API to use. For Pods, it's always `v1`
- **kind: Pod**: This specifies that we're creating a Pod object
- **metadata.name**: A unique name for the Pod within its namespace. This name must follow DNS naming rules (lowercase, alphanumeric, hyphens allowed)
- **spec.containers**: A list of containers to run in this Pod. Even though it's a list, we only have one container here
- **spec.containers[].name**: A name for the container (useful when you have multiple containers)
- **spec.containers[].image**: The container image to pull and run
- **spec.containers[].ports**: Optional information about which ports the container listens on (helps with service discovery)

## Creating the Pod

First, create an empty file for your manifest:

```bash
touch nginx-pod.yaml
```

Then open the file with nano:

```bash
nano nginx-pod.yaml
```

Copy the manifest above and paste it into the editor. Press `Ctrl+S` to save the file.

Now apply your manifest using kubectl:

```bash
kubectl apply -f nginx-pod.yaml
```

Kubernetes will read your manifest, validate it, and create the Pod. You should see output like:

```
pod/nginx-pod created
```

## Verifying Your Pod

After creating the Pod, you can check its status:

```bash
kubectl get pods
```

This shows all Pods in your current namespace. You should see `nginx-pod` with a status like `Running` or `ContainerCreating`. If there's an issue, the status will indicate what went wrong.

To see more details about your Pod:

```bash
kubectl describe pod nginx-pod
```

This shows comprehensive information including events, container status, and resource usage.

## What Happens When You Create a Pod

When you apply a Pod manifest, here's what Kubernetes does:

1. **Validation**: Kubernetes checks that your manifest is valid and all required fields are present
2. **Scheduling**: The scheduler finds a suitable node in your cluster to run the Pod
3. **Container creation**: The kubelet on that node pulls the container image and starts the container
4. **Status updates**: Kubernetes continuously updates the Pod's status to reflect its current state

If something goes wrong at any step, Kubernetes will update the Pod's status to show the error, and you can investigate using `kubectl describe`.

:::info
The Pod name must be unique within a namespace. If you try to create a Pod with a name that already exists, Kubernetes will reject your request. You can use different namespaces to have Pods with the same name.
:::

:::warning
While you can create Pods directly like this, it's generally recommended to use workload resources like Deployments for production applications. Deployments provide automatic scaling, rolling updates, self-healing, and other features that standalone Pods don't have. Direct Pod creation is mainly useful for learning, debugging, or one-off tasks.
:::

## Next Steps

Once your Pod is running, you've taken your first step into the world of Kubernetes workloads. In production, you'll typically use Deployments or other workload resources that manage Pods for you, but understanding how Pods work is fundamental to using Kubernetes effectively.
