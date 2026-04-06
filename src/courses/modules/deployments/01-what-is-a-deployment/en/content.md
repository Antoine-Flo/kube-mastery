---
seoTitle: 'Kubernetes Deployments, Hierarchy, Updates, Rollback'
seoDescription: 'Learn how Kubernetes Deployments manage ReplicaSets and Pods to enable declarative updates, rolling upgrades, and instant rollback for stateless workloads.'
---

# What is a Deployment?

In the previous module you learned about ReplicaSets, and you also saw their biggest limitation: they keep a fixed number of Pods alive but have no built-in way to update those Pods safely when you change your application. That gap is precisely where Deployments come in.

A Deployment is a higher-level controller that **manages ReplicaSets** on your behalf. It doesn't create Pods directly; it creates ReplicaSets, and those ReplicaSets create the Pods. This extra layer is what enables declarative, zero-downtime updates and instant rollback. Deployments are the standard way to run stateless workloads in Kubernetes.

:::info
You interact with the Deployment; the controller chain handles ReplicaSets and Pods beneath it automatically.
:::

## The Three-Tier Hierarchy

Deployment → ReplicaSet(s) → Pods. You declare intent on the Deployment; the controller creates one ReplicaSet per distinct Pod template (you'll see how the naming works in the next lesson). ReplicaSets create and own the Pods.

@@@
graph TB
    DEP["Deployment<br/>web-app"]
    RS1["ReplicaSet v1<br/>(replicas: 0, kept)"]
    RS2["ReplicaSet v2<br/>(replicas: 3, active)"]
    P1["Pod"]
    P2["Pod"]
    P3["Pod"]

    DEP --> RS1
    DEP --> RS2
    RS2 --> P1
    RS2 --> P2
    RS2 --> P3
@@@

## What a Deployment Adds

Four things a bare ReplicaSet doesn't give you:

- **Declarative updates:** You change the desired state (image, env, etc.); the controller figures out how to get there.
- **Rolling updates:** Pods are replaced gradually; replica count never goes to zero during a routine update.
- **Rollback:** Old ReplicaSets are kept at zero replicas; rolling back is a single command.
- **Pause and resume:** You can pause a rollout to canary-test a few Pods before committing.

The next lessons cover how to create a Deployment, how to inspect the hierarchy, and how to tune the rolling strategy.

## How the Controller Works (in Short)

The Deployment controller runs in `kube-controller-manager` and continuously reconciles cluster state against the Deployment spec. The rollout pace is controlled by `spec.strategy` parameters you'll see in the next lessons.

## Why Use a Deployment (Not a Raw ReplicaSet)

For any stateless app, use a Deployment by default. Bare ReplicaSets are for building other controllers or learning; in production you almost never create one yourself.
