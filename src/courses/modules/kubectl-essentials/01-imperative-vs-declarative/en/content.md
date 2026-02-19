# Imperative vs Declarative

When you first start working with Kubernetes, one of the most fundamental concepts to grasp is not about pods or deployments — it is about *how you communicate with the cluster*. Kubernetes gives you two distinct mental models for making things happen: the **imperative** approach and the **declarative** approach. Understanding the difference between them will shape how you work with Kubernetes for everything that follows.

## The Cooking Analogy

Imagine you want someone to make you a bowl of pasta. You have two options for how to explain what you want.

The first option is to give them step-by-step instructions: "Boil two liters of water. Add a pinch of salt. Put 100 grams of spaghetti in the pot. Cook for eight minutes. Drain the water. Add tomato sauce." You are telling them *exactly what to do, and in what order*. That is the imperative approach — you describe the actions.

The second option is to hand them a recipe card and say, "Make this." The recipe card describes the finished dish — the desired outcome. The cook figures out the steps themselves. That is the declarative approach — you describe the *desired state*, and let the system figure out how to get there.

Kubernetes supports both, and each has its time and place.

## The Imperative Approach

When you use kubectl imperatively, you are issuing direct commands that take immediate effect. You are telling Kubernetes *what action to perform right now*.

```bash
# Run a pod immediately
kubectl run nginx --image=nginx

# Create a deployment
kubectl create deployment myapp --image=myapp:v1 --replicas=3

# Delete a pod
kubectl delete pod nginx
```

These commands execute instantly. Kubernetes receives the instruction, carries it out, and that is the end of the story. There is no file on disk, no record of intent — just the resulting cluster state.

The imperative style is fast and convenient. It is excellent for quick experiments when you want to see how something behaves without committing to a full configuration. It is also the style you will use most during debugging: "Let me quickly spin up a pod to test network connectivity." In certification exam scenarios, imperative commands are a huge time saver because they require less typing.

However, imperative commands have a significant weakness: they are ephemeral. If you run `kubectl create deployment myapp --image=myapp:v1` and someone asks you tomorrow "how was this deployment configured?", you have no easy answer. The command is gone. The intent is lost.

## The Declarative Approach

The declarative approach centers on YAML manifest files. Instead of telling Kubernetes what to *do*, you write a file describing what you *want*, and then tell Kubernetes to make the cluster match that description.

```bash
# Apply a manifest file — creates or updates the resource
kubectl apply -f deployment.yaml
```

A typical manifest for that same deployment looks like this:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myapp:v1
```

When you run `kubectl apply -f deployment.yaml`, Kubernetes reads your desired state, compares it to the current cluster state, and makes whatever changes are necessary to reconcile the two. If the deployment already exists with two replicas and you apply a file specifying three, Kubernetes adds one more. If nothing has changed, nothing happens.

This idempotency — the property that you can run the same command multiple times and always end up in the same state — is what makes the declarative approach so powerful for production systems.

:::info
`kubectl apply` is idempotent: running it multiple times with the same file is safe and will not create duplicate resources. This makes it the right choice for automation and CI/CD pipelines.
:::

## When to Use Each Approach

Neither approach is universally better. They complement each other.

Use the **imperative** approach when you are experimenting, debugging, or need to do something quickly and do not need a record of it. It is also the right choice during Kubernetes certification exams like CKA/CKAD, where speed matters. Quick one-off tasks — "delete that stuck pod", "scale this deployment up temporarily" — are perfect candidates.

Use the **declarative** approach for anything that matters in the long run. If you are managing production workloads, working on a team, or practicing GitOps (where your Git repository is the source of truth for your cluster), declarative manifests are essential. They are self-documenting, version-controllable, and reviewable in pull requests. If your cluster is destroyed and rebuilt, you can restore everything by re-applying your manifest files.

## The Bridge: Generating YAML from Imperative Commands

Here is one of the most useful tricks in the Kubernetes toolkit: you can use imperative commands to *generate* declarative YAML, without actually creating anything in the cluster.

The `--dry-run=client -o yaml` combination tells kubectl to simulate the command locally and print the resulting YAML instead of sending it to the API server.

```bash
# Generate a deployment YAML without creating it
kubectl create deployment myapp --image=myapp:v1 --replicas=3 --dry-run=client -o yaml

# Save it to a file
kubectl create deployment myapp --image=myapp:v1 --replicas=3 --dry-run=client -o yaml > deployment.yaml
```

This is the best of both worlds: the speed of imperative commands to scaffold the YAML, then the permanence of declarative files to store and apply. You will use this pattern constantly once you get used to it.

:::warning
`--dry-run=client` only simulates the command on your machine — it does not contact the API server to validate the manifest against the cluster. For a fuller validation, use `--dry-run=server`, which sends the request to the API server without persisting the object.
:::

## The Two Paths to the Same Destination

```mermaid
flowchart LR
    Dev([Developer])

    subgraph Imperative
        I1["kubectl run / create / delete"]
        I2["Direct API call"]
    end

    subgraph Declarative
        D1["Write manifest.yaml"]
        D2["kubectl apply -f manifest.yaml"]
        D3["API Server compares desired vs actual"]
    end

    ClusterState(["Cluster State"])

    Dev --> I1 --> I2 --> ClusterState
    Dev --> D1 --> D2 --> D3 --> ClusterState
```

Both paths ultimately change the same cluster state. The difference is in *how* you express your intent and what trail you leave behind.

## Hands-On Practice

Open the terminal on the right and try these commands against your practice cluster. You will see both approaches in action.

```bash
# --- Imperative approach ---

# Create a pod immediately
kubectl run demo-pod --image=nginx

# Check it's running
kubectl get pods

# Delete it
kubectl delete pod demo-pod

# --- Generate YAML without creating anything ---

kubectl create deployment demo-app \
  --image=nginx \
  --replicas=2 \
  --dry-run=client -o yaml

# Save the YAML to a file
kubectl create deployment demo-app \
  --image=nginx \
  --replicas=2 \
  --dry-run=client -o yaml > /tmp/demo-app.yaml

# Inspect the generated file
cat /tmp/demo-app.yaml

# --- Declarative approach ---

# Apply the manifest (creates the deployment)
kubectl apply -f /tmp/demo-app.yaml

# Apply it again — no error, no duplicate
kubectl apply -f /tmp/demo-app.yaml

# Check the deployment
kubectl get deployments

# Clean up declaratively
kubectl delete -f /tmp/demo-app.yaml
```

As you run these commands, notice how the imperative commands give you immediate feedback, while the declarative `kubectl apply` workflow keeps the manifest file as your source of truth. This is the foundation of everything you will do with Kubernetes going forward.
