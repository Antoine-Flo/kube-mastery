# Service Selectors

You've seen that Services use label selectors to find their backend Pods. But how exactly does this connection work? What happens when labels change? And how do you verify that the right Pods are receiving traffic?

Understanding selectors deeply is essential — a misconfigured selector is one of the most common causes of "my Service isn't working."

## How Selectors Connect Services to Pods

A Service's `.spec.selector` defines a set of label key-value pairs. Kubernetes continuously watches for Pods that match **all** of these labels. When it finds matches, it creates **EndpointSlice** objects that list the Pod IPs — these are the actual targets for traffic.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app.kubernetes.io/name: MyApp
    tier: backend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
```

This Service routes traffic to Pods that have **both** labels. A Pod with only `app.kubernetes.io/name: MyApp` won't be selected — it also needs `tier: backend`.

```mermaid
flowchart LR
  SVC["Service (selector: app=MyApp, tier=backend)"]
  SVC --> P1["Pod (app=MyApp, tier=backend) - selected"]
  SVC --> P2["Pod (app=MyApp, tier=backend) - selected"]
  SVC -.->|no match| P3["Pod (app=MyApp, tier=frontend)"]
```

## EndpointSlices: The Connection Registry

When Pods match a Service's selector, Kubernetes automatically creates and updates **EndpointSlice** objects. These are the lists of "who should receive traffic." You don't need to manage them manually — the Service controller handles everything.

The process is continuous:

- New Pod matches the selector? Added to EndpointSlices.
- Pod deleted or labels changed? Removed from EndpointSlices within seconds.
- Pod fails readiness probe? Removed until it's healthy again.

## Exact Match — No Fuzzy Logic

Service selectors use **exact matching**. Labels must match precisely, including case:

- `app: MyApp` does NOT match `app: myapp`
- `app: nginx ` (with trailing space) does NOT match `app: nginx`

:::warning
Selectors are case-sensitive and require exact matches. `app: MyApp` and `app: myapp` are completely different labels. Use consistent labeling conventions across your workloads to avoid silent mismatches.
:::

## Multiple Services, Same Pods

Multiple Services can select the same Pods — and this is sometimes intentional. For example, you might have:

- An internal ClusterIP Service on port 80 for other Pods
- A monitoring Service on port 9090 for Prometheus scraping

Both target the same Pods but expose different ports. This is perfectly valid.

When a Service doesn't seem to work, always verify the selector chain: Service selector → Pod labels → Endpoints. If no Pods match, check labels with `kubectl get pods --show-labels`.

:::info
When you remove a label from a Pod, the Service immediately stops sending traffic to it. This can be a useful debugging technique: temporarily removing a selector label takes a Pod out of rotation so you can inspect it without live traffic.
:::

---

## Hands-On Practice

### Step 1: Create a Service and Pods with Matching Labels

```bash
kubectl create deployment demo --image=nginx --replicas=2
kubectl label deployment demo app=demo tier=web --overwrite
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: demo
spec:
  selector:
    app: demo
    tier: web
  ports:
    - port: 80
      targetPort: 80
EOF
```

**Observation:** The Service and Pods share matching labels, so the Service will select them.

### Step 2: Verify Endpoints

```bash
kubectl get endpoints demo
kubectl get pods --show-labels
```

**Observation:** Endpoints list shows Pod IPs. `--show-labels` confirms the labels match the Service selector.

### Step 3: Change a Pod Label and Observe Endpoint Removal

```bash
POD=$(kubectl get pods -l app=demo -o jsonpath='{.items[0].metadata.name}')
kubectl label pod $POD tier=api --overwrite
kubectl get endpoints demo
```

**Observation:** The endpoints list drops by one — the relabeled Pod no longer matches `tier: web`.

### Step 4: Clean Up

```bash
kubectl delete deployment demo
kubectl delete service demo
```

## Wrapping Up

Service selectors are the bridge between the stable Service abstraction and the dynamic world of Pods. They use exact label matching to find backends, and Kubernetes keeps the EndpointSlices updated automatically. Always verify the full chain: Service selector → Pod labels → Endpoints. In the next lesson, we'll explore service discovery — how Pods find and connect to Services by name.
