# Object Management

Kubernetes offers three different ways to create and manage objects. Each approach has its strengths and is suited for different situations. Think of them as different tools in your toolbox, you'll use different ones depending on what you're trying to accomplish.

:::warning
A Kubernetes object should be managed using only one technique. Mixing techniques for the same object can lead to unexpected behavior and conflicts. Once you choose a method for an object, stick with it.
:::

## Imperative Commands

**Imperative commands** let you operate directly on live objects in your cluster using simple, single-action commands. You tell Kubernetes exactly what to do right now.

```bash
kubectl create deployment nginx --image nginx
kubectl scale deployment nginx --replicas=3
kubectl delete deployment nginx
```

This approach is like giving direct instructions: "Create this now," "Scale to three," "Delete that."

**Best for**: Learning, quick experiments, or one-off tasks. It's the fastest way to get something running when you're just exploring.

**Limitations**: Commands don't leave a record of what you did. There's no configuration file to review, version control, or share with teammates. If you need to recreate something later, you'll have to remember the exact commands you ran.

:::command
To see what objects you've created, run:

```bash
kubectl get all
```

This lists all resources in the default namespace.

<a target="_blank" href="https://kubernetes.io/docs/reference/kubectl/kubectl-commands#get">Learn more</a>
:::

## Imperative Object Configuration

**Imperative object configuration** uses files (YAML or JSON) that contain complete object definitions, but you still explicitly tell kubectl what operation to perform.

```bash
kubectl create -f nginx.yaml
kubectl replace -f nginx.yaml
kubectl delete -f nginx.yaml
```

This is like having a blueprint and telling the builder: "Build this," "Replace with this," or "Tear this down."

**Best for**: Production environments where you want configuration files stored in version control. You get the benefits of having your infrastructure as code while keeping the operations explicit and predictable.

**Important consideration**: The `replace` command completely overwrites the existing object. If Kubernetes or another process has made changes to the live object (like adding an external IP to a LoadBalancer Service), those changes will be lost when you replace the object.

## Declarative Object Configuration

**Declarative object configuration** is the most powerful approach. You provide configuration files, and kubectl automatically figures out what operations are needed to make the cluster match your files.

```bash
kubectl apply -f configs/
kubectl diff -f configs/  # See what would change
```

This is like showing Kubernetes a picture of what you want and saying: "Make it look like this." Kubernetes compares the current state to your desired state and figures out the steps needed.

**Best for**: Production environments, especially when multiple people work on the same cluster. It works great with directories of files and automatically handles create, update, and delete operations per object.

**Key advantage**: Declarative configuration preserves changes made directly to live objects, even if those changes aren't in your configuration files. This is useful when Kubernetes automatically updates fields (like Service endpoints) or when you need to make quick fixes.

:::info
Declarative configuration uses the `patch` API operation, which only updates the differences between your desired state and the current state. This means changes made by other processes or by Kubernetes itself are preserved, making it safer for collaborative environments.
:::

:::command
Before applying changes, you can preview them with:

```bash
kubectl diff -f <file>
```

Replace `<file>` with your YAML file path to see what would change without making modifications.

<a target="_blank" href="https://kubernetes.io/docs/reference/kubectl/kubectl-commands#diff">Learn more</a>
:::

## Choosing the Right Approach

Here's a simple guide:

- **Learning or quick tests**: Use imperative commands
- **Simple production setup**: Use imperative object configuration
- **Complex production or team environments**: Use declarative object configuration

Most production teams eventually migrate to declarative configuration because it provides the best balance of safety, collaboration, and automation. It's like the difference between manually driving a car versus using cruise control, both work, but one is better for long journeys.
