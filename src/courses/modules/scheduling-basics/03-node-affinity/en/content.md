---
seoTitle: 'Kubernetes Node Affinity, requiredDuringScheduling, preferredDuringScheduling'
seoDescription: 'Learn how to use Kubernetes nodeAffinity with required and preferred rules, operators like In and NotIn, and how it compares to nodeSelector for flexible node targeting.'
---

# Node Affinity

`nodeSelector` works for exact label matching. But what if you want to schedule on nodes in `eu-west-1a` OR `eu-west-1b`? Or prefer nodes with SSD storage but allow HDD if no SSD is available? `nodeAffinity` provides these expressions through a richer set of operators and two scheduling modes: required and preferred.

## Two scheduling modes

`nodeAffinity` operates in two modes:

- `requiredDuringSchedulingIgnoredDuringExecution`: the Pod must be scheduled on a node that matches. If no matching node exists, the Pod stays Pending. This is equivalent to `nodeSelector` but more expressive.
- `preferredDuringSchedulingIgnoredDuringExecution`: the scheduler tries to place the Pod on a matching node but falls back to any node if none matches. This is a soft preference.

The `IgnoredDuringExecution` suffix means the rule only applies at scheduling time. If a node's labels change after a Pod is already running there, the Pod is not evicted (just as with `nodeSelector`).

## Required affinity

```bash
kubectl label node sim-worker zone=eu-west-1a
kubectl label node sim-worker2 zone=eu-west-1b
```

```bash
nano required-affinity.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: required-affinity-pod
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: zone
                operator: In
                values:
                  - eu-west-1a
                  - eu-west-1b
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
```

```bash
kubectl apply -f required-affinity.yaml
kubectl get pod required-affinity-pod -o wide
```

The Pod is scheduled on either `sim-worker` (eu-west-1a) or `sim-worker2` (eu-west-1b). Both match the `In` expression. This is impossible to express with `nodeSelector`.

## Available operators

| Operator | Description |
|---|---|
| `In` | Label value is in the list |
| `NotIn` | Label value is not in the list |
| `Exists` | Label key exists (any value) |
| `DoesNotExist` | Label key does not exist |
| `Gt` | Label value is greater than (numeric) |
| `Lt` | Label value is less than (numeric) |

:::quiz
A Pod needs to schedule on nodes that do NOT have `env=prod`. Which operator expresses this?

**Answer:** Use `NotIn` with `key: env` and `values: [prod]`. Or use `DoesNotExist` on the `env` key if you want to exclude any node labeled with `env` regardless of value. `NotIn: [prod]` still matches nodes with `env=staging` or other values.
:::

## Preferred affinity

```bash
nano preferred-affinity.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: preferred-affinity-pod
spec:
  affinity:
    nodeAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 80
          preference:
            matchExpressions:
              - key: zone
                operator: In
                values:
                  - eu-west-1a
        - weight: 20
          preference:
            matchExpressions:
              - key: zone
                operator: In
                values:
                  - eu-west-1b
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
```

```bash
kubectl apply -f preferred-affinity.yaml
kubectl get pod preferred-affinity-pod -o wide
```

The scheduler adds `weight` points for each matching preference and scores nodes accordingly. `eu-west-1a` nodes score 80 points, `eu-west-1b` nodes score 20 points. The scheduler prefers `eu-west-1a` but will use any node if none in the preferred zones are available.

@@@
graph LR
NA["nodeAffinity\npreferred: eu-west-1a weight=80\npreferred: eu-west-1b weight=20"]
N1["sim-worker\nzone: eu-west-1a\nscore: +80"]
N2["sim-worker2\nzone: eu-west-1b\nscore: +20"]
N3["sim-worker3\nno zone label\nscore: +0"]
NA --> N1 & N2 & N3
N1 -->|"wins"| SCHED["Pod scheduled here\n(highest score)"]
@@@

:::warning
`preferredDuringScheduling` is a hint, not a guarantee. If the preferred node is full (not enough resources), the scheduler places the Pod on a less preferred node without any warning. Do not rely on preferences for hard placement requirements like data locality or GPU availability. Use `required` for those.
:::

## Combining required and preferred

You can use both modes together: a `required` rule ensures the Pod only goes to specific zones, while a `preferred` rule within that set favors certain nodes over others.

```bash
kubectl delete pod required-affinity-pod preferred-affinity-pod
kubectl label node sim-worker zone-
kubectl label node sim-worker2 zone-
```

:::quiz
A Pod has `requiredDuringScheduling` that limits scheduling to nodes with `disk=ssd`. The cluster has 3 SSD nodes: one in zone-A (weight=100 preferred) and two in zone-B (weight=10 preferred). All three are schedulable. Where does the Pod land?

**Answer:** The zone-A node wins. The scheduler first filters to only the 3 SSD nodes (required rule). Then it applies the preferred weights within that filtered set. Zone-A scores 100, zone-B nodes score 10. The Pod goes to the highest-scoring node unless resource constraints override the preference.
:::

Node affinity extends `nodeSelector` with OR conditions, negative selectors, and soft preferences. The next lesson compares taints/tolerations with node affinity to clarify which tool to use for each scenario.
