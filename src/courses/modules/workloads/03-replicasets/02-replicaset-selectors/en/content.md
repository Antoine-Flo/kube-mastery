# ReplicaSet Selectors

ReplicaSets use selectors to identify which Pods they should manage.

## Pod Selector

The `.spec.selector` field is a label selector. These are the labels used to identify potential Pods to acquire. For example:

```yaml
selector:
  matchLabels:
    tier: frontend
```

## Pod Template Labels

In the ReplicaSet, `.spec.template.metadata.labels` must match `spec.selector`, or it will be rejected by the API. This ensures that Pods created by the ReplicaSet match the selector.

## Owner References

A ReplicaSet is linked to its Pods via the Pods' `metadata.ownerReferences` field, which specifies what resource the current object is owned by. All Pods acquired by a ReplicaSet have their owning ReplicaSet's identifying information within their ownerReferences field.

## Non-Template Pod Acquisitions

A ReplicaSet can acquire Pods that match its selector, even if those Pods weren't created from its template. However, this is generally not recommended as it can lead to unexpected behavior.
