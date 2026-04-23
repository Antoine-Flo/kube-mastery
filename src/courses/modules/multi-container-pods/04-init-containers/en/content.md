---
seoTitle: 'Kubernetes Init Containers, Sequential Setup Before Main Container'
seoDescription: 'Learn how Kubernetes init containers run sequentially before main containers, how to use them for dependency checks and setup tasks, and what happens when they fail.'
---

# Init Containers

A web application needs a database to be ready before it starts. A container needs configuration files to be written before the main process can read them. A service depends on another service being reachable. Init containers handle these preconditions.

An init container runs to completion before any main container starts. If you define multiple init containers, they run in order, one at a time. Only when the last init container succeeds does the kubelet start the main containers. If any init container fails, the kubelet restarts it according to the Pod's restart policy. The main containers do not start until all init containers succeed.

## A concrete example: waiting for a dependency

```bash
nano init-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: init-pod
spec:
  initContainers:
    - name: wait-for-service
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          until nslookup myservice.default.svc.cluster.local; do
            echo "waiting for myservice..."
            sleep 2
          done
          echo "myservice is ready"
    - name: setup-config
      image: busybox:1.36
      command:
        - sh
        - -c
        - echo "db_host=myservice" > /config/app.conf
      volumeMounts:
        - name: config-vol
          mountPath: /config
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'cat /config/app.conf && sleep 3600']
      volumeMounts:
        - name: config-vol
          mountPath: /config
  volumes:
    - name: config-vol
      emptyDir: {}
```

```bash
kubectl apply -f init-pod.yaml
kubectl get pod init-pod --watch
```

@@@
graph LR
I1["Init: wait-for-service\nLoops until DNS resolves\nmyservice.default.svc"] -->|"succeeds"| I2["Init: setup-config\nWrites /config/app.conf"]
I2 -->|"succeeds"| M["Main: app\nreads /config/app.conf\nstarts normally"]
I1 -->|"fails"| I1R["Restarts\n(until restart policy limit)"]
@@@

While `wait-for-service` is running, the Pod shows `Init:0/2` in the `STATUS` column. That means 0 of 2 init containers have completed. When the first succeeds, it shows `Init:1/2`. When both complete, the main container starts and the status changes to `Running`.

```bash
kubectl describe pod init-pod
```

Look at the `Init Containers` section. Each init container has its own status, restart count, and exit code. Look also at `Events`: you will see the init containers start and complete in sequence.

:::quiz
A Pod has two init containers. The first succeeds. The second fails and restarts three times before succeeding. The main container then starts. How many restarts does the Pod show overall?

**Answer:** The Pod restart count does not reflect init container restarts directly. Each init container has its own restart count in `kubectl describe pod`. The Pod's `RESTARTS` column in `kubectl get pods` increments when the entire Pod restarts (all init containers start over), not just when one init container retries within the same Pod lifecycle.
:::

## Init containers vs sidecars

The difference is temporal. Init containers run before main containers, run to completion, and are then gone. Sidecars run alongside main containers for the entire lifetime of the Pod.

Use init containers for:
- Dependency checks (wait until a service is available)
- One-time setup (write config files, populate a shared volume with data)
- Database migrations (run before the application starts)
- Security setup (fetch secrets from a vault and write them to a volume)

Use sidecars for:
- Ongoing supplementary behavior (log shipping, metrics exposure, proxy)
- Tasks that must run continuously alongside the main container

:::warning
An init container that loops indefinitely keeps the Pod in `Init` state forever. If your dependency check never succeeds (the service genuinely does not exist), the Pod will be stuck in `Init:0/N` with the init container restarting endlessly. Set a realistic exit condition or add a timeout. Check `kubectl logs init-pod -c wait-for-service` to see what the init container is printing and why it is not exiting.
:::

## Sharing data through volumes

Init containers can populate a shared volume that the main container reads. This is the common pattern for setup tasks:

```bash
kubectl logs init-pod -c setup-config
kubectl logs init-pod -c app
```

The `setup-config` init container wrote a file to the shared volume. The main container reads it. The two containers never ran simultaneously. The sequence was enforced by Kubernetes.

:::quiz
An init container is defined with `command: ['sh', '-c', 'exit 1']`. What happens to the Pod?

**Answer:** The init container fails immediately. The kubelet restarts it based on the Pod's `restartPolicy`. With `restartPolicy: Always` (the default for Pods in a Deployment), the init container keeps being restarted. The Pod stays in `Init:CrashLoopBackOff` or `Init:Error` state indefinitely. The main container never starts. Fix the init container command or remove it to allow the Pod to proceed.
:::

```bash
kubectl delete pod init-pod
```

Init containers enforce sequencing: dependencies must be ready, setup must complete, preconditions must be met before the main application starts. The next lesson covers native sidecars, a Kubernetes 1.29+ feature that gives sidecar containers a proper lifecycle guarantee.
