---
seoTitle: 'Kubernetes Pod Spec, Containers, Image, Resources, Ports'
seoDescription: 'Understand the structure of a Kubernetes Pod manifest, covering containers, image, name, ports, and resource requests and limits field by field.'
---

# Pod Structure

You know what a Pod is. Now you need to write one. Before you create your first Pod in the next lesson, it is worth understanding the key fields in its manifest, one at a time. The `spec` of a Pod is simpler than it might look, but a few fields trip up almost everyone at the beginning.

## The `containers` field

Every Pod spec starts here. `containers` is a required list, even if your Pod has only one container.

```yaml
# illustrative only
spec:
  containers:
    - name: web
      image: nginx:1.28
```

Two fields, two jobs. The `name` field is an internal identifier for the container within the Pod. It is not a DNS name, not a hostname visible on the network. It shows up in `kubectl describe` output and in logs, so choose something readable. The `image` field is the container image to run. Always specify the tag explicitly. Using `:latest` is tempting but non-deterministic: the same manifest can pull different code on different days, which breaks reproducibility.

## The `ports` field

The next field you will see in almost every example is `ports`:

```yaml
# illustrative only
spec:
  containers:
    - name: web
      image: nginx:1.28
      ports:
        - containerPort: 80
```

`containerPort` documents which port the container listens on. That is all it does. It does not open anything, it does not configure NAT, it does not affect routing. Traffic to that port works whether you declare it or not. The field exists for tooling, documentation, and human readers.

:::warning
Many beginners assume that declaring `containerPort: 80` makes the Pod reachable from outside the cluster. It does not. A Pod is only accessible from within the cluster by default. To expose it externally, you need a Service. `containerPort` is purely documentary.
:::

## The `resources` field

This one is not required, but skipping it is a common mistake in production environments.

```yaml
# illustrative only
spec:
  containers:
    - name: web
      image: nginx:1.28
      ports:
        - containerPort: 80
      resources:
        requests:
          cpu: '100m'
          memory: '64Mi'
        limits:
          cpu: '200m'
          memory: '128Mi'
```

There are two sub-fields here: `requests` and `limits`. They serve different purposes.

`requests` is what the scheduler reads when it decides which node can accept the Pod. If a node has 500m CPU available and you request 100m, the Pod can land there. If the node only has 50m free, the Pod stays `Pending` until a node with enough room appears.

`limits` is the enforcement cap at runtime. The container cannot use more than 200m CPU or 128Mi of memory. If it tries to exceed the memory limit, the kernel kills it. If it tries to exceed the CPU limit, it gets throttled.

CPU is expressed in millicores: 1000m equals one full CPU core. Memory uses binary units: Mi for mebibytes, Gi for gibibytes.

@@@
graph TD
POD["Pod spec"]
POD --> CNT["containers (list)"]
CNT --> NAME["name\n(internal identifier)"]
CNT --> IMG["image\n(always pin the tag)"]
CNT --> PORTS["ports\n(optional, documentary)"]
CNT --> RES["resources\n(strongly recommended)"]
RES --> REQ["requests\n(scheduling hint)"]
RES --> LIM["limits\n(enforcement cap)"]
@@@

:::quiz
What does the `containerPort` field do in a Pod spec?

- It opens the port on the node's firewall so external traffic can reach the Pod
- It documents which port the container listens on, with no effect on networking
- It tells Services which port to route traffic to when selecting this Pod

**Answer:** It documents which port the container listens on, with no effect on networking. Services use `targetPort` to route traffic, which may match `containerPort` by convention, but the two fields are independent. Declaring `containerPort` has zero effect on reachability.
:::

:::quiz
Why does the scheduler use `requests` rather than the container's actual CPU and memory usage?

**Answer:** Because actual usage fluctuates. If the scheduler placed Pods based on real-time load, it would risk overloading nodes during spikes. `requests` is a stable promise made at scheduling time: the scheduler can plan ahead without being surprised by sudden surges. The node knows it has committed that much capacity, regardless of what the container is doing at any given second.
:::

You now have a clear picture of the three most important fields in a Pod spec. In the next lesson, you will write this manifest to a file, apply it to the simulated cluster, and watch the Pod move through its lifecycle in real time.
