---
seoTitle: 'Kubernetes ServiceAccount Practical Scenarios, Least Privilege'
seoDescription: 'Apply ServiceAccount concepts to two real scenarios: a monitoring agent that needs API access and a web app that should never carry API credentials. Includes a cluster-admin risk case.'
---

# ServiceAccount Practical Scenarios

Theory is clear. Now look at two concrete scenarios where ServiceAccount design decisions have real security consequences. The first is a workload that genuinely needs Kubernetes API access. The second is a workload that never should.

## Scenario A: a monitoring agent

A metrics-collection agent runs in your simulated cluster. Its job is to scrape metrics from Pods across all namespaces. To build its list of targets, it calls the Kubernetes API to list Pods. It needs a dedicated ServiceAccount so you can attach exactly the right permissions to it and nothing more.

Create the ServiceAccount.

```bash
kubectl create serviceaccount monitoring-agent
```

Verify it appears in the list alongside `default`.

```bash
kubectl get serviceaccounts
```

@@@
graph TB
  subgraph agentApp ["Monitoring workload"]
    SA1["ServiceAccount\nmonitoring-agent"]
    P1["Pod\nmonitoring-agent-pod"]
  end
  subgraph webApp ["Web workload"]
    SA2["ServiceAccount\nweb-app"]
    P2["Pod\nweb-pod"]
  end
  API["API Server\n(RBAC per identity)"]
  P1 --> SA1
  SA1 --> API
  P2 --> SA2
@@@

The next step in a real workflow would be to create a ClusterRoleBinding connecting `monitoring-agent` to a ClusterRole that allows listing Pods. RBAC is covered in its own module. What matters here is that the identity is isolated: only the monitoring agent Pod carries this SA, so only it can ever receive those permissions.

Write the manifest for the agent Pod.

```bash
nano agent-pod.yaml
```

```yaml
# agent-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: monitoring-agent-pod
  namespace: default
spec:
  serviceAccountName: monitoring-agent
  containers:
  - name: agent
    image: nginx:stable
```

```bash
kubectl apply -f agent-pod.yaml
```

:::quiz
You created a ServiceAccount called `monitoring-agent`. Without any RBAC bindings, what happens when the agent Pod tries to list Pods via the API?

**Answer:** The request is denied with a 403 Forbidden response. The SA identity is valid, but the API server's authorization layer finds no RoleBinding or ClusterRoleBinding granting that identity the right to list Pods. Identity and permission are always separate concerns.
:::

## Scenario B: a stateless web application

Your second workload serves HTTP responses to users. It reads from a database and has no reason to call the Kubernetes API. Mounting a token into this Pod is unnecessary exposure.

Create a dedicated ServiceAccount for it.

```bash
kubectl create serviceaccount web-app
```

Write the manifest with automount disabled.

```bash
nano web-pod.yaml
```

```yaml
# web-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-pod
  namespace: default
spec:
  serviceAccountName: web-app
  automountServiceAccountToken: false
  containers:
  - name: web
    image: nginx:stable
```

```bash
kubectl apply -f web-pod.yaml
```

This Pod has an identity (`web-app`) but carries no token in its filesystem. If the container is ever compromised, the attacker finds no API credential to escalate with.

:::quiz
Why assign a dedicated `web-app` ServiceAccount at all, if you are just going to disable automount? Why not use `default` with automount disabled?

**Answer:** Because identity isolation matters independently of token presence. If you later add a RoleBinding for the `default` SA, the web Pod's identity would inherit those permissions. A dedicated SA per application means that permissions are always tied to a specific identity, and a mistake in one binding cannot silently expand the attack surface of unrelated Pods.
:::

## Confirming both ServiceAccounts exist

Describe each SA to confirm their presence and configuration.

```bash
kubectl describe serviceaccount monitoring-agent
```

```bash
kubectl describe serviceaccount web-app
```

Both should show the correct namespace, no unexpected token Secrets, and the details Kubernetes recorded at creation time.

## The risk of an overpermissioned default ServiceAccount

Here is the failure pattern worth internalizing. Suppose a developer is debugging a RBAC issue and temporarily grants `cluster-admin` to the `default` ServiceAccount in a namespace.

:::warning
Every Pod in that namespace that does not declare an explicit `serviceAccountName` is now running with cluster-admin permissions. A single compromised container in any of those Pods gives an attacker full control of the cluster. This is not a contrived scenario. It happens in environments where RBAC is treated as a debugging convenience rather than a security boundary. One dedicated ServiceAccount per application, combined with least-privilege RBAC bindings, makes this class of mistake impossible to propagate silently.
:::

The principle is consistent across both scenarios: isolate identities by application, grant only what is needed, and disable automount for workloads that have no reason to authenticate to the API.

Lesson 05 closes the module by explaining the difference between old-style token Secrets and the modern projected token system, and why the newer approach eliminates an entire category of credential-theft risk.
