# Creating a ReplicaSet

Let's create a ReplicaSet using a YAML manifest.

## ReplicaSet Manifest Example

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      tier: frontend
  template:
    metadata:
      labels:
        tier: frontend
    spec:
      containers:
        - name: php-redis
          image: nginx:1.14.2
```

## Key Fields

- **apiVersion**: `apps/v1` for ReplicaSet objects
- **kind**: `ReplicaSet`
- **spec.replicas**: Number of Pods to maintain
- **spec.selector**: Label selector to identify Pods
- **spec.template**: Pod template for creating new Pods

## Creating the ReplicaSet

Apply the manifest:

```bash
kubectl apply -f replicaset.yaml
```

## Scaling a ReplicaSet

You can scale a ReplicaSet by updating the `.spec.replicas` field. The ReplicaSet controller ensures that the desired number of Pods with matching labels are available.
