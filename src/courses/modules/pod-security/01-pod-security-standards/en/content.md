---
seoTitle: 'Kubernetes Pod Security Standards: Privileged, Baseline, Restricted'
seoDescription: 'Understand the three Pod Security Standard profiles in Kubernetes: privileged, baseline, and restricted, and how they replace the deprecated PodSecurityPolicy.'
---

# Pod Security Standards

You have learned how to set security contexts on individual Pods. But what prevents a developer from creating a privileged Pod in a production namespace? Manually reviewing every Pod spec is not scalable. **Pod Security Standards (PSS)** define cluster-wide security profiles that Kubernetes can enforce automatically.

## Three profiles, three risk levels

PSS defines exactly three profiles. Each profile is a named set of rules about which security context fields a Pod is and is not allowed to use. Before reading the definitions, look at how they relate to each other.

@@@
graph TD
    P["privileged\nNo restrictions\nFull host access, any capability"]
    B["baseline\nBlocks known privilege escalations\nNo hostPID, hostIPC, no privileged containers"]
    R["restricted\nMaximum hardening\nrunAsNonRoot, drop ALL caps, seccomp required"]
    P -->|stricter| B
    B -->|stricter| R
@@@

The `privileged` profile imposes no restrictions. A Pod at this level can use `hostPID`, `hostIPC`, set `privileged: true` on any container, and request any Linux capability. This level is reserved for trusted infrastructure components, like CNI plugins or node monitoring agents, that genuinely need host-level access.

The `baseline` profile blocks the most dangerous misconfigurations while staying compatible with most production workloads. It disallows privileged containers, host namespace sharing (`hostPID`, `hostIPC`, `hostNetwork`), and the most dangerous Linux capabilities. An application running as root is still allowed under `baseline`. This is the minimum recommended level for any shared namespace.

The `restricted` profile is the strictest. It requires `runAsNonRoot: true`, drops all Linux capabilities, prohibits privilege escalation, and requires a seccomp profile. Most well-designed containerized applications can meet these requirements with a small amount of configuration.

:::quiz
A Pod uses `securityContext.privileged: true`. Which PSS profile(s) allow it?

- `privileged` and `baseline`
- Only `privileged`
- All three profiles

**Answer:** Only `privileged`. The `baseline` profile explicitly disallows privileged containers. `restricted` goes even further, requiring non-root execution and dropped capabilities.
:::

## PSS does not add fields, it checks them

An important distinction: PSS does not inject any `securityContext` configuration into your Pods. It reads what is already in the spec and decides whether that spec is compliant. If a field is omitted entirely, PSS uses the Kubernetes default for that field when evaluating. An omitted `privileged` field defaults to `false`, so it passes `baseline`. An omitted `runAsNonRoot` field defaults to `false`, so it fails `restricted`.

Start by inspecting the simulated cluster's namespaces to see their current state:

```bash
kubectl get namespaces
```

```bash
kubectl describe namespace default
```

The `Labels` section of the output is where PSS enforcement labels appear. A namespace with no PSS labels is unconstrained, meaning any Pod spec is accepted. This is the default state of every namespace unless you label it explicitly.

```bash
kubectl get namespace default -o yaml
```

The YAML output shows the `metadata.labels` field. On a fresh namespace, this section is empty or absent. Once PSS labels are applied, they appear here and become the binding signal for the admission controller.

:::info
PSS is a specification, a document that defines what each profile allows and disallows. The mechanism that reads those labels and acts on them is called Pod Security Admission, which is covered in the next lesson. Understanding the profiles first means you can reason about enforcement without conflating the two concepts.
:::

## Why PSS replaced PodSecurityPolicy

PSS was designed as the successor to **PodSecurityPolicy (PSP)**, which was removed in Kubernetes 1.25. PSP had the same goal but was notoriously difficult to configure correctly. Granting a PSP to a Pod required coordinating a RBAC binding, a ServiceAccount, and the policy object itself. A misconfigured binding could silently leave Pods unprotected, with no obvious error. Auditing which workloads were covered by which policy was painful.

PSS simplifies this entirely. A single label on a namespace controls the profile for every Pod in that namespace. There is no binding chain to trace, no ServiceAccount coordination required.

:::warning
If you are preparing for the CKA exam on a cluster running Kubernetes 1.24 or earlier, PSP may still be present. On any cluster running 1.25 or later, PSP is gone. PSS and Pod Security Admission are the current model. The exam environment specifies the Kubernetes version, so check it before assuming which system is active.
:::

:::quiz
What is the key difference between how PSS is applied versus how PodSecurityPolicy worked?

**Answer:** PSS enforcement is namespace-scoped and label-driven. You apply a label to a namespace and the built-in admission controller enforces that profile for every Pod in that namespace. PSP required explicit RBAC bindings between ServiceAccounts and policy objects, which was error-prone and harder to audit. PSS is simpler and the coverage is unambiguous.
:::

PSS gives you a shared vocabulary: three named risk levels, each with a precise and documented set of rules. The next step is understanding how Kubernetes actually applies those rules at admission time.
