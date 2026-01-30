# Restart Policies

The `restartPolicy` field in a Pod's spec determines how Kubernetes reacts to containers exiting.

## Restart Policy Values

The `restartPolicy` for a Pod applies to app containers and regular init containers. Possible values:

- **Always**: Automatically restarts the container after any termination. This is the default value.

- **OnFailure**: Only restarts the container if it exits with an error (non-zero exit status).

- **Never**: Does not automatically restart the terminated container.

## How Restart Works

When the kubelet handles container restarts, it applies an exponential backoff delay (10s, 20s, 40s, …), capped at 300 seconds (5 minutes). Once a container has executed for 10 minutes without problems, the kubelet resets the restart backoff timer.

## Important Notes

Restart policies apply to container restarts within the same Pod on the same node. If a Pod is deleted or evicted, it won't be restarted, workload resources like Deployments handle Pod replacement.
