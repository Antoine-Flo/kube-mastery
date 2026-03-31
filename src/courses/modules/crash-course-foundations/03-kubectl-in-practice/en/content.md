---
seoTitle: "Kubernetes kubectl in Practice: get, describe, apply"
seoDescription: "Learn how to use kubectl to inspect resources, stream logs, apply manifests, and manage your Kubernetes cluster from the command line."
---

# kubectl in Practice

`kubectl` is the command-line tool you use to interact with a Kubernetes cluster. Everything you do - creating a Deployment, inspecting a crashed Pod, streaming logs, deleting a Service - goes through this single binary. It translates your commands into HTTP calls to the API server, and formats the responses back into readable output. Knowing how to use it well is probably the most transferable skill in the entire Kubernetes ecosystem.

:::info
Every `kubectl` command is ultimately an HTTP request to the API server. The tool handles authentication, formatting, and the mechanics of the call - but the operation always goes through the same central entry point.
:::

## Getting Information

`kubectl get` is the command you'll run more than any other. It lists resources of a given type, with a concise tabular output that gives you the current state at a glance. You can ask for a single resource type, several at once, or everything in a namespace.

```bash
kubectl get pods
kubectl get deployments
kubectl get services
kubectl get nodes
kubectl get all
```

The output columns vary by resource type. For Pods, you see `READY`, `STATUS`, `RESTARTS`, and `AGE`. `READY` shows how many containers inside the Pod are passing their readiness check, in the form `running/total`. A Pod showing `1/1 Running` with 0 restarts is healthy. A Pod showing `0/1 CrashLoopBackOff` with a rising restart count is failing repeatedly and Kubernetes is backing off before retrying. These two columns tell you the health of a Pod at a glance before you need to dig deeper.

When you need more than the summary, `kubectl describe` gives you the full picture of a single resource. It includes all the fields, the current status, and most importantly the `Events` section at the bottom, which is a chronological log of what Kubernetes has done to this resource. When a Pod fails to start, the events are where you find out whether the image couldn't be pulled, the container crashed immediately on startup, or the scheduler couldn't find a suitable node.

```bash
kubectl describe pod <pod-name>
kubectl describe deployment <deployment-name>
kubectl describe node <node-name>
```

## Applying and Deleting Resources

`kubectl apply` is how you create or update resources from a manifest file. If the resource doesn't exist yet, Kubernetes creates it. If it already exists, Kubernetes computes the difference between what's in the file and what's currently stored, and applies only the changes. This idempotency is what makes `apply` safe to run repeatedly - you can run it in a CI pipeline without worrying about whether the resource already exists.

```bash
kubectl apply -f deployment.yaml
kubectl apply -f ./manifests/   # applies every YAML file in a directory
```

`kubectl delete` removes resources. You can target a resource by its name, or pass a file to delete exactly what that file describes.

```bash
kubectl delete pod <pod-name>
kubectl delete deployment my-app
kubectl delete -f deployment.yaml
```

Be careful with `delete`: it's immediate and there's no confirmation prompt. Deleting a Deployment removes the Deployment, its ReplicaSets, and all the Pods it owns in a single operation.

## Controlling the Output Format

The default tabular output is useful for a quick overview. The `-o` flag changes the format to something more detailed or machine-readable.

`-o wide` adds extra columns that don't fit in the default view, like which node a Pod is running on, or what its IP address is. `-o yaml` outputs the full resource object as YAML - this is invaluable when you want to see what Kubernetes has set on an object, including all the fields that were defaulted or populated by controllers. `-o json` gives you the same thing in JSON, useful for piping into tools like `jq`. `-o name` gives you just the resource names, which is useful in scripts.

```bash
kubectl get pods -o wide
kubectl get pod my-pod -o yaml
kubectl get pods -o name
```

The `--watch` flag (shortened to `-w`) keeps the command running and prints new lines whenever something changes. It's useful when you're waiting for a Pod to start or a rolling update to finish.

```bash
kubectl get pods --watch
```

## Filtering with Namespaces and Labels

Without a `-n` flag, `kubectl` operates in the `default` namespace. Almost every command accepts `-n <namespace>` to target a different one, and `--all-namespaces` (or `-A`) to query across all of them at once.

```bash
kubectl get pods -n kube-system
kubectl get pods -A
```

Labels are key-value pairs attached to resources, and the `-l` flag lets you filter by them. If your Pods all have a label `app=backend`, you can limit every command to just those Pods without knowing their exact names.

```bash
kubectl get pods -l app=backend
kubectl describe pods -l app=backend
kubectl delete pods -l app=backend
```

## Generating Manifests Without Applying Them

The combination `--dry-run=client -o yaml` is one of the most useful patterns in `kubectl`. It generates a valid YAML manifest without creating anything in the cluster. When you're starting a new manifest from scratch, this is far faster than writing it by hand and looking up every field name.

```bash
kubectl run my-pod --image=nginx:1.28 --dry-run=client -o yaml
kubectl create deployment web --image=nginx:1.28 --replicas=3 --dry-run=client -o yaml
```

## Hands-On Practice

**1. Get all resources in the default namespace:**

```bash
kubectl get all
```

Notice that there's already a Service named `kubernetes`. This is the Service that Pods use to reach the API server from inside the cluster.

**2. Describe that Service:**

```bash
kubectl describe service kubernetes
```

Read through the output carefully. Notice the `Endpoints` field - it points to the API server's address. The `Events` section at the bottom is empty because this Service is managed by the cluster itself and never changes.

**3. Create a Pod without writing a manifest:**

```bash
kubectl run explore-me --image=nginx:1.28
```

**4. Inspect it using each output format:**

```bash
kubectl get pod explore-me
kubectl get pod explore-me -o wide
kubectl get pod explore-me -o yaml
```

The YAML output contains far more than what you wrote. Kubernetes has filled in dozens of default values and added status fields. This is the live state of the object as stored in etcd.

**5. Read the startup events:**

```bash
kubectl describe pod explore-me
```

Scroll to the bottom and find the `Events` section. You should see the sequence `Scheduled`, `Pulling`, `Pulled`, `Created`, `Started`. If the image pull failed, the reason would appear here.

**6. Check the logs:**

```bash
kubectl logs explore-me
```

**7. Clean up:**

```bash
kubectl delete pod explore-me
```
