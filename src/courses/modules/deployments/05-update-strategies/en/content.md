---
seoTitle: 'Kubernetes Update Strategies, RollingUpdate vs Recreate'
seoDescription: 'Compare the Kubernetes Deployment update strategies RollingUpdate and Recreate, understand when to use each, and configure maxSurge and maxUnavailable for controlled rollouts.'
---

# Update Strategies

Rolling updates are the default, but they are not always the right choice. Some applications cannot run two versions at the same time: the new version changes a database schema in a way the old version cannot read. When old and new Pods run side by side, even briefly, the application breaks. Kubernetes gives you a second strategy for exactly this case.

## Two strategies

A Deployment can use one of two `strategy.type` values: `RollingUpdate` and `Recreate`.

@@@
graph LR
    subgraph rolling [RollingUpdate]
        R1["Old Pods: 3"]
        R2["Transition:\n2 old + 1 new"]
        R3["Transition:\n1 old + 2 new"]
        R4["New Pods: 3"]
        R1 --> R2 --> R3 --> R4
    end
    subgraph recreate [Recreate]
        RC1["Old Pods: 3"]
        RC2["All terminated\n(downtime window)"]
        RC3["New Pods: 3"]
        RC1 --> RC2 --> RC3
    end
@@@

`RollingUpdate` keeps the application running throughout. Old and new Pods coexist during the transition. Zero downtime, as long as both versions can operate in parallel.

`Recreate` terminates all old Pods first, then starts new ones. There is a gap where no Pods are running. Use it when old and new versions are incompatible: different database schemas, incompatible in-memory state, or any situation where running both simultaneously breaks things.

## Using Recreate

```bash
nano recreate-deployment.yaml
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: recreate-app
spec:
  replicas: 2
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: recreate
  template:
    metadata:
      labels:
        app: recreate
    spec:
      containers:
        - name: web
          image: nginx:1.28
```

```bash
kubectl apply -f recreate-deployment.yaml
```

Now trigger an update and watch the Pods:

```bash
kubectl set image deployment/recreate-app web=nginx:1.26
kubectl get pods -l app=recreate --watch
```

Watch the STATUS column. All old Pods terminate simultaneously. There is a moment when no Pods are listed. Then the new Pods start. That gap is the downtime window.

:::warning
`Recreate` always causes a downtime window. Do not use it for services where availability matters. Only choose it when the application explicitly requires it: schema migrations, single-instance systems, or state incompatibility between versions.
:::

:::quiz
You have a stateful application that stores session data in local memory. Both old and new versions cannot share those sessions. Which strategy should you use?

- RollingUpdate with maxUnavailable: 0 to keep all sessions intact
- Recreate, to terminate all old Pods before the new version starts
- RollingUpdate with maxSurge: 0 to avoid running two versions simultaneously

**Answer:** Recreate. RollingUpdate, even with `maxSurge: 0`, still runs old and new Pods simultaneously during the transition. Only Recreate guarantees zero overlap between versions, at the cost of a downtime window.
:::

## Tuning RollingUpdate for your situation

Two settings control how aggressively a rolling update proceeds. Think of them as two dials: one for safety, one for speed.

With `maxUnavailable: 0` and `maxSurge: 1`, the rollout is as safe as possible. No old Pod is terminated until a new one is fully Ready. The trade-off is one extra Pod running at the peak, which uses additional resources.

```yaml
# illustrative only
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
```

With `maxUnavailable: 2` and `maxSurge: 0`, no extra capacity is used. Each new Pod can only start after an old one is terminated. Useful on resource-constrained clusters. The trade-off is that two Pods are unavailable at once during the update.

```yaml
# illustrative only
    rollingUpdate:
      maxUnavailable: 2
      maxSurge: 0
```

The right values depend on your application's traffic sensitivity and the cluster's available capacity.

:::quiz
With `maxUnavailable: 0` and `maxSurge: 1`, how many Pods run during the update of a 4-replica Deployment?

**Answer:** 5 at the peak. `maxSurge: 1` allows one extra Pod above the desired 4. `maxUnavailable: 0` means none of the 4 running Pods can be terminated until the new one is Ready. At each step: 4 old + 1 new = 5 total Pods.
:::

```bash
kubectl delete deployment recreate-app
```

Deployments give you three things ReplicaSets cannot: rolling updates that keep your application running, rollback that is instant because old ReplicaSets are preserved, and a choice of strategy for edge cases where rolling updates are not safe. The next module covers Services, which is how you make those Pods reachable from outside the cluster or from other Pods.
