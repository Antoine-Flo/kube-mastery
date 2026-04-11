---
seoTitle: 'Debugging Kubernetes DNS, CoreDNS, nslookup, resolv.conf'
seoDescription: 'Learn how to systematically debug DNS failures in Kubernetes by checking CoreDNS health, verifying Service endpoints, and testing resolution from inside Pods.'
---

# DNS Debugging

Your application logs print `could not resolve host web-svc`. The Service exists, the Pods are running, but the name does not resolve. DNS failures are among the most frustrating issues in Kubernetes because the error message rarely tells you what is actually wrong. A systematic approach turns a guessing game into a short checklist.

## The debug decision tree

Before running any commands, it helps to have a mental model of the DNS resolution path and where it can break.

@@@
graph TD
    Start["DNS resolution fails"] --> A["Is CoreDNS running?"]
    A --> |No| FixCoreDNS["Check CoreDNS Pods in kube-system"]
    A --> |Yes| B["Does the Service exist in the right namespace?"]
    B --> |No| CreateSvc["Create the Service or use the correct namespace"]
    B --> |Yes| C["Does the Service have Endpoints?"]
    C --> |No| FixSelector["Fix selector or deploy matching Pods"]
    C --> |Yes| D["Are you using the right name form?"]
    D --> |No| UseFQDN["Use qualified name: svc.namespace or FQDN"]
    D --> |Yes| Resolved["Failure is at the application or network layer"]
@@@

Each node corresponds to a concrete command you can run right now. Work through them in order.

## Step 1: verify CoreDNS is running

CoreDNS is the foundation. If it is not running, no name in the cluster resolves. Check it first:

```bash
kubectl get pods -n kube-system
```

You should see Pods with `coredns` in their name in the `Running` state. In the simulated cluster, CoreDNS is started during bootstrap, so this step tells you whether the system services are healthy. A Pod in `CrashLoopBackOff` here means DNS is completely broken for all workloads.

:::quiz
CoreDNS is running and healthy but DNS still fails for your application. What is your next step?

- Restart the failing application Pod
- Check that the Service exists in the correct namespace
- Scale up the CoreDNS Deployment

**Answer:** Check that the Service exists in the correct namespace. A healthy CoreDNS cannot resolve a Service that does not exist, or one that lives in a different namespace than expected.
:::

## Step 2: verify the Service exists and has Endpoints

A Service can exist in DNS without any working backend. This happens when the label selector in the Service does not match any running Pods. CoreDNS always registers the A record for the Service's ClusterIP, but traffic has nowhere to go.

First confirm the Service exists and note its ClusterIP:

```bash
kubectl get service web-svc
```

Then inspect its Endpoints:

```bash
kubectl describe service web-svc
```

Scroll to the `Endpoints` field. If it shows `<none>`, the selector matches no running Pods. The DNS name resolves correctly, but TCP connections to that IP will time out.

:::warning
A Service with no Endpoints does not cause a DNS failure. The name resolves to the ClusterIP, but connecting to it will hang. If your application reports a connection timeout rather than "unknown host", check Endpoints first. DNS and routing are independent layers.
:::

:::quiz
You run `kubectl get service api` and the Service exists. Then `kubectl describe service api` shows `Endpoints: <none>`. What is the most likely cause?

**Answer:** The Service selector does not match any running Pod labels. Either the Pods are not running, or there is a label mismatch, for example the selector uses `app: api` but the Pods have `app: api-server`. Fix the selector or the Pod labels to make them match.
:::

## Step 3: test name resolution with nslookup

Once you know CoreDNS is up and the Service exists, test DNS resolution directly. Start with the short name:

```bash
nslookup web-svc
```

In the simulated cluster, `nslookup` queries the DNS simulation layer. If the Service exists in the current namespace, you get back its ClusterIP. If it fails, try the namespace-qualified name:

```bash
nslookup web-svc.default
```

And if that also fails, try the full FQDN:

```bash
nslookup web-svc.default.svc.cluster.local
```

Moving from short name to FQDN isolates namespace confusion. If the FQDN resolves but the short name does not, you are querying from a different namespace than where the Service lives.

:::quiz
`nslookup web-svc` fails, but `nslookup web-svc.default` succeeds. What does this tell you?

**Answer:** The query is coming from a Pod in a namespace other than `default`. The short name `web-svc` is expanded using the current namespace's search domain, which does not include `default`. Use the namespace-qualified form or the full FQDN when crossing namespace boundaries.
:::

## Step 4: reproduce a broken selector to understand the layers

The best way to understand the difference between a DNS failure and a connectivity failure is to create one intentionally. Create a Service whose selector will not match any Pod:

```bash
kubectl create service clusterip broken-svc --tcp=80:80
```

This Service gets the selector `app: broken-svc` by default. Unless you have a Pod with exactly that label, the Endpoints list is empty. Verify:

```bash
kubectl describe service broken-svc
```

The `Endpoints` field shows `<none>`. Now resolve the name:

```bash
nslookup broken-svc
```

Resolution succeeds. CoreDNS returns the ClusterIP. The DNS layer works. But any TCP connection to that IP will time out because there is no backend. This is the most common source of confusion: developers see a successful DNS lookup and assume the Service is healthy, when the actual problem is a selector mismatch.

:::warning
In the simulated cluster, `nslookup` queries the simulated DNS layer. If the Service does not exist, resolution fails exactly as it would on a real cluster. If the Service exists but has no Endpoints, resolution still succeeds. The failure surfaces at the connection layer, not the DNS layer.
:::

Now fix the broken Service by deleting it and creating one with a selector that actually matches a running Pod. First check what Pods and labels are available:

```bash
kubectl get pods --show-labels
```

Can you construct a `kubectl expose` command that creates a Service targeting one of those Pods? Use the labels you see in the output to make the selector match.

:::quiz
You create a Service but accidentally omit the `selector` field entirely. `nslookup` returns an IP. Your application still cannot connect. What should you check?

**Try it:** `kubectl describe service broken-svc`

**Answer:** Look at the `Endpoints` field. Without a selector, the Service has no Endpoints and no routing target. DNS resolves because the ClusterIP was assigned. Fix by adding a selector that matches your Pods, or by manually creating an Endpoints object pointing to the Pod IPs.
:::

DNS debugging in Kubernetes always follows the same four steps: confirm CoreDNS is healthy, confirm the Service exists in the right namespace, test resolution from short name to FQDN, then inspect Endpoints to separate DNS failures from connectivity failures. Most issues that look like DNS problems are actually namespace confusion or selector mismatches.
