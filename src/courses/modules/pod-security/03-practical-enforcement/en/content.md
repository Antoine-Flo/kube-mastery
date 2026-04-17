---
seoTitle: 'Practical PSS Enforcement: Namespace Strategy and Safe Migration'
seoDescription: 'Design a Pod Security Standard enforcement strategy for production, dev, staging, and system namespaces, including safe migration from PodSecurityPolicy.'
---

# Practical PSS Enforcement

You are setting up a simulated cluster for a team. You need production namespaces locked down, development namespaces more permissive, and system namespaces exempt from restrictions. How do you design a PSS enforcement strategy that works for the whole cluster without breaking what is already running?

## Namespace strategy by environment

The answer starts with recognizing that different namespaces have genuinely different security requirements. A namespace running control plane infrastructure has nothing in common with one running a user-facing web service. Apply the diagram below as a starting point, then adjust for your team's specific workloads.

@@@
graph TD
    S["kube-system, kube-public\nenforce: privileged\nControl plane components need host access"]
    P["production\nenforce: baseline\nwarn: restricted"]
    ST["staging\nenforce: baseline\nwarn: restricted"]
    D["dev\nwarn: restricted\nVisibility without blocking"]
    S ~~~ P
    P ~~~ ST
    ST ~~~ D
@@@

System namespaces like `kube-system` must use `privileged` because control plane components, the CNI plugin and kube-proxy DaemonSet among others, require host-level access. Labeling `kube-system` with `enforce: restricted` breaks the cluster. For production, `enforce: baseline` is the minimum. If your applications are designed without host access or excessive capabilities, consider `enforce: restricted`. Development namespaces benefit from `warn: restricted` rather than hard enforcement, giving developers early feedback without blocking their iteration.

```bash
kubectl get namespace kube-system --show-labels
```

Inspect `kube-system` in the simulated cluster. Notice that it carries no PSS labels by default. This means the admission controller applies no restrictions to it, which is the intended behavior for a system namespace.

## Migration: audit first, then warn, then enforce

If you inherit a cluster with existing workloads, do not start with `enforce`. Start with `audit`, which records violations without blocking anything. Then add `warn` so developers see the messages in their kubectl output. Only after the team has resolved the violations do you switch to `enforce`.

```bash
kubectl label namespace production pod-security.kubernetes.io/audit=restricted
```

```bash
kubectl label namespace production pod-security.kubernetes.io/warn=restricted
```

```bash
kubectl label namespace production pod-security.kubernetes.io/enforce=baseline
```

The sequence gives visibility, then pressure, then enforcement. `audit` and `warn` are your observation period. `enforce` is the commitment.

:::quiz
A team wants to start using PSS but is worried about breaking existing workloads. What is the safest first step?

**Answer:** Apply `audit` and `warn` modes before `enforce`. The `audit` mode records violations without blocking anything. The `warn` mode shows messages directly in kubectl output. This gives the team a full picture of what would break before any enforcement kicks in. Start observing, then decide.
:::

## Verifying namespace state

After applying labels, always verify the result before assuming it took effect:

```bash
kubectl get namespace production --show-labels
```

```bash
kubectl describe namespace production
```

The `Labels` section in the `describe` output lists every PSS label with its current value. This is the authoritative view of what enforcement is active on a namespace. Cross-check this whenever a workload is behaving unexpectedly after a labeling change.

## Identifying violations in existing workloads

Even with careful planning, switching to `restricted` sometimes reveals that a Deployment cannot create new Pods. The violation does not delete existing Pods, but the next time the ReplicaSet tries to replace one, for example after a rolling update or a node drain, the admission controller rejects the new Pod.

```bash
kubectl get pods -n production
```

Look for Pods stuck in a `Pending` state or a ReplicaSet showing fewer Pods than desired. Then inspect the specific Pod:

```bash
kubectl describe pod bad-pod -n production
```

The `Events` section at the bottom of the output shows the admission rejection message. It names the specific field that violates the profile, for example `runAsNonRoot is required` or `must not set securityContext.allowPrivilegeEscalation=true`. That message is your actionable signal for which field to fix in the workload's securityContext.

:::warning
A common trap: you enforce `restricted` on a namespace, and a pre-existing Deployment appears healthy because its current Pods are still running. Only when those Pods are replaced, during a rolling update, a crash, or a node drain, does the enforcement kick in and block the new Pods. Always validate enforcement by creating a fresh test Pod immediately after labeling. Do not rely on existing Pods as evidence that everything is fine.
:::

:::quiz
You enforce `restricted` on a namespace. A Deployment has been running for three days with `runAsNonRoot` absent from its spec. You trigger a rolling update. What happens?

**Answer:** The ReplicaSet tries to create new Pods with the updated spec. The admission controller rejects each one because `runAsNonRoot` is not set, which is required under `restricted`. The rolling update stalls. The Deployment shows fewer available Pods than desired. The Events on the failing Pods show the specific PSA violation message. This is why auditing before enforcing is not optional: it is the only way to discover this class of problem without causing an outage.
:::

## Exemptions for components that cannot comply

Some workloads genuinely cannot meet the target profile. Monitoring agents, log collectors, and network plugins often need capabilities or host access that `restricted` prohibits. PSA supports exemptions via the kube-apiserver configuration file, where specific namespaces, usernames, or RuntimeClass names can be excluded from PSA enforcement. Configuring the API server is outside the scope of the simulator, but understanding that exemptions exist prevents the false assumption that PSS must apply uniformly to every workload in the cluster. The exemption mechanism lets you enforce broadly while carving out specific, auditable exceptions.

You have now covered the full Security and Authentication section of the CKA curriculum. Authentication establishes identity, ServiceAccounts carry that identity inside the cluster, TLS secures every communication path, and RBAC decides what each identity is authorized to do. Security Contexts harden individual containers, image security controls what code enters the cluster, Admission Controllers gate every API request, and Pod Security Standards enforce a consistent security posture across entire namespaces. These layers are not independent features. They are a coordinated defense in depth: each layer assumes the others may be bypassed or misconfigured, and compensates accordingly. A cluster that applies all of them systematically is one where a single misconfiguration cannot escalate into a full compromise.
