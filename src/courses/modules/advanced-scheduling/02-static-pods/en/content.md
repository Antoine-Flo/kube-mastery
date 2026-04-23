---
seoTitle: 'Kubernetes Static Pods, kubelet Managed Pods, Control Plane Bootstrap'
seoDescription: 'Learn what Kubernetes static pods are, how the kubelet manages them directly from manifest files, and why control plane components like etcd and the API server run as static pods.'
---

# Static Pods

The API server is not running. The kube-scheduler is not running. The controller manager is not running. Who starts them?

Static Pods are the answer. They are Pod manifests placed in a directory on the node's filesystem. The kubelet watches this directory directly and starts, restarts, and stops Pods based on what it finds there, without any API server involvement. This is how Kubernetes bootstraps its own control plane.

## Where static Pods live

The kubelet's static Pod directory is configured by the `--staticPodPath` flag in the kubelet configuration. On kubeadm clusters, the default is `/etc/kubernetes/manifests/`.

```bash
kubectl get pods -n kube-system
```

The control plane Pods you see here (`kube-apiserver-<node>`, `etcd-<node>`, `kube-scheduler-<node>`, `kube-controller-manager-<node>`) all have the node name suffixed to their names. This naming convention signals that they are static Pods, owned by the kubelet on that specific node.

In the simulated cluster:

```bash
kubectl describe pod kube-apiserver-sim-control-plane -n kube-system
```

Look at the `Controlled By` field. For a static Pod, it shows `Node/sim-control-plane`. A regular Pod shows a ReplicaSet or DaemonSet. The Node controller is the kubelet itself.

## Creating a static Pod

To create a static Pod, you place a manifest file in the staticPodPath directory. The kubelet detects the new file and starts the Pod automatically.

In the simulator, the static Pod directory path is `/etc/kubernetes/manifests/`. Create a manifest there:

```bash
nano /etc/kubernetes/manifests/my-static-pod.yaml
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-static-pod
  namespace: default
spec:
  containers:
    - name: static-app
      image: busybox:1.36
      command: ['sh', '-c', 'sleep 3600']
```

The kubelet detects the file and creates the Pod. Within seconds:

```bash
kubectl get pods
```

You see `my-static-pod-sim-control-plane` (with the node name suffix). Note that the Pod appears in the API server for visibility, but the API server does not manage it. The kubelet manages it.

:::quiz
You try to delete a static Pod with `kubectl delete pod my-static-pod-sim-control-plane`. What happens?

**Answer:** The kubelet immediately recreates it. The source of truth for a static Pod is the manifest file on the node's filesystem, not the API server. Deleting the Pod object in the API server tells the kubelet to stop the Pod, but the kubelet then re-reads the manifest file and starts it again. To permanently remove a static Pod, you must delete (or move) the manifest file.
:::

## Static Pods vs DaemonSets

@@@
graph TB
subgraph static ["Static Pod"]
  SP["Manifest file\n/etc/kubernetes/manifests/"]
  KUB["kubelet reads directly\nno scheduler\nno API server needed"]
  SP --> KUB
end
subgraph daemonset ["DaemonSet"]
  DS["DaemonSet object\nin API server"]
  DSC["DaemonSet controller\ncreates Pods"]
  SCHED["Scheduler places\nPods on nodes"]
  DS --> DSC --> SCHED
end
@@@

Static Pods run without API server involvement. DaemonSets require a running API server and scheduler. Static Pods are for bootstrapping scenarios where the API server is not yet available or must not be the arbiter of whether the Pod runs.

Use DaemonSets for user workloads that should run on every node. Use static Pods for critical infrastructure that must survive API server outages or that must start before the API server itself.

:::warning
Modifying a static Pod is done by editing the manifest file directly on the node, not with `kubectl edit`. Changes to the file cause the kubelet to recreate the Pod automatically. `kubectl edit pod` on a static Pod shows you the current state but any changes you save will be reverted by the kubelet's re-read of the manifest file.
:::

## The control plane bootstrap sequence

This is the key insight for the CKA: the kubelet starts first (as a system service), reads `/etc/kubernetes/manifests/`, and starts the control plane components as static Pods. Only after etcd and the API server are running can the rest of the cluster initialize.

```bash
kubectl get pod etcd-sim-control-plane -n kube-system -o yaml
```

Look at `metadata.ownerReferences`. The owner is the Node, confirming static Pod status. The etcd Pod is managed entirely by the kubelet on the control plane node.

:::quiz
A control plane node's API server is in a crash loop. You want to check its startup arguments. Where do you look?

**Answer:** `/etc/kubernetes/manifests/kube-apiserver.yaml` on the control plane node. The API server runs as a static Pod. Its manifest file is the source of truth for its configuration, including all startup flags. You can read it with `cat` even while the API server is down. To fix the startup issue, edit this file: the kubelet will restart the Pod with the new configuration.
:::

```bash
rm /etc/kubernetes/manifests/my-static-pod.yaml
```

The kubelet detects the file removal and terminates the Pod. Static Pods are the foundation of cluster self-hosting. The next lesson covers priority classes, which determine which Pods are evicted first when the cluster runs out of resources.
