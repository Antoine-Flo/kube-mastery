---
seoTitle: 'Kubernetes Pod DNS, Hostnames, StatefulSets, DNS Policy'
seoDescription: 'Explore how Kubernetes assigns DNS records to Pods, configure stable hostnames for StatefulSets via headless Services, and customize DNS policy and host aliases.'
---

# Pod DNS Records

A ReplicaSet runs three replicas of your database. Each Pod gets a random name like `db-xk7p2` and an IP that changes after every restart. If another application needs to talk to a specific replica rather than any replica, it has no reliable name to use. Services solve the load-balancing case, but when you need to address a specific instance by name, a different mechanism is required.

Kubernetes has two answers: a generic Pod DNS record format and, for StatefulSets, a stable hostname scheme that makes each Pod permanently addressable by name.

## The Pod DNS record format

Every Pod in Kubernetes has a DNS record, but it is built from its IP address rather than its generated name. The format replaces each dot in the IP with a hyphen:

```
<pod-ip-with-hyphens>.<namespace>.pod.cluster.local
```

A Pod with IP `10.244.1.15` in the `default` namespace has the record `10-244-1-15.default.pod.cluster.local`.

Start by looking at current Pod IPs in the simulated cluster:

```bash
kubectl get pods -o wide
```

The `IP` column shows the address assigned to each Pod. From that IP you can form the DNS record manually. Why does Kubernetes use the IP in the name? Because Pod IPs are allocated by the network layer at scheduling time. Encoding the IP in the record lets CoreDNS generate it without maintaining a separate registry of Pod names.

:::warning
Pod DNS records using the IP-hyphen format are almost never used in practice. The IP changes on every restart, which means the DNS record changes too. Use Services to address Pods. Reach for Pod DNS records only when you have no other option.
:::

:::quiz
A Pod has IP `192.168.0.5` in namespace `monitoring`. What is its Pod DNS record?

- `monitoring-192-168-0-5.pod.cluster.local`
- `192-168-0-5.monitoring.pod.cluster.local`
- `monitoring.192-168-0-5.svc.cluster.local`

**Answer:** `192-168-0-5.monitoring.pod.cluster.local` - the pattern is `<ip-with-hyphens>.<namespace>.pod.cluster.local`. The namespace follows the IP segment, and the domain is `.pod.cluster.local`, not `.svc.cluster.local`.
:::

## Stable hostnames with subdomain and hostname

You can give a regular Pod a predictable DNS record by setting two fields in its spec: `hostname` and `subdomain`. When both are set and a headless Service with that subdomain name exists in the same namespace, CoreDNS registers a stable A record:

```
<hostname>.<subdomain>.<namespace>.svc.cluster.local
```

@@@
graph LR
HeadlessSvc["Headless Service\nname: db-internal\nclusterIP: None"] --> Pod0["Pod\nhostname: primary\nsubdomain: db-internal"]
Pod0 --> Record["DNS A record\nprimary.db-internal.default.svc.cluster.local\n-> Pod IP"]
@@@

Why does Kubernetes require a headless Service as the zone anchor? CoreDNS only creates these records when a headless Service with the matching name exists. Without it, the `hostname` and `subdomain` fields in the Pod spec are stored in etcd but produce no DNS entry. The Service acts as the permission mechanism for the DNS zone.

```yaml
# illustrative only
apiVersion: v1
kind: Pod
metadata:
  name: primary
spec:
  hostname: primary
  subdomain: db-internal
  containers:
    - name: db
      image: postgres:15
```

:::quiz
You set `hostname: leader` and `subdomain: cache` on a Pod in namespace `app`. You have a headless Service named `cache` in the same namespace. What DNS name resolves to that Pod?

**Answer:** `leader.cache.app.svc.cluster.local` - the pattern is `<hostname>.<subdomain>.<namespace>.svc.cluster.local`. The headless Service named `cache` acts as the DNS zone anchor without which no record is created.
:::

## StatefulSets and stable DNS

StatefulSets are the most common use case for stable Pod DNS. A StatefulSet assigns each Pod an ordinal index and keeps that index stable across restarts: `db-0`, `db-1`, `db-2`. Combined with a headless Service, each Pod gets a permanent DNS name:

```
<pod-name>.<headless-service>.<namespace>.svc.cluster.local
```

@@@
graph LR
HeadlessSvc["Headless Service\nname: db\nclusterIP: None"] --> Pod0["Pod db-0"]
HeadlessSvc --> Pod1["Pod db-1"]
HeadlessSvc --> Pod2["Pod db-2"]
Pod0 --> DNS0["db-0.db.default.svc.cluster.local"]
Pod1 --> DNS1["db-1.db.default.svc.cluster.local"]
Pod2 --> DNS2["db-2.db.default.svc.cluster.local"]
@@@

Even if `db-1` restarts and gets a new IP, its DNS name `db-1.db.default.svc.cluster.local` continues to resolve to the new IP. The name is stable because it is derived from the ordinal index, not the IP address.

Inspect pods in the simulated cluster to see the naming pattern:

```bash
kubectl get pods -o wide
```

Each StatefulSet Pod follows the `<statefulset-name>-<ordinal>` pattern. The combination with a headless Service is what makes each one addressable by a stable name.

:::quiz
Why does a StatefulSet Pod's DNS name survive a restart, even though the Pod IP changes?

**Answer:** Because the DNS name is derived from the Pod's ordinal index (`db-0`, `db-1`), not from its IP. When the Pod restarts, Kubernetes assigns a new IP, and CoreDNS updates the A record for that stable name to point to the new IP. The name itself never changes.
:::

## DNS policy

Every Pod has a `dnsPolicy` field that controls how DNS is configured inside the container.

`ClusterFirst` is the default. DNS queries go to CoreDNS first. If CoreDNS cannot resolve the name (because it is an external domain), it forwards the query to the upstream DNS server of the node. This is the standard behavior for every workload that needs both in-cluster and external DNS.

`Default` tells the Pod to inherit the DNS configuration of the node, bypassing CoreDNS entirely. A Pod with this policy cannot resolve Service names using short names.

`None` disables all automatic DNS configuration. You must supply a `dnsConfig` block in the Pod spec with explicit nameserver and search domain entries.

```bash
kubectl get pods -o wide
```

:::info
`ClusterFirst` is what you want in almost every situation. `Default` and `None` exist for specialized use cases like host-network Pods or Pods that must avoid cluster DNS for compliance reasons.
:::

Pod DNS records follow the IP-hyphen format and are rarely addressed directly. Stable naming for Pods comes from the `hostname` and `subdomain` combination for standalone Pods, or from the StatefulSet ordinal combined with a headless Service for stateful workloads. The `dnsPolicy` field controls whether a Pod participates in cluster DNS at all.
