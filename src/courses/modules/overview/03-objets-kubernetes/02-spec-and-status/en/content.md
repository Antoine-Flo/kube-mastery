# Spec and Status

Almost every Kubernetes object has two important nested fields that work together: `spec` and `status`. Understanding these two fields is key to understanding how Kubernetes works.

## Object Spec

The `spec` (short for "specification") describes the **desired state** of your object. This is what you want, the goal you're aiming for. When you create an object, you define the spec to tell Kubernetes what characteristics you want the resource to have.

For example, a Deployment spec might specify:
- Three replicas of your application
- Which container image to use
- Resource limits for each container
- Environment variables to set

Think of the spec as your wish list. You're telling Kubernetes: "I want my application to look like this."

## Object Status

The `status` describes the **current state** of your object, what's actually happening right now. Unlike the spec, you don't set the status yourself. Kubernetes and its components automatically populate and update this field as they work to make your desired state a reality.

The status might show:
- How many replicas are currently running
- Which Pods are ready to serve traffic
- Any errors or warnings that occurred
- The current health of your application

Think of the status as a progress report. It tells you: "Here's what's actually happening right now."

## How They Work Together

The relationship between spec and status is the heart of how Kubernetes operates. Here's how it works:

1. **You set the spec**: You create an object with a spec requesting three replicas of your application.

2. **Kubernetes reads the spec**: The control plane sees your desired state and starts working to achieve it.

3. **Kubernetes updates the status**: As Pods start, Kubernetes updates the status to show "3 of 3 replicas running."

4. **Continuous monitoring**: Kubernetes constantly compares spec and status. If they don't match, Kubernetes takes action.

5. **Automatic correction**: If a Pod crashes (status changes to show only 2 running), Kubernetes notices the mismatch and starts a replacement Pod to bring the status back in line with your spec.

This continuous comparison and correction is called the **reconciliation loop**. It's like having a thermostat that constantly checks the temperature and adjusts the heating to match your desired setting.

To see the spec and status of a Deployment, run:

```bash
kubectl get deployment <name> -o yaml
```

Replace `<name>` with an actual deployment name to view both spec and status fields side by side.

:::info
The spec/status pattern is fundamental to Kubernetes. You declare what you want (spec), and Kubernetes works tirelessly to make it happen, continuously updating the status to reflect reality. This is what makes Kubernetes self-healing and reliable.
:::

:::warning
You should never manually edit the status field. Kubernetes manages this automatically. If you try to change it, Kubernetes will reject your changes or overwrite them.
:::

## A Real Example

Imagine you create a Deployment with this spec:

```yaml
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: web
        image: nginx:latest
```

Kubernetes reads this and starts three Pods. The status might look like:

```yaml
status:
  replicas: 3
  readyReplicas: 3
  availableReplicas: 3
```

If one Pod crashes, the status changes to show `readyReplicas: 2`. Kubernetes detects this mismatch with your spec (which still says `replicas: 3`) and automatically starts a new Pod to restore the desired state.

To watch the status change in real-time, you can use:

```bash
kubectl get deployment <name> -w
```

Replace `<name>` with an actual deployment name. Press Ctrl+C to stop watching.
