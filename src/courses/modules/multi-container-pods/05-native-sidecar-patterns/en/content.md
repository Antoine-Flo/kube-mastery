---
seoTitle: 'Kubernetes Native Sidecar Containers, restartPolicy Always Init'
seoDescription: 'Learn about Kubernetes native sidecar containers introduced in 1.29, how they differ from regular sidecars and init containers, and when to use them.'
---

# Native Sidecar Containers

The sidecar pattern has a lifecycle problem. When a Job completes, Kubernetes waits for all containers in the Pod to stop. A traditional sidecar (a regular container running alongside the main container) does not know the main container has finished. It keeps running. The Job Pod never completes. You end up with Pods stuck in a `Completed` state with a still-running sidecar.

Kubernetes 1.29 introduced a formal sidecar container type that solves this and adds startup ordering guarantees. A native sidecar is an init container with `restartPolicy: Always`.

## How native sidecars work

@@@
graph LR
NSC["Native sidecar\n(initContainer\nrestartPolicy: Always)\nStarts first, runs forever"] -->|"starts before"| MAIN["Main container\nstarts after sidecar is Ready"]
MAIN -->|"exits"| TERM["Main container: Completed\nSidecar receives SIGTERM\nterminates cleanly"]
@@@

A native sidecar is defined in `initContainers` with `restartPolicy: Always`. This makes it behave differently from both regular init containers and regular sidecar containers:

- It starts before the main containers (like an init container)
- It runs for the full lifetime of the Pod (like a regular sidecar)
- When the main containers exit, the native sidecar receives a termination signal (unlike a regular sidecar which would keep running)
- If it crashes, it is restarted without restarting the entire Pod

## A practical example with a Job

The classic problem: a log-shipping sidecar keeps a Job Pod alive after the task completes.

```bash
nano native-sidecar-job.yaml
```

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: sidecar-job
spec:
  template:
    spec:
      restartPolicy: Never
      initContainers:
        - name: log-shipper
          image: busybox:1.36
          restartPolicy: Always
          command:
            - sh
            - -c
            - |
              while true; do
                echo "shipping logs..."
                sleep 2
              done
      containers:
        - name: main-task
          image: busybox:1.36
          command:
            - sh
            - -c
            - echo "task done" && sleep 5
```

```bash
kubectl apply -f native-sidecar-job.yaml
kubectl get pods --watch
```

Watch the Pod status. When the main task container completes, the native sidecar receives a termination signal and stops. The Pod transitions to `Completed` cleanly. Without native sidecars, the `log-shipper` would have kept the Pod alive indefinitely.

```bash
kubectl describe pod -l job-name=sidecar-job
```

In the `Init Containers` section, you will see `log-shipper` with `restartPolicy: Always`. In the `Containers` section, you see `main-task`. The two sections reflect the distinction.

:::quiz
A native sidecar is defined as an `initContainer` with `restartPolicy: Always`. The main container exits with code 0. What happens to the native sidecar?

**Answer:** The native sidecar receives a SIGTERM and terminates. The Job Pod then completes cleanly. Without native sidecars, the sidecar would keep running because regular containers (and traditional sidecars defined as regular containers) do not receive a signal when the main container exits normally. Native sidecars are specifically designed to terminate when the main workload is done.
:::

## Startup ordering guarantee

A second benefit of native sidecars: the main container does not start until the native sidecar is ready. This is the same guarantee you get from init containers, but the native sidecar keeps running after providing it.

This solves the race condition in the traditional sidecar pattern: a log shipper sidecar might miss the first few seconds of logs if the main container starts at the same time and the sidecar takes a moment to initialize. With native sidecars, you can add a readiness probe to the sidecar, and the main container only starts once the sidecar is ready.

:::warning
Native sidecar containers require Kubernetes 1.29 or later (stable in 1.29, beta in 1.28). In the simulator environment, check the available Kubernetes version before relying on this feature. The CKA exam tests concepts from the current Kubernetes version, so native sidecars may appear in questions. If a question asks about sidecar lifecycle or Job sidecar cleanup, the native sidecar approach using `initContainers.restartPolicy: Always` is the modern answer.
:::

:::quiz
You want a log-shipping sidecar that starts before the main container and stops cleanly when the main container finishes. Which approach should you use?

- Regular `containers` entry for the log shipper
- `initContainers` entry without `restartPolicy`
- `initContainers` entry with `restartPolicy: Always`

**Answer:** `initContainers` with `restartPolicy: Always`. This is the native sidecar pattern. A regular container entry starts concurrently with the main container (no ordering guarantee) and does not terminate when the main container exits. An init container without `restartPolicy` runs to completion before the main container starts and is then gone. The native sidecar combines the best of both: starts first, runs alongside, terminates when the main container exits.
:::

```bash
kubectl delete job sidecar-job
```

Native sidecars address the two traditional sidecar weaknesses: uncontrolled startup ordering and zombie sidecars in completed Jobs. The `restartPolicy: Always` field on an init container is the API signal for this behavior. The next module covers probes, which define when a container is ready to receive traffic and when it should be restarted.
