---
seoTitle: 'Kubernetes Probes, Why Liveness Readiness Startup Probes Matter'
seoDescription: 'Understand why Kubernetes probes exist, the difference between a running process and a healthy one, and how probes prevent traffic from reaching broken containers.'
---

# Why Probes Matter

A container is running. The process is alive. But the HTTP server inside is returning 500 errors on every request. Kubernetes has no way to know this. Without probes, it keeps sending traffic to the broken container and reporting it as `Running`. Clients see errors. Nothing restarts.

Probes let you tell Kubernetes what "healthy" means for your application. They move the health definition from "process is running" to "application is actually working." Kubernetes uses three probe types:

- **Liveness probes**: is the container still healthy? If no, restart it.
- **Readiness probes**: is the container ready to receive traffic? If no, remove it from Service endpoints.
- **Startup probes**: has the container finished starting? Delay liveness and readiness checks until startup completes.

Each probe answers a different operational question. They can all be active on the same container at the same time.

## The problem probes solve

```bash
kubectl run no-probe --image=busybox:1.36 --restart=Never \
  --command -- sh -c 'sleep 3600'
kubectl get pod no-probe
```

The Pod shows `Running` and `READY: 1/1`. But there is no application inside. Kubernetes reports it as ready because no probe tells it otherwise. Traffic from a Service would reach this Pod, and whatever is listening (nothing) would handle it.

@@@
graph TB
subgraph without ["Without probes"]
  P1["Container: Running\nProcess alive but\nHTTP returning 500"] --> K1["Kubernetes: reports Ready\nroutes traffic here"]
  K1 --> ERR["Client gets 500 errors"]
end
subgraph with ["With readiness probe"]
  P2["Container: Running\nHTTP probe fails"] --> K2["Kubernetes: reports Not Ready\nremoves from endpoints"]
  K2 --> OK["Client requests\ngo to healthy pods only"]
end
@@@

Probes are not a replacement for application monitoring. They are a signal to Kubernetes that drives two behaviors: restarting unhealthy containers and routing traffic away from unready ones. Your monitoring system still needs to capture why the probe failed.

## Three probe types, three questions

**Liveness** answers: should Kubernetes restart this container? If a liveness probe fails for a configurable number of consecutive times, the kubelet kills the container and restarts it. Use liveness probes for deadlock detection, runaway memory, or any state from which the application cannot self-recover.

**Readiness** answers: should this container receive traffic right now? If a readiness probe fails, the container is removed from the Service's Endpoints list. Traffic stops coming to it, but the container is not restarted. Use readiness probes for temporary unreadiness: cache warming, database migrations in progress, dependency temporarily unavailable.

**Startup** answers: has the container finished its startup sequence? During the startup period, liveness and readiness checks are suspended. Use startup probes for slow-starting containers that would be killed by liveness probes before they finish initializing.

:::quiz
A database container takes 60 seconds to start. A liveness probe is configured with a 10-second timeout and 3 failure threshold (30 seconds total). What happens?

**Answer:** The container is restarted before it finishes starting. The liveness probe starts checking immediately after the container starts. If the database is not ready after 30 seconds, the probe fails 3 times and the kubelet restarts the container. This creates an infinite restart loop. The fix is a startup probe that delays liveness checking until the startup is complete.
:::

## Checking probe status

```bash
kubectl describe pod <pod-name>
```

The `Conditions` section shows `ContainersReady: True/False`. The `Events` section shows probe failures. A failing liveness probe produces an event like `Liveness probe failed: ...` followed by a container restart.

```bash
kubectl get pods
```

A container that keeps failing its liveness probe will show increasing `RESTARTS`. A container failing its readiness probe shows `0/1` in `READY` without incrementing restarts. These two symptoms point to different probe types.

:::warning
Configuring probes poorly is worse than not configuring them at all. A liveness probe that is too aggressive restarts healthy containers under load. A readiness probe that is too slow delays the rollout of new Pod replicas. The tuning parameters (thresholds, periods, initial delays) matter as much as the probe endpoint itself. The configuration lesson covers all tunable parameters.
:::

```bash
kubectl delete pod no-probe
```

:::quiz
A Pod shows `RESTARTS: 15` after 30 minutes. `kubectl describe` shows `Liveness probe failed`. What is the correct interpretation?

**Answer:** The liveness probe is repeatedly failing, causing the kubelet to restart the container. The container has been restarted 15 times. This is distinct from an application crash (which would show a non-zero exit code reason) and from a readiness failure (which would show `0/1 READY` but no restarts). Investigate why the liveness probe endpoint is failing: the application may be deadlocked, out of memory, or the probe endpoint may be misconfigured.
:::

Probes transform Kubernetes from a process-level supervisor into an application-level health monitor. The next three lessons cover each probe type in detail, and the final lesson covers all configurable parameters.
