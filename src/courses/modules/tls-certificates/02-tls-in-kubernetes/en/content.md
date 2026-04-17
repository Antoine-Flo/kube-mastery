---
seoTitle: 'How Kubernetes Uses TLS, PKI Layout, Certificate Paths, kubeadm'
seoDescription: 'Understand the Kubernetes PKI topology: which certificates each component holds, where they live on the control plane node, and what happens when they expire.'
---

# How Kubernetes Uses TLS

Kubernetes is not a single binary. It is a cluster of components, each talking to others over the network: `kubectl` talking to the API server, the API server talking to etcd, the kubelet talking back to the API server, the scheduler and controller manager calling the API server to watch resources. Every one of those connections is protected by TLS. That means every component has its own certificate and key pair.

## The cluster CA: the root of all trust

At the center of the Kubernetes PKI is the **cluster CA**. When you bootstrap a cluster with `kubeadm`, it generates this CA and stores it on the control plane node at `/etc/kubernetes/pki/ca.crt` (public cert) and `/etc/kubernetes/pki/ca.key` (private key). Every other certificate in the cluster is signed by this CA.

@@@
graph TD
    CA["Cluster CA\n/etc/kubernetes/pki/ca.crt"]
    API["kube-apiserver cert\napiserver.crt"]
    KubeletClient["kubelet client cert\nkubelet.crt"]
    Etcd["etcd client cert\napiserver-etcd-client.crt"]
    CM["controller-manager cert\ncontroller-manager.crt"]
    Sched["scheduler cert\nscheduler.crt"]

    CA -->|signs| API
    CA -->|signs| KubeletClient
    CA -->|signs| Etcd
    CA -->|signs| CM
    CA -->|signs| Sched
@@@

```bash
kubectl get pods -n kube-system
```

Each pod listed there is a control plane component that holds its own certificate, signed by the cluster CA. The API server, the scheduler, the controller manager, all of them participate in the PKI topology shown above. None of them would appear here if their certificates were invalid or the CA trust chain were broken.

## The kube-apiserver certificate

The API server acts as the central hub. Every other component connects to it. So the API server needs a **server certificate** that all clients can verify. This certificate must list every name and IP address that clients might use to reach the API server: the node's internal IP, `kubernetes`, `kubernetes.default`, `kubernetes.default.svc`, and the cluster's external endpoint if any. These entries are called Subject Alternative Names (SANs).

:::warning
If the API server's certificate does not include the IP or hostname a client uses to connect, TLS verification fails even if the certificate is otherwise perfectly valid. You will see an error like `x509: certificate is valid for 10.96.0.1, not 192.168.1.5`. The fix is to regenerate the certificate with the correct SANs included.
:::

## Kubelet client certificates

Each kubelet needs to prove its identity to the API server. It does this using a **client certificate**, signed by the cluster CA, with a subject like `CN=system:node:node-name, O=system:nodes`. The CN and O fields are not arbitrary: they map directly to a Kubernetes username and group used for RBAC authorization. (The RBAC rules themselves are covered in the RBAC module.)

```bash
kubectl get nodes
```

Each node that appears in that list is a kubelet that has successfully authenticated to the API server with its client certificate. A kubelet with an expired or missing certificate cannot register, and its node disappears from the list.

:::quiz
Which of the following describes why each kubelet has its own unique certificate?

- All kubelets share a single certificate so the API server only needs one trusted entry
- Each kubelet has its own certificate so the API server can identify which specific node is making the request
- The kubelet uses the same certificate as the kube-controller-manager to reduce the number of secrets

**Answer:** Each kubelet has its own certificate so the API server can identify which node is making the request. The CN field (`system:node:<node-name>`) embeds the node's identity. A shared certificate would make individual node authorization impossible.
:::

## etcd and the API server's client certificate

The API server is a client to etcd: it reads and writes cluster state there. That connection also requires TLS. The API server holds a separate **etcd client certificate** (`apiserver-etcd-client.crt`), signed by the etcd CA (which may be the same cluster CA or a separate one). etcd checks that certificate before allowing any reads or writes.

etcd also has its own server certificate for incoming connections. This layering matters: etcd is the single source of truth for all cluster state. It accepts connections from almost nobody, only the API server.

## The front-proxy CA

There is one more CA to know: the **front-proxy CA**, used for the API aggregation layer. When you install an extension API server (like the metrics-server), the main API server proxies requests to it and authenticates with a front-proxy certificate. This CA is separate from the cluster CA so that aggregation layer trust is isolated from core component trust.

:::quiz
If `kubectl get nodes` returns "Unable to connect to the server: x509: certificate has expired or is not yet valid", what is the most likely root cause?

**Answer:** One of the certificates in the TLS chain has passed its expiry date. Certificates created by `kubeadm` expire after one year by default. When the API server certificate or the CA certificate expires, every component that verifies it refuses the connection. The fix is to renew the certificates with `kubeadm certs renew`, though that requires access to the control plane node.
:::

## Certificate expiry: the silent failure mode

Certificates created by `kubeadm` expire after **one year**. The cluster does not warn you. Nothing shows a countdown. On day 366, every component that needs to verify a certificate fails simultaneously. The API server becomes unreachable, `kubectl` returns `x509` errors, and the cluster appears completely broken.

This is one of the most common production failures in clusters that are not actively managed. The solution is to renew certificates before they expire, or to set up automatic rotation. In the simulator, all certificates are pre-configured as valid, so you can focus on the concepts.

```bash
kubectl get certificatesigningrequests
```

That command queries the Certificates API, the Kubernetes-native mechanism for requesting and approving certificates without touching the CA private key directly. Even if no CSRs are pending right now, the command confirms that the certificate machinery is reachable, which means the API server's own certificate is valid. Lesson 05 covers this API in full.

Now that you understand which certificates exist and which component uses each one, the next lesson walks through how a client certificate is actually created from scratch, and what information goes into a certificate subject.
