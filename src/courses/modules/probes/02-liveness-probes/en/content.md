---
seoTitle: 'Kubernetes Liveness Probe, Container Restart on Failure'
seoDescription: 'Learn how Kubernetes liveness probes detect deadlocked or unhealthy containers and trigger automatic restarts, with practical HTTP, TCP, and exec probe examples.'
---

# Liveness Probes

An application gets into a deadlock. The HTTP server stops responding. The process is still running, so the kubelet does not restart it. Without a liveness probe, the container stays in this broken state until someone notices and manually intervenes. A liveness probe detects this and triggers a restart automatically.

The liveness probe runs repeatedly throughout the container's lifetime. Each failure increments a counter. When the failure count reaches the `failureThreshold`, the kubelet kills and restarts the container. A single success resets the counter.

## An HTTP liveness probe

The most common probe type for web applications: check a health endpoint and expect a 2xx or 3xx response.

```bash
nano liveness-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: liveness-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          mkdir -p /tmp/health
          echo "OK" > /tmp/health/live
          sleep 3600
      livenessProbe:
        exec:
          command:
            - cat
            - /tmp/health/live
        initialDelaySeconds: 5
        periodSeconds: 10
        failureThreshold: 3
```

This uses an `exec` probe (running a command) because busybox does not serve HTTP. In a real application, the `httpGet` probe type is more common:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3
```

```bash
kubectl apply -f liveness-pod.yaml
kubectl describe pod liveness-pod
```

Look at the `Liveness` line in the container section. It shows the probe configuration and the current success/failure count.

:::quiz
A Pod has a liveness probe with `failureThreshold: 3` and `periodSeconds: 10`. The probe starts failing. How long before the container is restarted?

**Answer:** 30 seconds. The probe fails once at second 0, again at second 10, again at second 20. After the third failure (failureThreshold: 3), the kubelet kills and restarts the container. The total time from first failure to restart is `(failureThreshold - 1) * periodSeconds = 2 * 10 = 20` seconds after the first failure, or 30 seconds from when the second period started.
:::

## Simulating a liveness failure

Remove the health file to cause the exec probe to fail:

```bash
kubectl exec liveness-pod -- rm /tmp/health/live
```

Wait 30 seconds (3 probe periods), then check:

```bash
kubectl get pod liveness-pod
kubectl describe pod liveness-pod
```

The `RESTARTS` counter has incremented. The Events section shows `Liveness probe failed: ...` followed by `Killing container with id...`. The container was restarted.

After restart, the startup command runs again and recreates `/tmp/health/live`. The probe succeeds. The cycle stabilizes.

## What liveness probes should check

A liveness probe should check whether the application is in an unrecoverable broken state. Good liveness probe targets:

- An HTTP `/healthz` or `/health` endpoint that the application serves specifically for health checks
- A command that exits 0 only if a critical internal component is functioning
- A TCP connection to a port that the application is actively listening on

Bad liveness probe targets:
- External dependencies (a downstream database or third-party API). If the external service goes down, your liveness probe should not restart your Pod, which cannot fix the external problem.
- Expensive operations that consume significant CPU or I/O on every check

:::warning
A liveness probe that checks external dependencies can cause a cascade failure. If the database goes down, every Pod with a database-checking liveness probe will restart simultaneously. After restart, they all try to reconnect to the still-down database, fail again, and restart again. Use readiness probes for external dependency checks: they remove the Pod from traffic without restarting it.
:::

:::quiz
Your application has a `/health` endpoint that checks the database connection and returns 500 if the database is unavailable. You use this as a liveness probe. The database goes down briefly. What happens?

**Answer:** All application Pods fail their liveness probes and are restarted. Restarting the application Pods does not fix the database. After restart, each Pod checks the database again, fails again, and restarts again. This is a restart cascade. Liveness probes should check internal application health only. Use a readiness probe for the database check: the Pod stops receiving traffic but does not restart.
:::

```bash
kubectl delete pod liveness-pod
```

Liveness probes catch unrecoverable internal failures. The next lesson covers readiness probes, which handle temporary unavailability without restarting the container.
