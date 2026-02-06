# What is a ReplicaSet?

A ReplicaSet's purpose is to maintain a stable set of replica Pods running at any given time.

{{diagram:replicaset-pods}}

## ReplicaSet Function

A ReplicaSet ensures that a specified number of pod replicas are running at any given time. It's often used to guarantee the availability of a specified number of identical Pods.

## How ReplicaSets Work

A ReplicaSet is defined with:

- A **selector** that specifies how to identify Pods it can acquire
- A number of **replicas** indicating how many Pods it should maintain
- A **pod template** specifying the data of new Pods it should create

The ReplicaSet fulfills its purpose by creating and deleting Pods as needed to reach the desired number. When a ReplicaSet needs to create new Pods, it uses its Pod template.

## Relationship with Deployments

While ReplicaSets can be used independently, they're mainly used by Deployments as a mechanism to orchestrate Pod creation, deletion, and updates. It's recommended to use Deployments when you want ReplicaSets.

:::info
In general, use a Deployment rather than a ReplicaSet directly. Deployments provide additional features like rolling updates and rollback capabilities.
:::
