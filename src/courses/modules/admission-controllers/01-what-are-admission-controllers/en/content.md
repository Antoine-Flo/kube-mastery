---
seoTitle: 'Kubernetes Admission Controllers, Mutating, Validating, API Pipeline'
seoDescription: 'Understand how Kubernetes admission controllers intercept API requests after auth to reject or modify objects before they are stored in etcd.'
---

# What Are Admission Controllers

A developer runs `kubectl apply -f pod.yaml`. The API server checks who they are (authentication) and whether they are allowed to create a Pod (authorization). Both checks pass. But the Pod spec has no resource limits, runs as root in a privileged container, and pulls an image from an unknown registry. Nothing in authentication or authorization catches any of that. How does the cluster stop this Pod from being stored and scheduled?

That is exactly the problem admission controllers solve.

## Where admission controllers sit

Admission controllers are plugins compiled into the kube-apiserver. They intercept every API request after authentication and authorization succeed, but before the object is written to etcd. They are the last gate before persistence.

@@@
flowchart LR
  K["kubectl apply"] --> A["API Server"]
  A --> AU["Authentication"]
  AU --> AZ["Authorization\n(RBAC)"]
  AZ --> MUT["Mutating\nAdmission"]
  MUT --> VAL["Validating\nAdmission"]
  VAL --> E["etcd"]
@@@

The pipeline always runs in this order. First every mutating controller runs, then every validating controller runs. If any validating controller rejects the request, the entire operation fails and the object is never stored.

You can see which admission plugins your cluster is running right now:

```bash
kubectl get pods -n kube-system
```

Find the kube-apiserver Pod, then inspect it:

```bash
kubectl describe pod kube-apiserver-controlplane -n kube-system
```

Look for the `--enable-admission-plugins` flag in the `Command` section of the output. That list tells you exactly which controllers are active.

## Two distinct jobs: mutate and validate

An admission controller can do two different things. A **mutating** controller modifies the object before it is stored. It might inject a default resource limit that was missing, add a label, or insert a sidecar container. The object that reaches etcd is not the same object the user submitted.

A **validating** controller can only approve or reject. It sees the object after all mutations have been applied, but it cannot change anything. If it does not like what it sees, it returns a rejection with a reason.

:::quiz
What is the key difference between a mutating and a validating admission controller?

**Answer:** A mutating controller can change the object before it is stored, for example injecting a sidecar or setting default values. A validating controller can only approve or reject. It cannot change anything. Mutating runs first, so validating always sees the final, patched version of the object.
:::

## Built-in controllers worth knowing

Kubernetes ships with dozens of admission controllers. A few appear constantly in CKA scenarios and production clusters.

`LimitRanger` watches for Pods and containers that declare no resource requests or limits. When it finds one, it injects the defaults defined in a `LimitRange` object in the same namespace. Without `LimitRanger`, a Pod with no limits could consume all memory on a node.

`ResourceQuota` checks that creating or updating a resource does not exceed the quota defined in the namespace. If a namespace has a quota of 10 CPUs and a new Pod would push it to 11, `ResourceQuota` rejects the request before anything reaches etcd.

`NamespaceLifecycle` prevents resources from being created in a namespace that is currently terminating. Without it, a race condition could let new objects slip into a namespace that the garbage collector is trying to clean up.

`PodSecurity` enforces Pod Security Standards at the namespace level. A namespace can be labelled with a profile (baseline, restricted) and `PodSecurity` rejects any Pod that does not conform. The next module covers this in full.

```bash
kubectl get namespaces
```

Labels on namespaces are how `PodSecurity` and other controllers know which policy to apply. You can inspect them:

```bash
kubectl describe namespace default
```

@@@
flowchart TB
  PR["Pod spec submitted"] --> LR["LimitRanger\ninjects default limits"]
  LR --> RQ["ResourceQuota\nchecks namespace quota"]
  RQ --> NL["NamespaceLifecycle\nchecks namespace state"]
  NL --> PS["PodSecurity\nchecks security profile"]
  PS --> OK["stored in etcd"]
  RQ -- "quota exceeded" --> REJ["rejected"]
@@@

:::warning
Not all admission controllers are enabled by default. The set of active controllers depends on the Kubernetes version and how the cluster was bootstrapped. Never assume a controller is running without verifying it in the API server flags. The next lesson shows how to check and change that list.
:::

:::quiz
A Pod is submitted with no resource limits. Which built-in admission controller injects default limits, and what must already exist in the namespace for it to do so?

**Try it:** `kubectl describe namespace default`

**Answer:** `LimitRanger` injects defaults. It reads them from a `LimitRange` object in the same namespace. If no `LimitRange` exists, `LimitRanger` has no defaults to inject and does nothing, even if the plugin is enabled.
:::

Admission controllers are the enforcement layer between a valid API request and persisted cluster state. You now understand where they sit in the pipeline, what mutating and validating mean, and which built-in controllers matter most for CKA preparation. The next lesson shows how to enable and disable these controllers by editing the kube-apiserver configuration, and how to inspect the current active set on any cluster.
