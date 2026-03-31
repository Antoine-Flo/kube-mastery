---
seoTitle: "Kubernetes Namespaces and Labels, Isolation, Selectors"
seoDescription: "Understand how Kubernetes namespaces partition cluster resources and how labels enable flexible filtering, querying, and resource connections."
---

# Namespaces and Labels

As a cluster grows, it becomes home to many teams, many applications, and many environments. Without some way to organize all of that, everything lands in a single undifferentiated pile, and it becomes difficult to know which resources belong to which application, which are safe to delete, and which are critical. Kubernetes provides two complementary mechanisms for this: **namespaces** for hard boundaries between groups, and **labels** for flexible tagging within those groups.

:::info
Namespaces divide the cluster into isolated sections. Labels are key-value tags you attach to any resource and then use to filter, query, and connect resources together. Both are fundamental to working in a real cluster.
:::

## Namespaces

A namespace is a virtual partition inside the cluster. Resources in one namespace don't interact with resources in another by default. You can have a Service named `api` in the `staging` namespace and a completely different Service also named `api` in the `production` namespace - they coexist without conflict because they're in separate namespaces. This isolation also extends to resource quotas and access control: you can apply policies to an entire namespace, which makes it the natural boundary for separating teams or environments.

Every cluster starts with a few built-in namespaces. The `default` namespace is where resources land if you don't specify one. This is convenient for learning, but in real systems you almost never put application workloads in `default` - you create a dedicated namespace for each application or team. The `kube-system` namespace is reserved for Kubernetes internal components: CoreDNS, kube-proxy, the scheduler, and the controller manager all run as Pods here. You should never deploy your own applications into `kube-system`. The `kube-public` namespace is readable by anyone and mostly used for cluster-level public bootstrapping information.

Creating a namespace is as simple as:

```bash
kubectl create namespace my-team
```

Once it exists, you target it with every command using `-n`:

```bash
kubectl apply -f app.yaml -n my-team
kubectl get pods -n my-team
kubectl delete deployment web -n my-team
```

To see resources across all namespaces without specifying one at a time, use `-A`:

```bash
kubectl get pods -A
```

:::warning
`kubectl delete namespace my-team` deletes the namespace and every single resource inside it - Pods, Deployments, Services, ConfigMaps, Secrets. There is no undo and no confirmation prompt. Be careful with this command on shared clusters where others may be relying on what's inside.
:::

Not every Kubernetes resource is namespaced. Nodes, PersistentVolumes, and ClusterRoles exist at the cluster level - they don't belong to any namespace. If you're ever unsure which category a resource falls into, you can ask:

```bash
kubectl api-resources --namespaced=true
kubectl api-resources --namespaced=false
```

## Labels

A label is a key-value pair you attach to a Kubernetes resource. Labels are completely arbitrary - Kubernetes doesn't give them any inherent meaning. Their power comes from the fact that other resources can use **label selectors** to find and act on resources that have specific labels. This is the mechanism that connects a Service to its Pods, a ReplicaSet to the Pods it owns, and a Deployment to the ReplicaSet it manages.

```yaml
metadata:
  labels:
    app: web
    env: production
    version: v2
```

You add labels to resources in your manifest, or you can add or change them on a running resource imperatively:

```bash
kubectl label pod my-pod environment=staging
```

The `-l` flag lets you filter any `kubectl` command by label. If all your backend Pods have `app=backend`, you can scope every command to them without knowing individual names:

```bash
kubectl get pods -l app=backend
kubectl logs -l app=backend
kubectl delete pods -l app=backend
```

Beyond `kubectl` filtering, labels are load-bearing. When you write a Service with a `selector: app: web`, Kubernetes finds every Pod in the same namespace that has `app: web` in its labels and routes traffic to them. If a Pod is missing that label, the Service never sends traffic to it - even if it's running the right container image. If a Pod gains that label, it immediately starts receiving traffic. Understanding this selector mechanism is essential because it's how the entire control plane wires resources together.

### Annotations

Annotations are a related concept: they're also key-value pairs attached to resources, but they are not used for selection. You can't filter by annotations with `-l`. Annotations are for metadata that tools and operators need to read, but that shouldn't influence how resources are grouped. Common uses include recording when something was deployed, who owns it, or attaching configuration consumed by third-party tools.

```yaml
metadata:
  annotations:
    owner: 'platform-team'
    last-reviewed: '2025-01-15'
```

## Hands-On Practice

**1. Create a namespace:**

```bash
kubectl create namespace crash-lab
```

**2. Deploy a Pod into that namespace:**

Paste the command in the terminal and open the visualizer before running it to see the Pod being created. It's the telescope icon in the bottom right corner.

```bash
kubectl run web --image=nginx:1.28 -n crash-lab
```

**3. Confirm it's isolated from the default namespace:**

```bash
kubectl get pods
kubectl get pods -n crash-lab
```

The first command shows nothing (or whatever was already in `default`). The second shows the Pod you just created. The two are completely separate.

**4. Add labels to the running Pod:**

```bash
kubectl label pod web tier=frontend -n crash-lab
kubectl label pod web env=learning -n crash-lab
```

**5. Check the labels:**

```bash
kubectl get pod web -n crash-lab --show-labels
```

You should see both labels listed in the `LABELS` column.

**6. Filter by label:**

```bash
kubectl get pods -n crash-lab -l tier=frontend
kubectl get pods -n crash-lab -l tier=backend
```

The first command returns your Pod. The second returns nothing - no Pod in this namespace has `tier=backend`.

**7. Remove a label:**

```bash
kubectl label pod web env- -n crash-lab
```

The trailing `-` after the key name removes that label. Run `--show-labels` again to confirm it's gone.

**8. Clean up:**

```bash
kubectl delete namespace crash-lab
```

The namespace, and the Pod inside it, are both removed.
