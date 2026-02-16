# Scaling a Deployment

Your application is running, and three Pods are humming along. But what happens when a marketing campaign drives a traffic spike? Or when it is 3 AM and your service barely sees any requests? This is where **scaling** comes in — adjusting the number of replicas to match demand, like turning a volume knob up or down.

Scaling a Deployment is one of the simplest yet most impactful operations in Kubernetes. You change a number, and the cluster adapts.

## How Scaling Works Under the Hood

When you scale a Deployment, the Deployment controller updates the replica count on the underlying ReplicaSet. The ReplicaSet controller then creates or terminates Pods to match the new desired count.

- **Scaling up**: new Pods are created from the existing Pod template and scheduled onto available nodes.
- **Scaling down**: excess Pods are selected for termination. Kubernetes respects graceful shutdown periods, giving containers time to finish in-flight work before stopping them.

An important detail: **scaling does not trigger a rollout**. No new ReplicaSet is created. The existing ReplicaSet simply adjusts its Pod count. This means scaling is fast, safe, and carries no risk of a version change.

## Manual Scaling with kubectl

The most direct way to scale is with `kubectl scale`:

```bash
kubectl scale deployment/nginx-deployment --replicas=5
```

This tells Kubernetes: "I now want five replicas instead of three." The Deployment controller immediately begins creating two additional Pods.

You can verify the result:

```bash
kubectl get deployment nginx-deployment
```

```
NAME               READY   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   5/5     5            5           4m
```

The `READY` column should update to `5/5` once all new Pods pass their readiness checks.

## Scaling Through the Manifest

Alternatively, you can edit the `spec.replicas` field in your YAML file and reapply:

```yaml
spec:
  replicas: 5
```

```bash
kubectl apply -f nginx-deployment.yaml
```

Or use `kubectl edit` to modify the live object directly:

```bash
kubectl edit deployment nginx-deployment
```

Both approaches produce the same result. The difference is workflow preference — manifest-driven changes are easier to track in version control, while `kubectl scale` is convenient for quick adjustments during development or incidents.

:::warning
Be careful when mixing `kubectl scale` with `kubectl apply`. If you scale to 5 replicas with `kubectl scale` but your manifest still says `replicas: 3`, the next `kubectl apply` will scale you back down to 3. To avoid surprises, choose one management method and stick with it — ideally the manifest-driven approach for production environments.
:::

## Verifying the Scale Operation

After scaling, confirm that the actual Pod count matches your desired count:

```bash
kubectl get pods -l app=nginx
```

You should see exactly the number of Pods you requested. If some Pods remain in `Pending` state, the cluster may not have enough resources to schedule them. Run `kubectl describe pod <pod-name>` and check the Events section for messages about insufficient CPU or memory.

You can also query the desired replica count directly:

```bash
kubectl get deployment nginx-deployment -o jsonpath='{.spec.replicas}'
```

## Automatic Scaling with HPA

Manual scaling works well for predictable workloads, but what about traffic that fluctuates throughout the day? The <a target="_blank" href="https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/">Horizontal Pod Autoscaler (HPA)</a> watches metrics like CPU utilization or custom application metrics and adjusts the replica count automatically. When traffic rises, the HPA scales up. When it falls, the HPA scales down.

Think of the HPA as cruise control for your Deployment — you set the target speed (e.g., 50% average CPU utilization) and the system adjusts the throttle (replicas) to maintain it.

:::info
When using an HPA, do not set `spec.replicas` in your Deployment manifest. Let the autoscaler manage the replica count. If both the HPA and the manifest specify replicas, they will conflict, causing unexpected scaling behavior.
:::

Setting up HPA is beyond the scope of this lesson, but keep this concept in mind — it is a natural next step once your application is in production.

## Wrapping Up

Scaling adjusts the number of Pods without triggering a rollout or changing your application version. You can scale manually with `kubectl scale`, by editing the manifest, or automatically using the Horizontal Pod Autoscaler. The key pitfall to avoid is mixing imperative commands (`kubectl scale`) with declarative manifests (`kubectl apply`) — pick one approach to prevent accidental overrides. With scaling covered, you are ready to explore one of the most powerful features of Deployments: rolling updates.
