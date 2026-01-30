# Rollback Basics

Sometimes you may want to rollback a Deployment to a previous revision.

## Checking Rollout History

First, check the rollout history:

```bash
kubectl rollout history deployment/nginx-deployment
```

This shows all revisions of the Deployment. Each time the Pod template changes, a new revision is created.

## Rolling Back

To rollback to the previous revision:

```bash
kubectl rollout undo deployment/nginx-deployment
```

To rollback to a specific revision:

```bash
kubectl rollout undo deployment/nginx-deployment --to-revision=2
```

## How Rollback Works

When you rollback, Kubernetes:
- Creates a new ReplicaSet based on the previous revision
- Performs a rolling update to replace current Pods with Pods from the previous revision
- Updates the Deployment's revision number

Rollback is useful when a new version has issues and you need to quickly revert to a known-good state.
