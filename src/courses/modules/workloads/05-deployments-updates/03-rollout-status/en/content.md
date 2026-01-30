# Rollout Status

You can monitor the progress of a Deployment rollout to see if it succeeds or fails.

## Checking Rollout Status

Use the rollout status command:

```bash
kubectl rollout status deployment/nginx-deployment
```

This shows the progress of the rollout in real-time. The output might look like:

```
Waiting for rollout to finish: 2 out of 3 new replicas have been updated...
deployment "nginx-deployment" successfully rolled out
```

## Deployment Status Fields

When you run `kubectl get deployments`, you see:
- **READY**: How many replicas are available (ready/desired)
- **UP-TO-DATE**: Number of replicas updated to the desired state
- **AVAILABLE**: How many replicas are available to users
- **AGE**: How long the Deployment has been running

## Rollout Completion

A Deployment is marked as complete when:
- All replicas are updated to the latest version
- All replicas are available
- No old replicas are running
