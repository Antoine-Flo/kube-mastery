# Pod Conditions

A Pod has a PodStatus with an array of PodConditions through which the Pod has or has not passed.

## Common Pod Conditions

The kubelet manages the following PodConditions:

- **PodScheduled**: The Pod has been scheduled to a node.

- **PodReadyToStartContainers**: The Pod sandbox has been successfully created and networking configured.

- **ContainersReady**: All containers in the Pod are ready.

- **Initialized**: All init containers have completed successfully.

- **Ready**: The Pod is able to serve requests and should be added to the load balancing pools of all matching Services.

## Condition Status

Each condition has a `status` field that can be "True", "False", or "Unknown". The condition also includes `lastProbeTime`, `lastTransitionTime`, `reason`, and `message` fields that provide additional context about the condition's state.

## Using Conditions

Pod conditions help you understand why a Pod might not be ready or why it's not receiving traffic. Use `kubectl describe pod` to see the current conditions for a Pod.
