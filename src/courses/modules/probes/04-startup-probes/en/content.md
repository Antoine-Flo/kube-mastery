---
seoTitle: 'Kubernetes Startup Probe, Slow Starting Containers, CrashLoopBackOff'
seoDescription: 'Learn how Kubernetes startup probes protect slow-starting containers from premature liveness probe failures and how to calculate the correct startup probe timeout.'
---

# Startup Probes

A Java application takes 90 seconds to start. You configure a liveness probe with `failureThreshold: 3` and `periodSeconds: 10`. Kubernetes kills the container after 30 seconds of failed probes, before the JVM finishes loading. A restart loop begins. The application never gets to serve traffic.

The startup probe is designed for this exact situation. While the startup probe is active, liveness and readiness probes are suspended. The startup probe has its own timeout budget, sized for however long your container actually needs to start. Once the startup probe succeeds, the normal liveness and readiness probes take over.

## Configuring a startup probe

```bash
nano startup-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: startup-pod
spec:
  containers:
    - name: slow-app
      image: busybox:1.36
      command:
        - sh
        - -c
        - |
          echo "starting up... this takes a while"
          sleep 20
          echo "ready" > /tmp/ready
          echo "startup complete"
          sleep 3600
      startupProbe:
        exec:
          command:
            - cat
            - /tmp/ready
        failureThreshold: 30
        periodSeconds: 5
      livenessProbe:
        exec:
          command:
            - cat
            - /tmp/ready
        failureThreshold: 3
        periodSeconds: 10
```

```bash
kubectl apply -f startup-pod.yaml
kubectl get pod startup-pod --watch
```

For the first 20 seconds, the startup probe fails (the file does not exist yet). The liveness probe is not running during this period. After 20 seconds, the file appears, the startup probe succeeds, and the liveness probe takes over.

## Calculating the startup probe timeout

@@@
graph LR
START["Container starts"] --> SP["Startup probe\nperiodSeconds: 5\nfailureThreshold: 30\n= 150s budget"]
SP -->|"succeeds within 150s"| LP["Liveness probe\ntakes over"]
SP -->|"never succeeds"| KILL["Container killed\nafter 150s"]
@@@

The maximum startup time allowed is `failureThreshold * periodSeconds`. With `failureThreshold: 30` and `periodSeconds: 5`, the container has 150 seconds to start. If the startup probe never succeeds within that window, the container is killed.

Choose the values based on your application's worst-case startup time:
- Measure actual startup time in staging
- Add 50% headroom for cold starts, slow nodes, and dependency delays
- Set `failureThreshold = ceil(startup_budget / periodSeconds)`

For a container that starts in 60 seconds in the worst case, with 90 seconds of budget and `periodSeconds: 10`: `failureThreshold = ceil(90 / 10) = 9`.

:::quiz
A container normally starts in 30 seconds but can take up to 90 seconds under heavy load. What startup probe configuration provides appropriate coverage?

**Answer:** `failureThreshold: 10, periodSeconds: 10` provides a 100-second budget (10 x 10 = 100s), which covers the 90-second worst case with 10 seconds of headroom. Alternatively, `failureThreshold: 18, periodSeconds: 5` gives 90 seconds with finer resolution. The budget must exceed the worst-case startup time; add padding for safety.
:::

## When to use startup probes

Startup probes are necessary when your container has a startup time that would cause liveness probe failures before the application is ready. This is common for:

- JVM applications (slow class loading, connection pool warm-up)
- Applications that run database migrations on startup
- Services that need to pull large amounts of data before they can respond
- Containers in environments where cold starts are slow (storage I/O, slow pulls)

Startup probes are not needed when the container starts in a few seconds. In those cases, setting an appropriate `initialDelaySeconds` on the liveness probe is sufficient.

:::warning
Using `initialDelaySeconds` alone on a liveness probe does not provide the same protection as a startup probe. `initialDelaySeconds` is a fixed delay, not a conditional one: after the delay, the liveness probe starts checking regardless of whether the container is ready. If startup is slow on some nodes, a fixed delay may still be too short. The startup probe adapts to actual startup completion.
:::

```bash
kubectl describe pod startup-pod
```

Look at the `Startup` section in the container status. It shows the current probe result and the number of times it has been checked. Once the startup probe succeeds, this section shows `Success`.

```bash
kubectl delete pod startup-pod
```

:::quiz
A container has both a startup probe and a liveness probe. The startup probe fails 5 times, then succeeds on the 6th attempt. What happens to the liveness probe during those first 5 failures?

**Answer:** Nothing. The liveness probe is suspended while the startup probe is active. The liveness probe only starts running after the startup probe has succeeded. The kubelet does not count the startup probe failures against the liveness probe. Once the startup probe succeeds, the liveness probe starts fresh with its own counter.
:::

Startup probes protect slow containers from premature restarts. Size the `failureThreshold` generously for your worst-case startup time. The next lesson covers the three probe mechanism types (exec, httpGet, tcpSocket) and all configurable parameters.
