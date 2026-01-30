# Pod Phases

A Pod's `status.phase` field is a simple, high-level summary of where the Pod is in its lifecycle.

{{diagram:pod-lifecycle}}

## Pod Phase Values

The possible values for `phase` are:

- **Pending**: The Pod has been accepted by the cluster, but one or more containers has not been set up. This includes time waiting to be scheduled and time downloading container images.

- **Running**: The Pod has been bound to a node, and all containers have been created. At least one container is still running, or is in the process of starting or restarting.

- **Succeeded**: All containers in the Pod have terminated in success, and will not be restarted.

- **Failed**: All containers in the Pod have terminated, and at least one container has terminated in failure.

- **Unknown**: For some reason the state of the Pod could not be obtained, typically due to an error in communicating with the node.

## Understanding Phases

The phase is not intended to be a comprehensive rollup of container or Pod state. It's a simple indicator of the Pod's lifecycle position. Use `kubectl describe pod` to get more detailed information about a Pod's state.

:::info
The Pod phase is a high-level summary. For detailed information about container states and Pod conditions, use `kubectl describe pod <pod-name>` or check the Pod's status field.
:::
