# Rolling Updates

A Deployment's rollout is triggered when the Deployment's Pod template is changed.

## Rolling Update Concept

When you update a Deployment's Pod template, Kubernetes performs a rolling update:

- A new ReplicaSet is created with the updated template
- The new ReplicaSet is gradually scaled up
- The old ReplicaSet is gradually scaled down
- Pods are replaced at a controlled rate

## Update Strategy

By default, Deployments use a RollingUpdate strategy that ensures:

- At least 75% of desired Pods are up (25% max unavailable)
- At most 125% of desired Pods are up (25% max surge)

For example, with 3 replicas, you'll have at least 3 Pods available and at most 4 Pods in total during the update.

## Benefits

Rolling updates provide zero-downtime deployments by ensuring service availability throughout the update process. Old Pods are only terminated after new Pods are ready.

:::info
The rolling update strategy ensures your application remains available during updates. You can monitor the rollout progress using `kubectl rollout status deployment/<deployment-name>`.
:::
