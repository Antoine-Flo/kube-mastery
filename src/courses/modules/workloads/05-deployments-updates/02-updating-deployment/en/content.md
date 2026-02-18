# Updating a Deployment

You understand the theory behind rolling updates. Now it is time to get your hands dirty and actually update a running Deployment. Whether you are shipping a bug fix, deploying a new feature, or upgrading a dependency, the workflow is the same: change the Pod template, and let the Deployment controller handle the rest.

## The Golden Rule

Before diving into commands, commit this to memory:

**Only changes to `.spec.template` trigger a rollout.** Modifying the replica count, updating Deployment-level labels, or changing the strategy configuration — none of these create a new ReplicaSet. Only when the Pod blueprint changes does Kubernetes say "time to roll out a new version."

:::info
Think of the Pod template as your application's blueprint. The Deployment only redeploys when the blueprint itself changes — not when you adjust how many copies to print.
:::

## Three Ways to Update

Kubernetes gives you multiple paths to update a Deployment. Each has its place depending on the situation.

### Method 1: `kubectl set image`

The fastest way to change a container image. Perfect for quick updates during development or incident response. You specify the Deployment, container name, and new image — for example, `kubectl set image deployment/nginx-deployment nginx=nginx:1.16.1`. A rollout begins immediately.

### Method 2: `kubectl edit`

Opens the live Deployment object in your terminal editor, letting you modify any field. Find the `spec.template.spec.containers` section, change the `image` field, save, and close. The rollout starts as soon as you save. This method is useful when you need to change multiple template fields at once — for example, updating an image *and* adding an environment variable in the same operation.

### Method 3: Edit the manifest and `kubectl apply`

The most production-friendly approach. Update your YAML file in version control, then run `kubectl apply -f nginx-deployment.yaml`:

```yaml
spec:
  template:
    spec:
      containers:
        - name: nginx
          image: nginx:1.16.1
          ports:
            - containerPort: 80
```

This is the declarative workflow — your Git repository becomes the source of truth, and every change is tracked, reviewed, and auditable.

## What Happens Behind the Scenes

When the Pod template changes, the Deployment controller:

1. Generates a new `pod-template-hash` from the updated template.
2. Creates a **new ReplicaSet** with that hash.
3. Begins scaling the new ReplicaSet **up** and the old ReplicaSet **down**, following the rolling update strategy.
4. Continues until all Pods run the new template and the old ReplicaSet has zero replicas.

```mermaid
flowchart LR
  subgraph Before
    RS1["ReplicaSet v1<br/>3 Pods (nginx:1.14.2)"]
  end
  subgraph During
    RS1b["ReplicaSet v1<br/>1 Pod"] 
    RS2["ReplicaSet v2<br/>2 Pods (nginx:1.16.1)"]
  end
  subgraph After
    RS2b["ReplicaSet v2<br/>3 Pods (nginx:1.16.1)"]
  end
  Before --> During --> After
```

The old ReplicaSet is not deleted — it is scaled to zero and kept in the cluster history. This is what makes rollbacks possible, as you will see in a later lesson.

## Verifying the Update

After triggering a rollout, monitor its progress with `kubectl rollout status deployment/nginx-deployment`, which blocks until the rollout succeeds or fails. Run `kubectl get replicasets` to see two ReplicaSets — the new one with your desired replica count and the old one scaled to zero. Use `kubectl describe deployment nginx-deployment` to inspect the full state and event history; the Events section at the bottom shows exactly what happened during the rollout.

## Troubleshooting Failed Updates

Not every update goes smoothly. Here are the most common issues and how to address them:

**`ImagePullBackOff`** — Kubernetes cannot pull the new image. This usually means a typo in the image name or tag, or missing registry credentials. Verify the image exists and check `imagePullSecrets` if using a private registry.

**Rollout stalled** — New Pods are created but never become ready. This often points to failing readiness probes, insufficient resources, or a crash loop. Inspect the Pods directly with `kubectl describe pod` and `kubectl logs`.

**Need to revert immediately** — If the new version is broken and you need to go back, use `kubectl rollout undo` to revert to the previous ReplicaSet (covered in the rollback lesson).

:::warning
Updating multiple containers in a multi-container Pod triggers a single rollout — all containers are updated together. There is no way to roll out changes to one container independently. If you need independent update lifecycles, consider splitting containers into separate Deployments.
:::

---

## Hands-On Practice

### Step 1: Ensure a deployment exists

Create one if needed — a Deployment with nginx:1.14.2 and 3 replicas:

```bash
kubectl create deployment nginx-deployment --image=nginx:1.14.2 --replicas=3
```

**Observation:** Three Pods running nginx:1.14.2 are created.

### Step 2: Update with kubectl set image

```bash
kubectl set image deployment/nginx-deployment nginx=nginx:1.16.1
```

**Observation:** A rollout begins immediately. The Deployment controller creates a new ReplicaSet with the updated Pod template.

### Step 3: Describe the Deployment

```bash
kubectl describe deployment nginx-deployment
```

**Observation:** The Events section at the bottom shows the rollout history — which ReplicaSets were scaled up or down and when.

### Step 4: Check the Running Image

```bash
kubectl get pods -l app=nginx-deployment -o jsonpath='{.items[*].spec.containers[0].image}'
```

**Observation:** The output shows `nginx:1.16.1` for all Pods — confirming the update succeeded.

### Step 5: Clean up

```bash
kubectl delete deployment nginx-deployment
```

**Observation:** The Deployment and all its Pods are removed.

---

## Wrapping Up

Updating a Deployment means changing the Pod template — and nothing else triggers a rollout. You can update with `kubectl set image` for quick changes, `kubectl edit` for interactive modifications, or `kubectl apply` for the recommended declarative workflow. Behind the scenes, Kubernetes creates a new ReplicaSet and performs a rolling update while keeping the old ReplicaSet for potential rollback. In the next lesson, you will learn how to monitor rollout progress and interpret the status columns that tell you exactly what your Deployment is doing.
