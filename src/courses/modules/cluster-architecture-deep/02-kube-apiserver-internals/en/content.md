---
seoTitle: 'kube-apiserver Internals, Admission Chain, Authentication, Authorization'
seoDescription: 'Trace every stage a Kubernetes API request passes through: authentication, authorization, admission controllers, validation, and persistence to etcd.'
---

# kube-apiserver Internals

You already know the API server is the single gateway for all cluster state. But a request does not simply arrive and get stored. Between the moment `kubectl apply` sends an HTTP request and the moment the object lands in etcd, that request passes through a pipeline of checks and transformations. Understanding this pipeline is essential for diagnosing the right class of errors on the CKA exam.

```bash
kubectl describe pod kube-apiserver-sim-control-plane -n kube-system
```

Scroll to the `Args` section. You will see the flags the API server started with: `--authorization-mode`, `--enable-admission-plugins`, `--tls-cert-file`, and others. These flags configure the pipeline you are about to trace.

## The admission chain

@@@
graph LR
REQ["Incoming request\n(kubectl apply)"]
AUTHN["Authentication\nWho are you?"]
AUTHZ["Authorization\nAre you allowed?"]
ADM["Admission controllers\nMutate and validate"]
VAL["Schema validation\nIs the object valid?"]
ETCD["etcd\nPersist the object"]
REQ --> AUTHN --> AUTHZ --> ADM --> VAL --> ETCD
@@@

Every request to the API server passes through this chain in order. A failure at any stage terminates the request and returns an error. Nothing reaches etcd until all stages have passed.

### Authentication: who are you?

The API server reads the credential from the incoming request: a client certificate, a bearer token, or an OIDC token depending on how the cluster is configured. It extracts the identity, a username and a list of groups, and passes that identity to the next stage. It does not store users. It does not create sessions. It resolves one identity per request and moves on.

If no credential is present or the credential is invalid, the API server returns `401 Unauthorized`. The request never reaches authorization.

### Authorization: are you allowed?

With an identity established, the API server checks whether that identity has permission to perform the requested action on the requested resource. This is where RBAC operates. The authorization mode is Node+RBAC by default: kubelet requests use the Node authorizer, everything else uses RBAC.

A `403 Forbidden` response means authentication succeeded but authorization failed. The identity is known, it just does not have the required Role or ClusterRole binding for this action.

:::quiz
`kubectl apply` returns a `403 Forbidden` error. What does that tell you?

- The certificate is expired or invalid
- The user is authenticated but lacks the necessary RBAC permission
- The API server is unreachable

**Answer:** The user is authenticated but lacks RBAC permission. A `401` means authentication failed. A `403` means authentication succeeded, the API server knows who you are, but you are not authorized to perform that action.
:::

### Admission controllers: mutate then validate

Admission controllers are plugins that run after authorization and before persistence. They fall into two categories: mutating and validating.

Mutating controllers run first and can modify the incoming object. The most common built-in example is `DefaultStorageClass`: when a PersistentVolumeClaim arrives without a `storageClassName`, this controller adds the cluster's default storage class before the object is stored. Your application never asked for a storage class, but the stored object has one.

Validating controllers run after mutating controllers and can reject objects but cannot modify them. `PodSecurity` is one example: it checks whether a Pod's security settings comply with the namespace's Pod Security Standard and rejects the request if they do not.

Admission webhooks extend this pipeline with external HTTP endpoints. A validating webhook can call out to your own service to approve or reject requests based on custom business logic. Mutating webhooks are the mechanism behind service mesh sidecar injection: a webhook intercepts Pod creation requests and adds the sidecar container to the spec before the Pod is stored.

:::quiz
A Pod is created without an `imagePullPolicy`. When you inspect it with `kubectl get pod -o yaml`, the field shows `IfNotPresent`. Which stage added it?

**Answer:** A mutating admission controller. Specifically, the `DefaultImagePullPolicy` behavior sets `IfNotPresent` for tags that are not `:latest`. Mutating controllers can add or change fields in the object before it reaches etcd, which is why the stored object can have fields the user never set.
:::

### Schema validation

After admission, the object is validated against its OpenAPI schema. Required fields must be present, field types must match, enum values must be from the allowed set. This is not RBAC. It is structural correctness. A request that passes authentication, authorization, and all admission controllers can still be rejected here if the manifest contains unknown fields or invalid values.

:::warning
Schema validation is strict by default for built-in types. `kubectl apply --validate=false` disables client-side validation but does not bypass server-side validation. If the API server considers a field invalid, it rejects the request regardless of the client flag.
:::

## The watch mechanism in the API server

The API server does not just store objects. It maintains a cache of recent events and exposes a watch endpoint. Every controller and every `kubectl get --watch` uses this endpoint. When a new object is persisted to etcd, the API server immediately pushes an `ADDED` event to all active watchers. Updates produce `MODIFIED` events. Deletions produce `DELETED` events.

```bash
kubectl get pods -w
```

This stream is what makes the control loop architecture fast. Controllers do not poll. They react. The latency between `kubectl apply` and the scheduler seeing a new Pod is typically measured in milliseconds.

```bash
kubectl describe pod kube-apiserver-sim-control-plane -n kube-system
```

Look at the `--watch-cache-size` flag if present. The API server caches watch events in memory so that a controller that reconnects does not have to re-read the full state from etcd. It only needs the events since its last known resource version.

Every response from the Kubernetes API includes a `resourceVersion` field. This number is a cursor into the etcd event log. Pass it back to a watch request and you receive only what changed since that point. This is the foundation of incremental synchronization across the entire system.
