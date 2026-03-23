# Label Selectors

Labels would be little more than decorative metadata without a way to query them. Label selectors are the query language of Kubernetes, the mechanism that turns static key-value pairs into a dynamic, filterable, connectable system. Wherever you see one Kubernetes object pointing at another, a label selector is almost certainly doing the work behind the scenes.

:::info
There are two families of selectors: **equality-based** (direct value comparison) and **set-based** (match against a set of possible values). Different parts of the Kubernetes API support one or both families.
:::

## Equality-Based Selectors

Equality-based selectors are the simpler form. They compare the value of a label key directly:

- `key=value` or `key==value`, matches objects where the key exists and its value equals the given string.
- `key!=value`, matches objects where the key does not exist, or its value is anything other than the given string.

You'll use these directly in `kubectl` with the `-l` flag, and you'll see them in Service and NetworkPolicy manifests:

```bash
kubectl get pods -l env=production
kubectl get pods -l env!=staging
kubectl get pods -l app=web,env=production
```

When you list multiple expressions separated by commas, they form an **AND**, the object must satisfy every condition. There is no built-in OR at this syntax level.

Services use equality-based selectors in their `.spec.selector` field:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-svc
spec:
  selector:
    app: web
    env: production
  ports:
    - port: 80
      targetPort: 8080
```

This Service routes traffic to any Pod that simultaneously carries `app=web` AND `env=production`. A Pod with only one of those labels is ignored.

## Set-Based Selectors

Set-based selectors are more expressive. They let you match against a set of possible values and can test for the mere existence of a key:

- `key in (v1, v2)`, matches objects where the key's value is one of the listed values.
- `key notin (v1, v2)`, matches objects where the key doesn't exist, or its value is not in the list.
- `key`, matches objects where the key exists (any value).
- `!key`, matches objects where the key does not exist at all.

```bash
# Pods in either staging or production
kubectl get pods -l "env in (staging,production)"

# Pods that are NOT canary builds
kubectl get pods -l "track notin (canary)"

# Any Pod that has a 'version' label at all
kubectl get pods -l version

# Pods with no 'version' label
kubectl get pods -l '!version'
```

:::info
When using set-based selectors on the command line, wrap the expression in quotes to prevent your shell from misinterpreting the parentheses.
:::

## `matchLabels` and `matchExpressions` in Specs

Deployments, ReplicaSets, and StatefulSets need to identify which Pods they own. They express this in their `.spec.selector` field, which supports both selector families through two sub-fields.

`matchLabels` is a shorthand for equality-based selectors, each key-value pair is treated as `key=value`:

```yaml
selector:
  matchLabels:
    app: web
    env: production
```

`matchExpressions` is an array of set-based rules. Each entry has a `key`, an `operator` (`In`, `NotIn`, `Exists`, or `DoesNotExist`), and an optional `values` list:

```yaml
selector:
  matchExpressions:
    - key: env
      operator: In
      values:
        - staging
        - production
    - key: track
      operator: NotIn
      values:
        - canary
    - key: app
      operator: Exists
```

You can combine both fields in the same selector, an object must satisfy all `matchLabels` entries AND all `matchExpressions` entries.

:::warning
The `spec.selector` of a Deployment or ReplicaSet is **immutable** after creation. If you need to change the selector, you must delete the resource and recreate it. Attempting to patch the selector will be rejected by the API server.
:::

## How Services Build Their Endpoints List

When you create a Service with a selector, Kubernetes starts a continuous watch. Every time a Pod is created, updated, or deleted, the Endpoints controller re-evaluates which Pods match the selector. The resulting list of IP addresses and ports becomes the Service's Endpoints object, and that's what kube-proxy uses to forward traffic.

```mermaid
graph LR
    Client([Client]) --> SVC["Service<br/>selector: app=web"]
    SVC --> EP["Endpoints<br/>10.0.0.5:8080<br/>10.0.0.6:8080<br/>10.0.0.7:8080"]
    EP --> P1["Pod<br/>app=web<br/>10.0.0.5"]
    EP --> P2["Pod<br/>app=web<br/>10.0.0.6"]
    EP --> P3["Pod<br/>app=web<br/>10.0.0.7"]
    SVC -.-|no match| P4["Pod<br/>app=api"]
```

The design is entirely dynamic: scale from 3 Pods to 10 and the Endpoints list grows automatically. A Pod crashes and within seconds it's removed from the list. The Service itself never changes, only its backing Endpoints do.

## The Most Common Pitfall: Selector Mismatch

The single most frequent mistake with label selectors is a mismatch between the selector and the actual labels on the Pods. This is especially easy to get wrong in Deployment manifests, where labels must be defined in two places: `.spec.selector` and `.spec.template.metadata.labels`.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web # <-- must match the template labels below
  template:
    metadata:
      labels:
        app: web # <-- must match the selector above
    spec:
      containers:
        - name: nginx
          image: nginx:1.28
```

If the selector says `app: web` but the template labels say `app: webapp`, the Deployment will fail validation. For Services, there's no such validation: the Service will be created successfully, but its Endpoints list will be empty and no traffic will ever reach your Pods, a maddening situation where everything exists but requests simply time out.

:::warning
If a Service returns connection timeouts and the Pods are running, the first thing to check is whether the selector matches the actual Pod labels. Run `kubectl describe service <name>` and look at the `Endpoints:` line, if it shows `<none>`, the selector isn't matching anything.
:::

:::info
Kubernetes label selectors only support AND logic natively, there is no OR operator. To select Pods from "team A or team B", either give both a shared label (like `division: engineering`) or use a set-based `In` expression: `team in (team-a, team-b)`.
:::

## Hands-On Practice

Open the terminal and work through these exercises to see selectors in action.

**1. Create Pods with varied labels**

```bash
kubectl run web-prod --image=nginx:1.28 --labels="app=web,env=prod,track=stable"
kubectl run web-staging --image=nginx:1.28 --labels="app=web,env=staging,track=stable"
kubectl run api-prod --image=nginx:1.28 --labels="app=api,env=prod,track=stable"
kubectl run web-canary --image=nginx:1.28 --labels="app=web,env=prod,track=canary"
```

**2. Practice equality-based selectors**

```bash
kubectl get pods -l app=web
kubectl get pods -l env=prod
kubectl get pods -l app=web,env=prod
```

**3. Practice set-based selectors**

```bash
kubectl get pods -l "env in (staging,prod)"
kubectl get pods -l "track notin (canary)"
kubectl get pods -l "track notin (canary),app=web"
```

**4. Create a Service and inspect its Endpoints**

```bash
kubectl expose pod web-prod --name=web-svc --port=80 --selector="app=web,env=prod,track=stable"
kubectl describe service web-svc
# Look at the Endpoints line, it should list the IPs of matching Pods
kubectl get endpoints web-svc
```

**5. Deliberately break the selector and observe empty Endpoints**

```bash
kubectl delete service web-svc
kubectl expose pod web-prod --name=web-svc --port=80 --selector="app=doesnotexist"
kubectl get endpoints web-svc
# Endpoints should show <none>
```

**6. Clean up**

```bash
kubectl delete pod web-prod web-staging api-prod web-canary
kubectl delete service web-svc
```

## Wrapping Up

Label selectors are how Kubernetes objects find and connect to one another. Equality-based selectors handle simple matching; set-based selectors add flexibility for ranges and existence checks. All conditions combine with AND logic. When something isn't connecting, a Service with no traffic, a Deployment stuck at 0 replicas, the selector is the first place to look.
