# Updating a Deployment

You can update a Deployment by modifying its Pod template.

## Update Methods

**Using kubectl set image:**
```bash
kubectl set image deployment/nginx-deployment nginx=nginx:1.16.1
```

**Using kubectl edit:**
```bash
kubectl edit deployment/nginx-deployment
```
Then modify `.spec.template.spec.containers[0].image` from `nginx:1.14.2` to `nginx:1.16.1`.

**Using kubectl apply:**
Modify the YAML file and run:
```bash
kubectl apply -f deployment.yaml
```

## What Gets Updated

Only changes to the Pod template (`.spec.template`) trigger a rollout. Other updates, such as scaling the Deployment, do not trigger a rollout. This allows you to scale and update independently.

## Update Process

After updating, the Deployment controller creates a new ReplicaSet and begins the rolling update process, gradually replacing old Pods with new ones.
