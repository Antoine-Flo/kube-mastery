# Container States

Kubernetes tracks the state of each container inside a Pod. There are three possible container states.

## Container States

- **Waiting**: If a container is not in either `Running` or `Terminated` state, it is `Waiting`. A container in this state is still running operations required to complete startup, such as pulling the container image or applying Secret data.

- **Running**: The `Running` status indicates that a container is executing without issues. If there was a `postStart` hook configured, it has already executed and finished.

- **Terminated**: A container in the `Terminated` state began execution and then either ran to completion or failed for some reason. When you query a Pod with a container that is `Terminated`, you see a reason, an exit code, and the start and finish time.

## Checking Container States

Use `kubectl describe pod <pod-name>` to check the state of a Pod's containers. The output shows the state for each container within that Pod, along with reasons for the current state.
