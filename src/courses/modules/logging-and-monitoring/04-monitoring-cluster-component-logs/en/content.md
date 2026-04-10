---
seoTitle: Kubernetes Component Logs, API Server, Scheduler, CoreDNS
seoDescription: Learn how to access Kubernetes control plane logs using kubectl logs for static Pods and journalctl for kubelet, with a per-symptom component guide.
---

# Monitoring Cluster Component Logs

Your Pod has been `Pending` for ten minutes. You checked the Events and found `FailedScheduling`, but the message is vague. You want to understand what the scheduler itself was thinking. Or CoreDNS is returning unexpected results and you need to see its internal output. Where do you go?

Kubernetes control plane components are not black boxes. Most of them run as Pods in the `kube-system` namespace, and their logs are accessible using the same `kubectl logs` command you already know.

## Finding the Components

Start by listing what is running in `kube-system`:

```
kubectl get pods -n kube-system
```

You will see familiar names: `coredns`, `kube-scheduler`, `kube-controller-manager`, `kube-apiserver`, and others depending on the cluster. These are the system-level components that keep everything else running.

@@@
graph TD
    A[kube-system namespace]
    A --> B[kube-scheduler<br/>Places Pods on nodes]
    A --> C[kube-controller-manager<br/>Reconciles state]
    A --> D[kube-apiserver<br/>Serves the API]
    A --> E[coredns<br/>Resolves DNS queries]
@@@

Each of these components writes structured logs to stdout, and kubelet captures them just like any other container. That means you can read them with `kubectl logs` and filter them with `--tail`, `--since`, and `-f`.

## Reading Component Logs

To see CoreDNS logs, which is often the first place to look for DNS resolution problems:

```
kubectl logs -n kube-system -l k8s-app=kube-dns
```

To follow the scheduler logs in real time:

```
kubectl logs -n kube-system -l component=kube-scheduler -f
```

The `-l` flag lets you target Pods by label rather than by exact name, which is useful because component names include the node name as a suffix and vary between clusters.

To inspect a specific component Pod in detail first:

```
kubectl describe pod -n kube-system kube-scheduler-controlplane
```

The describe output gives you the Pod's restart count, resource usage, and recent Events, which can tell you whether the component itself has crashed recently.

:::quiz
CoreDNS seems to be failing silently. Which command lets you follow its logs in real time?

- kubectl logs -n kube-system -l k8s-app=kube-dns -f
- kubectl get events -n kube-system --field-selector reason=DNSFailure
- kubectl describe service -n kube-system kube-dns

**Answer:** `kubectl logs -n kube-system -l k8s-app=kube-dns -f` - the `-l` flag selects CoreDNS Pods by label and `-f` streams new log lines as they appear.
:::

## Static Pods vs Regular Pods

There is a subtle distinction worth understanding. On clusters bootstrapped with kubeadm, `kube-apiserver`, `kube-scheduler`, and `kube-controller-manager` are often static Pods. Static Pods are not stored in etcd and are not managed by the control plane. Instead, kubelet reads their manifests directly from a directory on the node, typically `/etc/kubernetes/manifests/`, and starts them without going through the API server.

@@@
graph LR
    A[kubelet reads<br/>/etc/kubernetes/manifests/] --> B[Starts static Pods]
    B --> C[Appear in<br/>kubectl get pods -n kube-system]
    D[etcd] -. not stored here .-> B
@@@

They appear in `kubectl get pods -n kube-system` because kubelet mirrors their status into the API server, but you cannot delete or reschedule them with kubectl. Changes require editing the manifest file on the node directly.

For your purposes in the simulator, this distinction mostly affects naming: the static Pod for the scheduler on a node named `controlplane` will appear as `kube-scheduler-controlplane`. Knowing this prevents confusion when you search for the Pod and see an unexpected suffix.

:::info
In the simulator, the kube-system components are simulated. `kubectl logs` on these Pods returns representative output that reflects realistic behavior for each component.
:::

## A Symptom-to-Component Guide

Rather than guessing which component to check, use the symptom as your starting point.

If a Pod stays `Pending` and the Events mention `FailedScheduling`, the scheduler was unable to place it. Read the scheduler logs for details about which predicates failed or which nodes were considered.

If DNS resolution fails inside a Pod, CoreDNS is the first place to check. Its logs will show whether it received the query and what it returned.

If a PVC stays `Pending` and never binds to a PersistentVolume, the controller-manager handles that binding logic. Its logs will show whether the binding controller is processing your claim and what is blocking it.

If `kubectl` commands time out or return errors about the API server being unavailable, the API server itself may be struggling. Check its logs if you can still reach it.

:::warning
On a real kubeadm cluster, if the API server is down, `kubectl` does not work at all. You cannot use `kubectl logs` to read the API server's own logs. In that situation you would need to access the node directly and run `journalctl -u kubelet` to see what kubelet reported. This scenario cannot be reproduced in the simulator, but it is important to know for the CKA exam.
:::

:::quiz
You notice that newly created Deployments are not getting their Pods scheduled. Events show no output at all. Which component's logs should you read first, and what command do you use?

**Answer:** The kube-scheduler is responsible for placing Pods. Run `kubectl logs -n kube-system -l component=kube-scheduler --tail=50` to see the most recent scheduling decisions and any errors it encountered.
:::

Control plane logs give you access to the decision-making layer of Kubernetes. Container logs tell you what your app did. Events tell you what Kubernetes observed. Component logs tell you what Kubernetes decided and why. Used together, these three sources cover nearly every debugging scenario you will encounter in practice or on the CKA exam.
