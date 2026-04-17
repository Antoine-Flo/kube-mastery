---
seoTitle: 'Enable and Disable Kubernetes Admission Controllers, kube-apiserver Flags'
seoDescription: 'Learn how to enable and disable Kubernetes admission controllers using kube-apiserver flags, and how to inspect them on kubeadm clusters.'
---

# Enabling and Disabling Admission Controllers

Imagine you just discovered that Pods in a namespace have no resource limits. You want `LimitRanger` to enforce defaults automatically. You search for a Kubernetes resource to configure it, a ConfigMap, a CRD, anything. There is nothing. Admission controllers are not Kubernetes objects. They are plugins compiled directly into the kube-apiserver binary. To turn one on or off, you must change a flag on the API server process itself.

## The flags that control the plugin list

The kube-apiserver accepts two flags that manage which admission plugins are active.

`--enable-admission-plugins` takes a comma-separated list of plugins to enable in addition to the defaults. If the plugin is already in the default set, listing it here is harmless but redundant.

`--disable-admission-plugins` takes a comma-separated list of plugins to remove from the defaults. This is how you turn off a plugin that would otherwise run automatically.

The two flags work on top of a default set. As of Kubernetes 1.29, the default active plugins include `NamespaceLifecycle`, `LimitRanger`, `ServiceAccount`, `DefaultStorageClass`, `ResourceQuota`, `MutatingAdmissionWebhook`, and `ValidatingAdmissionWebhook`, among others. `MutatingAdmissionWebhook` and `ValidatingAdmissionWebhook` are what make custom webhooks possible. Disabling either one breaks all deployed webhooks immediately.

You can inspect the exact list on the simulated cluster right now:

```bash
kubectl describe pod kube-apiserver-controlplane -n kube-system
```

Scroll to the `Command` section. Each flag appears on its own line. Look for `--enable-admission-plugins` and `--disable-admission-plugins`. The absence of `--disable-admission-plugins` means no defaults have been removed.

:::quiz
A team disabled `MutatingAdmissionWebhook` to troubleshoot a problem and forgot to re-enable it. What breaks immediately?

**Answer:** Every `MutatingWebhookConfiguration` deployed in the cluster stops being called. Webhooks that inject sidecars, set default values, or patch resources silently stop working. Pods get created without the expected mutations, and the team may not notice until something fails at runtime.
:::

## On kubeadm clusters, the API server is a static Pod

On clusters bootstrapped with kubeadm, the kube-apiserver runs as a **static Pod**. Its manifest lives on the control plane node at `/etc/kubernetes/manifests/kube-apiserver.yaml`. The kubelet on that node watches this directory and automatically restarts the API server whenever the file changes.

To add or remove an admission plugin, you would edit that file directly on the control plane node. The change takes effect within a few seconds as the kubelet detects the modification and restarts the Pod.

Below is an illustrative snippet of what that manifest looks like:

```yaml
# illustrative only
spec:
  containers:
    - command:
        - kube-apiserver
        - --enable-admission-plugins=NodeRestriction,PodSecurity
        - --disable-admission-plugins=DefaultStorageClass
```

`NodeRestriction` is a common plugin to enable explicitly. It limits what a kubelet can modify on the API server, preventing a compromised node from escalating privileges by editing other nodes' objects.

:::warning
In the simulated cluster, you cannot edit the kube-apiserver manifest. The control plane is emulated and does not expose `/etc/kubernetes/manifests/`. This lesson is about understanding the configuration model, not about modifying the simulator's control plane. On a real exam node with kubeadm, this file is exactly where you would go.
:::

## Checking what is actually active

Inspecting the Pod spec is the most reliable way to see the active plugin list. The API server does not expose its active plugins through a dedicated API endpoint.

```bash
kubectl get pods -n kube-system
```

On any kubeadm cluster, you will see `kube-apiserver-<nodename>`. The name suffix matches the node hostname. In the simulator, the node is named `controlplane`.

```bash
kubectl describe pod kube-apiserver-controlplane -n kube-system
```

:::info
Some managed Kubernetes providers (GKE, EKS, AKS) do not let you modify API server flags at all. The control plane is fully managed. You can still use webhooks, because `MutatingAdmissionWebhook` and `ValidatingAdmissionWebhook` are always enabled on managed clusters, but you cannot enable obscure built-in plugins that are not in the default set.
:::

@@@
flowchart TD
  F["/etc/kubernetes/manifests/kube-apiserver.yaml"] --> K["kubelet detects change"]
  K --> R["kube-apiserver Pod restarts"]
  R --> P["New plugin list active"]
  P --> AC["Admission controllers run\nwith updated config"]
@@@

:::quiz
A team needs to enforce resource limits on all Pods in a namespace. Which admission controller should be enabled, and what object must exist in the namespace for it to work?

**Answer:** `LimitRanger` enforces default limits. You must also create a `LimitRange` object in the namespace that defines the default values. Without the `LimitRange` object, `LimitRanger` has nothing to read and does nothing, even if the plugin is listed in `--enable-admission-plugins`.
:::

Admission controllers are binary: on or off, configured at the API server level, not per namespace or per object. The next lesson moves beyond built-in plugins to custom enforcement logic. Validating admission webhooks let you call an external HTTPS service to approve or reject any resource creation, with rules you define entirely yourself.
