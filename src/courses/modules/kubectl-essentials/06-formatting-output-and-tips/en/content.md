---
seoTitle: 'kubectl Output Formatting, jsonpath, custom-columns, aliases'
seoDescription: 'Learn to extract Kubernetes resource data with jsonpath, build custom tables, and speed up your workflow with aliases and tab completion.'
---

# Formatting Output and Tips

`kubectl get pods` gives you a table. It is readable, but you cannot easily extract the exact image a container is using, or sort results by creation date. This lesson covers the formatting flags that turn any `kubectl get` command into a precise data source.

@@@
graph LR
GET["kubectl get resource"]
TABLE["-o table\ndefault, human readable"]
WIDE["-o wide\nmore columns"]
YAML["-o yaml\nfull object as YAML"]
JSON["-o json\nfull object as JSON"]
JP["-o jsonpath=...\nextract one specific field"]
GET --> TABLE
GET --> WIDE
GET --> YAML
GET --> JSON
GET --> JP
@@@

Start by creating a Deployment to use throughout this lesson.

```bash
kubectl create deployment web --image=nginx:1.28 --replicas=2
kubectl get pods
```

## -o wide: more columns at a glance

The default table shows the essentials. `-o wide` adds columns like the node name, the Pod IP, and nominated node information.

```bash
kubectl get pods -o wide
```

On a real cluster this is the fastest way to see which node a Pod landed on without running a full `describe`. In the simulator, the extra columns reflect the simulated node assignment.

## -o yaml: the complete object

`-o yaml` returns the full object as the API server stores it, including fields Kubernetes computed and added automatically: the `status` block, `resourceVersion`, `uid`, `creationTimestamp`, and every default value that was filled in.

```bash
kubectl get deployment web -o yaml
```

Why is this useful? Three common reasons. First, you can verify the exact value of any field, not just the summary the table shows. Second, you can copy the output as a starting point for a similar object: strip the `status` and server-generated metadata, adjust what you need, and apply. Third, when a rollout stalls, the `status.conditions` block in the YAML output often contains the clearest explanation of why.

```bash
kubectl get deployment web -o yaml
```

Scroll down to the `status:` section and look at `conditions`. Each condition has a `type`, a `status`, and a `message`.

:::quiz What does the `availableReplicas` field in a Deployment's status represent?
**Answer:** The number of Pods matching the Deployment's selector that are currently passing their readiness checks. A Deployment with `replicas: 2` but `availableReplicas: 1` means one Pod is not yet ready, which could indicate a slow startup, a failing readiness probe, or a pending scheduling issue.
:::

## -o jsonpath: surgical field extraction

`-o yaml` returns hundreds of lines when you only need one value. `-o jsonpath` extracts exactly one field using a path expression starting with `{.}`.

```bash
kubectl get deployment web -o jsonpath='{.spec.template.spec.containers[0].image}'
```

The output is the image name, with no surrounding YAML, no table headers, nothing else. That is the point. In an exam or a debug session, finding one value in a `-o yaml` wall of text costs time. jsonpath gives you the answer in one command.

Try getting the phase of the first Pod in the namespace:

```bash
kubectl get pod -o jsonpath='{.items[0].status.phase}'
```

When the path targets a single object (not a list), skip `.items[0]` and start from the root:

```bash
kubectl get deployment web -o jsonpath='{.metadata.name}'
```

:::warning In the simulator, jsonpath is supported for common fields. If the path does not exist or the syntax is not recognized, the simulator returns an empty string with no error. On a real cluster, an invalid jsonpath expression returns an explicit error message. If your command produces empty output with no error, double-check the path for typos.
:::

:::quiz What image is the `web` Deployment currently using?
**Try it:** `kubectl get deployment web -o jsonpath='{.spec.template.spec.containers[0].image}'`
**Answer:** The output is the image string with no surrounding markup. jsonpath extracts exactly that one field. It is faster than reading all of `-o yaml` when you are looking for a single value.
:::

## --sort-by, --no-headers, --show-labels

Three minor flags that save time repeatedly.

`--sort-by` accepts a jsonpath expression and sorts the table by that field:

```bash
kubectl get pods --sort-by=.metadata.creationTimestamp
```

This lists Pods from oldest to newest. Useful when you want to know which Pod has been running longest, or which one was most recently scheduled.

`--no-headers` drops the column header line from the table output. This matters when you are scanning output programmatically on a real cluster:

```bash
kubectl get pods --no-headers
```

`--show-labels` adds a final column with all labels attached to each resource:

```bash
kubectl get pods --show-labels
```

## kubectl api-resources: discover what exists

Every type of object you can create in Kubernetes has a `kind` and an `apiVersion`. `kubectl api-resources` lists all of them.

```bash
kubectl api-resources
```

The output shows the short name (for example `po` for Pod, `deploy` for Deployment), whether the resource is namespaced, and the API group it belongs to. When you are writing a manifest and cannot remember whether to use `apps/v1` or just `v1`, this command gives you the answer without leaving the terminal.

## Desirable difficulty

Now try this on your own: get the name of the node on which the first Pod of the `web` Deployment is running. Use jsonpath. The field you need is on the Pod object, not the Deployment. Think about the path: it goes through `spec`, then a field that describes where the Pod was scheduled.

:::quiz Why is `-o jsonpath` more useful than `-o yaml` when you are looking for one specific field?
**Answer:** `-o yaml` returns the full object, potentially hundreds of lines. jsonpath extracts exactly what you need in a single command with no manual parsing. In an exam context or a fast debugging session, that difference is measured in seconds versus tens of seconds per lookup.
:::

```bash
kubectl delete deployment web
```

This module covered the essential kubectl operations: creating, reading, editing, deleting, and formatting output. These commands apply to every resource type in Kubernetes. The next module introduces namespaces, which organize all these resources into separate logical spaces and change how names and access are scoped.
