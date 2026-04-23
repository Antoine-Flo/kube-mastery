---
seoTitle: 'Kubernetes StatefulSet Manifest, Pod Identity, serviceName Field'
seoDescription: 'Learn how to create a Kubernetes StatefulSet, understand the serviceName field, observe ordered Pod startup, and inspect stable Pod identities.'
---

# StatefulSet Fundamentals

A StatefulSet manifest looks similar to a Deployment with a few critical additions. The most important is `serviceName`: the name of a headless Service that provides stable DNS for each Pod. Without this Service, the stable hostname guarantee cannot be fulfilled.

```bash
nano web-statefulset.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-headless
  labels:
    app: web
spec:
  clusterIP: None
  selector:
    app: web
  ports:
    - port: 80
      name: web
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: web-headless
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: busybox:1.36
          command: ['sh', '-c', 'echo "pod: $HOSTNAME" && sleep 3600']
```

```bash
kubectl apply -f web-statefulset.yaml
```

## Observing ordered startup

```bash
kubectl get pods --watch
```

Watch the Pods appear in order: `web-0` starts and becomes `Running` before `web-1` starts, and `web-1` runs before `web-2` starts. This ordered startup is a core StatefulSet guarantee.

@@@
graph LR
S0["web-0\nstarts\nRunning"] -->|"only then"| S1["web-1\nstarts\nRunning"] -->|"only then"| S2["web-2\nstarts\nRunning"]
@@@

Stop the watch with Ctrl+C. Check the final state:

```bash
kubectl get pods -l app=web
```

All three Pods are named `web-0`, `web-1`, `web-2`. The ordinal suffix is the stable identity.

## The HOSTNAME environment variable

```bash
kubectl exec web-0 -- sh -c 'echo $HOSTNAME'
kubectl exec web-1 -- sh -c 'echo $HOSTNAME'
```

Each Pod's `HOSTNAME` is set to its stable name: `web-0`, `web-1`. Applications running inside the Pod can use `$HOSTNAME` to know their own identity, which is critical for distributed systems where each instance needs a unique ID (node ID in a Kafka broker, replica ID in MongoDB).

:::quiz
A StatefulSet has `replicas: 3`. You delete Pod `web-1`. What happens?

**Answer:** The StatefulSet controller creates a new Pod named `web-1` immediately. The Pod gets the same name, the same ordinal index (1), and will reattach to the same PVC as the original `web-1`. The identity is stable: `web-1` always refers to the second instance of this StatefulSet, regardless of how many times it has been recreated.
:::

## The serviceName field

`serviceName` must match an existing headless Service (one with `clusterIP: None`). The headless Service is what creates DNS entries for each Pod.

Without the headless Service, the StatefulSet still creates Pods with stable names, but there are no stable DNS names for other workloads to reach them. Headless Services are covered in detail in the next lesson.

```bash
kubectl describe statefulset web
```

Look at the `Service Name` field. It shows `web-headless`. The `Events` section shows the ordered creation of each Pod.

## Scaling a StatefulSet

```bash
kubectl scale statefulset web --replicas=5
kubectl get pods --watch
```

Pods are added in order: `web-3` then `web-4`. Similarly, scaling down removes the highest-ordinal Pod first: `web-4` is deleted, then `web-3`.

:::warning
Each Pod must be Running and Ready before the next one starts (or the previous one is deleted). If `web-1` is stuck in `Pending` or `CrashLoopBackOff`, the StatefulSet is blocked. `web-2` will not start until `web-1` is healthy. This is intentional for ordered initialization, but it means a single failing Pod can block the entire rollout. Use `kubectl describe pod web-1` to diagnose the stuck Pod.
:::

```bash
kubectl scale statefulset web --replicas=3
```

:::quiz
You scale a StatefulSet from 5 to 2 replicas. In what order are the Pods deleted?

**Answer:** Pods are deleted in descending ordinal order: `web-4` first, then `web-3`. The StatefulSet controller waits for each Pod to be fully terminated before deleting the next. `web-0` and `web-1` are never touched.
:::

The `serviceName` field, stable Pod names, and ordered lifecycle are the three mechanics that distinguish a StatefulSet from a Deployment. The next lesson covers headless Services and the DNS that makes stable addressing possible.
