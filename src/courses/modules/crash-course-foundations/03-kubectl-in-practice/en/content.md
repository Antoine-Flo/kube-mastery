---
seoTitle: 'kubectl in Practice, Get, Describe, Explain, Output Formats'
seoDescription: 'Master the core kubectl commands for daily Kubernetes work: listing resources, inspecting objects, reading documentation, and formatting output.'
---

# kubectl in Practice

Every interaction with a Kubernetes cluster goes through one tool: `kubectl`. It is your primary interface for inspecting state, creating resources, and diagnosing problems. Learning to read its output fluently is more useful than memorizing any manifest field. This lesson covers the commands you will use in every session.

## The Basic Shape of a kubectl Command

Almost every `kubectl` command follows the same structure:

```bash
kubectl <verb> <resource-type> [name] [flags]
```

The verb is what you want to do: `get`, `describe`, `apply`, `delete`, `logs`, `exec`. The resource type is the kind of object: `pod`, `node`, `deployment`, `service`. The name filters to a specific object. Flags modify the output or scope.

Start by listing the nodes in your cluster:

```bash
kubectl get nodes
```

Now list all Pods across all namespaces:

```bash
kubectl get pods -A
```

The `-A` flag means "all namespaces." Without it, `kubectl get pods` only shows Pods in the `default` namespace. In a fresh cluster you may see Pods in `kube-system` that belong to the control plane components.

:::quiz
You run `kubectl get pods` and see no output. You know some Pods exist. What is the most likely cause?

- The cluster is empty
- The Pods are in a different namespace
- kubectl is not connected to the cluster

**Answer:** The Pods are in a different namespace. By default, `kubectl get` scopes to the `default` namespace. Use `-n <namespace>` to target a specific namespace, or `-A` to see all namespaces at once.
:::

## Describing Resources

`kubectl get` gives you a compact summary. `kubectl describe` gives you the full picture: status conditions, resource requests, events, and the recent history of what happened to the object.

```bash
kubectl describe node <NODE-NAME>
```

The `Events` section at the bottom of a `describe` output is often the first place to look when something is wrong. Events record what the cluster did or tried to do: scheduling decisions, image pulls, container starts, and failures.

Start a Pod so you have something to inspect:

```bash
kubectl run my-pod --image=nginx:1.28
```

Now describe it:

```bash
kubectl describe pod my-pod
```

:::quiz
Look at the output of `kubectl describe pod my-pod`. Which section tells you what the cluster actually did to start this Pod, step by step?

**Try it:** Scroll to the bottom of the describe output.

**Answer:** The `Events` section. It lists every action the cluster took: scheduling the Pod to a node, pulling the image, creating the container, and starting it. When something goes wrong, this section shows exactly where the process stopped and why.
:::

## Reading the Built-in Documentation

Every Kubernetes resource field has built-in documentation accessible from the terminal. You do not need a browser to look up what a field means.

```bash
kubectl explain pod
```

This prints a description of the Pod resource and its top-level fields. Drill deeper with dot notation:

```bash
kubectl explain pod.spec
kubectl explain pod.spec.containers
kubectl explain pod.spec.containers.resources
```

`kubectl explain` is one of the most important tools for the CKA exam. You can write an entire manifest referencing only the built-in docs, without leaving the terminal.

:::quiz
You need to find the correct field name for setting a container's environment variables in a Pod spec. Is it "env", "environment", or "envVars"?

**Try it:** `kubectl explain pod.spec.containers`

**Answer:** The field is `env`. The explain output shows it as `env <[]EnvVar>` with a description that confirms it sets environment variables for the container. Reading explain output systematically is faster than guessing field names.
:::

## Output Formats

The default `kubectl get` output is a human-readable table. For scripting or deeper inspection, you can change the output format with `-o`.

Get raw JSON for a node:

```bash
kubectl get node <NODE-NAME> -o json
```

Get YAML, which is more readable and closer to what you would write in a manifest:

```bash
kubectl get node <NODE-NAME> -o yaml
```

Extract a specific field with jsonpath:

```bash
kubectl get node <NODE-NAME> -o jsonpath='{.status.nodeInfo.kubeletVersion}'
```

The jsonpath format follows the same structure as the YAML output. Use `kubectl get -o yaml` first to explore the structure, then write the jsonpath expression to extract exactly what you need.

:::warning
`kubectl get -o yaml` on a live resource includes many fields that Kubernetes added at runtime: `resourceVersion`, `uid`, `creationTimestamp`, `managedFields`. If you copy this output into a new manifest file and try to apply it, some of these fields will cause conflicts. Always strip them out or generate a clean manifest with `kubectl create --dry-run=client -o yaml` instead.
:::

## Watching Resources

Add `--watch` to any `get` command to stream live updates as objects change:

```bash
kubectl get pods --watch
```

Press Ctrl+C to stop. Watching is useful when you apply a manifest and want to see Pods transition from `Pending` to `ContainerCreating` to `Running` in real time.

```bash
kubectl get pods -A --watch
```

Now use what you know. Without looking back at the commands above, list all Deployments in the `kube-system` namespace. You have what you need.

`kubectl` is a read-evaluate-act loop that mirrors how Kubernetes itself works. You inspect current state, decide what action to take, apply it, and inspect again. The commands in this lesson are the ones you will use dozens of times per session. In the next lesson, you will learn to organize and select resources using namespaces and labels.
