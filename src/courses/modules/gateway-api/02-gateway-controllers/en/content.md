---
seoTitle: 'Envoy Gateway Controller: How Gateway API Is Implemented in Kubernetes'
seoDescription: 'Understand how Envoy Gateway implements Gateway API resources, what the control plane and data plane do, and how reconciliation turns your YAML into live proxy config.'
---

# The Controller Behind the Gateway

You have applied a Gateway manifest and an HTTPRoute. Both resources appear when you run `kubectl get gateway` and `kubectl get httproute`. But when you try to reach your service through the expected hostname, the connection times out. The resources are there, but nothing is routing traffic. This is a common confusion: Kubernetes resources are declarations of intent. Something must read those declarations and act on them. For Gateway API, that something is the controller.

@@@
graph LR
GW["Gateway resource"]
HR["HTTPRoute resource"]
GC["Envoy Gateway\nController"]
EP["Envoy Proxy Pod"]
SVC["Your Service"]

    GW --> GC
    HR --> GC
    GC --> EP
    EP --> SVC

@@@

The controller watches Gateway and HTTPRoute resources in the cluster, translates them into proxy configuration, and applies that configuration to the Envoy data plane. The Envoy Proxy pods are what actually accept network connections and forward traffic to your Services. Without the controller, the proxy never gets configured, and traffic goes nowhere.

Check which GatewayClass is available and whether a controller is active:

```bash
kubectl get gatewayclass
```

The `CONTROLLER` column shows the controller name, and the `ACCEPTED` column confirms that the controller is running and has claimed this class.

## GatewayClass and `controllerName`

The GatewayClass is the link between your resources and the controller. Its `spec.controllerName` is a string the controller recognizes as its own name. When Envoy Gateway starts, it scans for GatewayClass resources where `controllerName` matches `gateway.envoyproxy.io/gatewayclass-controller`. It takes ownership of all Gateway resources that reference those classes.

Why does Kubernetes use this indirection instead of naming a controller directly in the Gateway manifest? Because it allows multiple controllers to run in the same cluster without conflict. An nginx-based controller and an Envoy-based controller can coexist peacefully, each owning a different GatewayClass and ignoring the other's resources entirely.

```bash
kubectl describe gatewayclass eg
```

Look at the `Status.Conditions` section. A condition of type `Accepted` with status `True` means the controller is live and has taken ownership of this class.

:::quiz
You deploy two controllers in the same cluster, each with a different `controllerName`. You create a GatewayClass with `controllerName: gateway.envoyproxy.io/gatewayclass-controller`. Which controller manages Gateways that reference this class?

**Answer:** Only the Envoy Gateway controller, because it matches its own controller name exactly. The other controller ignores any GatewayClass whose `controllerName` it does not recognize.
:::

## The Reconciliation Loop

The controller does not configure Envoy just once at startup. It runs a continuous reconciliation loop: it watches for any changes to Gateway and HTTPRoute resources, and every time something changes, it recomputes the full proxy configuration and pushes it to Envoy. This means your updates take effect within seconds without any manual restart of the proxy.

```bash
kubectl get gateway
```

The `PROGRAMMED` column tells you whether the controller has successfully applied the current state to the data plane. If it reads `True`, Envoy is configured and ready. If it reads `False`, inspect the Gateway conditions:

```bash
kubectl describe gateway my-gateway
```

The `Status.Conditions` section explains why the Gateway is not yet programmed: a missing listener definition, an unresolved certificate reference, or no HTTPRoutes attached. Each condition includes a human-readable `Message` field.

:::quiz
A Gateway shows `PROGRAMMED: False`. What is the first command you would run to understand why?

**Try it:** `kubectl describe gateway my-gateway`

**Answer:** Look at the `Status.Conditions` section in the output. Each condition has a `Reason` and a `Message` field that explain what is blocking the controller from programming the proxy.
:::

:::info
In the simulated cluster, Envoy Gateway is pre-configured. A GatewayClass named `eg` is available by default with `ACCEPTED: True`. You can create Gateway and HTTPRoute resources referencing it immediately, without installing any additional components.
:::

:::warning
If you change the `controllerName` of an existing GatewayClass, all Gateways already referencing that class become orphaned. The original controller stops reconciling them because the name no longer matches, and unless another controller claims the new name, those Gateways stop being programmed and traffic stops flowing.
:::

The controller is the invisible engine of Gateway API. Without it, GatewayClass and Gateway resources sit inert in the cluster. With it running, every change you make to a Gateway or HTTPRoute triggers a reconciliation cycle that updates the live proxy configuration within seconds. Understanding where to look when that cycle stalls, starting with `kubectl describe gateway`, is the most practical debugging skill in this setup.
