---
seoTitle: 'Kubernetes Probe Types, httpGet exec tcpSocket, Configuration Reference'
seoDescription: 'Learn the three Kubernetes probe mechanism types (httpGet, exec, tcpSocket), all configurable timing parameters, and how to choose the right combination for your workload.'
---

# Probe Types and Configuration

The previous lessons focused on what each probe type does. This lesson covers the how: which mechanism to use, and how to tune the timing parameters to avoid both false positives and slow detection.

## The three probe mechanisms

Every Kubernetes probe (liveness, readiness, or startup) uses one of three mechanisms:

**`httpGet`**: makes an HTTP GET request to the container's IP on a specified port and path. A response with status code between 200 and 399 is a success. Used for web applications.

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
    httpHeaders:
      - name: Custom-Header
        value: probe
```

**`exec`**: runs a command inside the container. Exit code 0 is a success. Any other exit code is a failure. Used when there is no HTTP endpoint, or when the health check requires running a script.

```yaml
readinessProbe:
  exec:
    command:
      - sh
      - -c
      - pg_isready -U postgres
```

**`tcpSocket`**: attempts to open a TCP connection to the specified port. If the connection succeeds, the probe passes. No data is exchanged. Used for non-HTTP services (database ports, SMTP, etc.).

```yaml
livenessProbe:
  tcpSocket:
    port: 5432
```

:::quiz
You are writing a probe for a Redis container. Redis listens on port 6379 but does not serve HTTP. Which probe mechanism is most appropriate?

**Answer:** Either `tcpSocket` (checks that port 6379 is accepting connections) or `exec` (runs `redis-cli ping` and checks the response). `tcpSocket` is simpler and requires no additional tooling in the image. `exec` with `redis-cli ping` is more thorough because it verifies Redis can process commands, not just that the port is open.
:::

## Timing parameters

@@@
graph LR
START["Container starts"] --> DELAY["initialDelaySeconds\n(wait before first probe)"] --> FIRST["First probe check"]
FIRST -->|"period"| SECOND["Second probe"]
SECOND -->|"period"| THIRD["Third probe"]
THIRD -->|"fail"| COUNT["failureCount++\nif >= failureThreshold\n→ action taken"]
COUNT -->|"success"| RESET["successThreshold consecutive\nsuccesses → reset"]
@@@

| Parameter | Default | Description |
|---|---|---|
| `initialDelaySeconds` | 0 | Wait this many seconds after container start before running the first probe |
| `periodSeconds` | 10 | How often to run the probe |
| `timeoutSeconds` | 1 | How long to wait for the probe to respond before counting it as a failure |
| `failureThreshold` | 3 | Number of consecutive failures before the action is taken (restart or remove from endpoints) |
| `successThreshold` | 1 | Number of consecutive successes to go from failing to passing (relevant for readiness: how many passes before the Pod is added back to endpoints) |

## Applying the parameters together

```bash
nano tuned-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: tuned-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
      startupProbe:
        exec:
          command: ['sh', '-c', 'exit 0']
        failureThreshold: 20
        periodSeconds: 5
      livenessProbe:
        exec:
          command: ['sh', '-c', 'exit 0']
        initialDelaySeconds: 0
        periodSeconds: 15
        timeoutSeconds: 3
        failureThreshold: 3
        successThreshold: 1
      readinessProbe:
        exec:
          command: ['sh', '-c', 'exit 0']
        periodSeconds: 5
        failureThreshold: 2
        successThreshold: 2
```

The readiness probe here has `successThreshold: 2`: the container must pass the probe twice in a row before being added back to the Endpoints after a failure. This prevents flapping (rapid add/remove) when a dependency is intermittently available.

```bash
kubectl apply -f tuned-pod.yaml
kubectl describe pod tuned-pod
```

Look at the probe definitions in the output. All three probe sections appear with their configured parameters.

:::warning
The default `timeoutSeconds: 1` is often too short for a probe that runs a non-trivial command or queries a database. If the probe response takes longer than 1 second (under load, or on a slow startup), the probe times out and counts as a failure, even though the application is healthy. Set `timeoutSeconds` to at least 2-3 times the p99 response time of the probe endpoint under load.
:::

:::quiz
A readiness probe has `successThreshold: 3`. The probe fails, causing the Pod to be removed from the Endpoints. The probe then passes on the next check. Is the Pod immediately added back to the Endpoints?

**Answer:** No. The Pod needs 3 consecutive successes (successThreshold: 3) before being added back. This prevents flapping: if the dependency is intermittently available, the Pod will not rapidly flip between ready and not-ready. It is only added back after demonstrating stable availability for 3 consecutive probe periods.
:::

## Choosing the right mechanism per scenario

| Scenario | Recommended mechanism |
|---|---|
| HTTP web application | `httpGet` on health endpoint |
| Database (PostgreSQL, MySQL) | `exec` with `pg_isready` or `mysqladmin ping` |
| TCP service (Redis, SMTP) | `tcpSocket` or `exec` with a ping command |
| File-based health indicator | `exec` with `cat` or `test -f` |
| gRPC service | `exec` with `grpc_health_probe` binary |

```bash
kubectl delete pod tuned-pod
```

:::quiz
A probe has `periodSeconds: 5` and `failureThreshold: 4`. The probe starts failing. After how many seconds is the action triggered (restart for liveness, endpoint removal for readiness)?

**Answer:** 20 seconds. The probe checks every 5 seconds. After 4 consecutive failures (4 x 5 = 20 seconds of failures), the threshold is reached and the action is triggered. Note: the clock starts from the first failure, not from the start of the container.
:::

Combine all three probe types: a startup probe to protect slow startup, a readiness probe for traffic gating, and a liveness probe for deadlock detection. Tune `periodSeconds` and `failureThreshold` based on your application's actual behavior, not the defaults. The next module covers scheduling basics: taints, tolerations, node selectors, and node affinity.
