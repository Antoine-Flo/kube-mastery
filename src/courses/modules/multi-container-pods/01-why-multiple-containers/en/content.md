---
seoTitle: 'Kubernetes Multi-Container Pods, Shared Network and Volumes'
seoDescription: 'Learn why Kubernetes allows multiple containers in a Pod, what they share, when to use this pattern, and the key design principle of single responsibility per container.'
---

# Why Multiple Containers in a Pod

A Pod is not strictly one container. You can run multiple containers inside the same Pod. They share a network namespace (the same IP address and port space) and can share volumes. This co-location enables patterns that would be awkward or impossible if the containers ran in separate Pods.

But the ability to run multiple containers in a Pod does not mean you should always do it. The principle to follow is: containers in the same Pod must work together to serve a single concern. If they could be decoupled and run separately without losing functionality, they should be.

## What containers in a Pod share

```bash
nano shared-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: shared-pod
spec:
  containers:
    - name: writer
      image: busybox:1.36
      command: ['sh', '-c', 'while true; do echo "$(date)" >> /shared/log.txt; sleep 2; done']
      volumeMounts:
        - name: shared-vol
          mountPath: /shared
    - name: reader
      image: busybox:1.36
      command: ['sh', '-c', 'while true; do tail -1 /shared/log.txt; sleep 3; done']
      volumeMounts:
        - name: shared-vol
          mountPath: /shared
  volumes:
    - name: shared-vol
      emptyDir: {}
```

```bash
kubectl apply -f shared-pod.yaml
```

Two containers, one volume. `writer` appends timestamps to a file every 2 seconds. `reader` reads the last line of the same file every 3 seconds.

@@@
graph LR
subgraph pod ["Pod: shared-pod\nIP: 10.0.0.5"]
  W["Container: writer\nwrites to /shared/log.txt"]
  R["Container: reader\nreads from /shared/log.txt"]
  VOL["emptyDir volume\n/shared"]
  W --> VOL
  R --> VOL
  NET["Same network namespace\nlocalhost:port"]
  W -.-> NET
  R -.-> NET
end
@@@

```bash
kubectl logs shared-pod -c reader
```

The `-c` flag selects which container's logs to read. Without it, `kubectl logs` fails on a multi-container Pod and tells you to specify a container name.

The two containers communicate through a shared file on the `emptyDir` volume. They could equally communicate over `localhost`: if `writer` starts an HTTP server on port 8080, `reader` can reach it at `localhost:8080`. No service or network policy needed.

:::quiz
Two containers in the same Pod each listen on port 8080. What happens?

**Answer:** The second container will fail to bind its port. Both containers share the same network namespace (same IP, same port space). Port 8080 is already in use when the second container tries to bind it. Containers in the same Pod must use different ports, just like two processes on the same machine cannot both bind the same port.
:::

## Observing multi-container Pods

```bash
kubectl describe pod shared-pod
```

The `Containers` section lists both `writer` and `reader` with their individual status, restart counts, image, and command. Each container has independent lifecycle status even though they share the Pod.

```bash
kubectl get pods
```

The `READY` column shows `2/2` when both containers are running. If one container crashes, you see `1/2` even though the Pod itself is still present. The Pod is not restarted: only the failed container is restarted by the kubelet.

```bash
kubectl logs shared-pod -c writer
kubectl logs shared-pod -c reader
```

Each container has separate log streams.

:::warning
If a container in a multi-container Pod crashes repeatedly, the Pod shows `CrashLoopBackOff` in the `READY` column but the Pod object is not terminated. The other containers continue running. Use `kubectl describe pod` to identify which specific container is crashing and check its restart count and last exit code individually.
:::

## When not to use multiple containers

Two containers belong in the same Pod only when they are tightly coupled and must run on the same node sharing the same lifecycle. Examples that do not qualify:

- A frontend and a backend that communicate over HTTP: they should be separate Pods with a Service between them
- A database and an application: separate Pods, separate lifecycle, separate scaling
- Two independent microservices that happen to be part of the same application: separate Pods

:::quiz
A team wants to put their web application and its database in the same Pod for simplicity. What is the problem with this?

**Answer:** They cannot scale independently. Scaling the web application (adding replicas) would also replicate the database, causing data inconsistency (each replica would have its own database state). They also cannot restart one without restarting the other. The correct design is separate Pods: the web application Deployment and a separate database deployment, connected by a Service.
:::

```bash
kubectl delete pod shared-pod
```

The shared network namespace and shared volumes are the two mechanisms that make multi-container Pods useful. The next lesson covers the sidecar pattern, the most common application of these shared resources.
