# Imperative Commands

## The Fastest Way to Get Started

When you are learning something new, the last thing you want is to wrestle with configuration files before you see your first result. Imperative commands let you skip that step entirely. You type a single command, Kubernetes acts immediately, and you see the result in seconds. No YAML, no files, no ceremony.

Think of imperative commands as speaking directly to a waiter: "One coffee, please." You do not hand them a written order form — you just say what you want and it happens. This directness is what makes imperative commands perfect for learning, experimenting, and quick one-off tasks.

## How Imperative Commands Work

When you run an imperative command, `kubectl` translates it into an API request and sends it to the cluster immediately. The cluster state changes right away. Nothing is written to disk — no manifest file is created or updated. The command itself is the only record of what you did.

This means imperative commands are *stateless* from a file perspective. If you need to recreate the same resource later, you would have to remember (or look up) the exact command you ran. For learning and exploration, that is perfectly fine. For production systems, it is a risk — which is why teams typically graduate to declarative configuration.

:::info
Imperative commands are the best starting point when you are learning Kubernetes. They let you focus on *concepts* without getting bogged down in YAML syntax. As you gain confidence, you will naturally transition to file-based approaches.
:::

## The Tradeoff: No Paper Trail

Here is the catch with imperative commands: they leave no file behind. There is no configuration to check into version control, no manifest for a teammate to review, and no way to "diff" what changed. If you scale a Deployment with `kubectl scale` today and someone applies a manifest file tomorrow, the manifest's replica count will overwrite your change — because the file is what declarative management considers the source of truth.

:::warning
Imperative commands do not create or update manifest files. If another team member applies a declarative configuration, your imperative changes can be silently overwritten. For anything that needs to persist, use declarative management.
:::

## Common Gotchas

- **"Resource already exists":**  The object you are trying to create already exists. Delete it first with `kubectl delete`, or switch to `kubectl apply` for an update.
- **Wrong namespace:**  By default, commands target the `default` namespace. Use `-n <namespace>` to target a different one, or set a default namespace in your context.
- **Mixing with declarative:**  If you create or modify an object imperatively, and someone later runs `kubectl apply -f` with a manifest for the same object, the manifest takes precedence. Pick one approach per object.

---

## Hands-On Practice

### Step 1: Create a Deployment and Namespace

```bash
kubectl create deployment nginx --image nginx
kubectl create namespace dev
```

Both take effect immediately — no files involved.

### Step 2: Scale and Verify

```bash
kubectl scale deployment nginx --replicas=3
kubectl get deployment nginx
```

You should see three replicas listed.

### Step 3: Create a Pod and Service

```bash
kubectl run temp-pod --image nginx
kubectl expose deployment nginx --port=80
```

`kubectl run` creates a standalone Pod. `kubectl expose` creates a Service that routes traffic to the Deployment's Pods on port 80.

### Step 4: Inspect Your Resources

```bash
kubectl get all
kubectl get pods
kubectl get namespace dev
```

### Step 5: Clean Up

```bash
kubectl delete deployment nginx
kubectl delete namespace dev
kubectl delete pod temp-pod
```

Each delete sends a request to the API server. For Deployments, the delete cascades to ReplicaSets and Pods.

## Wrapping Up

Imperative commands are your fastest tool for interacting with Kubernetes. They let you create, scale, and delete resources with a single line, and they provide immediate feedback. The tradeoff is the lack of a file-based record, which makes them unsuitable as the primary approach for production systems. Use them freely while learning, and keep in mind that as your needs grow, you will want the reproducibility and collaboration that declarative configuration provides — which is exactly what the next lesson covers.
