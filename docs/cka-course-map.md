# CKA Course Map

> Generated on 2026-04-22

**48 modules, 212 leçons**

---


## Fundamentals

### Onboarding

> `onboarding`

- 1. **Welcome** `01-how-to-use-this-platform`
- 2. **What Runs Here** `02-your-practice-environment`
- 3. **Overview of Kubernetes Certifications** `03-certification-overview`

### Kubernetes Basics

> `kubernetes-basics`

- 1. **What Is Kubernetes** `01-what-is-kubernetes`
- 2. **The Evolution of Deployment** `_02-evolution-of-deployment`
- 3. **Cluster Architecture Overview** `03-cluster-architecture-overview`
- 4. **Control Plane Components** `04-control-plane-components`
- 5. **Node Components** `05-node-components`

### YAML and Objects

> `yaml-and-objects`

- 1. **The Kubernetes Object Model** `01-kubernetes-object-model`
- 2. **Anatomy of a Manifest** `02-anatomy-of-a-manifest`
- 3. **Object Names, UIDs, and DNS Rules** `04-object-names-uids-and-dns-rules`

### API and Versioning

> `api-and-versioning`

- 1. **Api Groups** `01-api-groups`
- 2. **Api Versions** `02-api-versions`
- 3. **Api Deprecation Policy** `03-api-deprecation-policy`

### kubectl Essentials

> `kubectl-essentials`

- 1. **Imperative vs Declarative** `01-imperative-vs-declarative`
- 2. **Viewing Resources** `02-viewing-resources`
- 3. **Logs and Exec** `03-logs-and-exec`
- 4. **Creating and Editing Resources** `04-creating-and-editing-resources`
- 5. **Delete and Cleanup** `05-delete-and-cleanup`
- 6. **Formatting Output and Tips** `06-formatting-output-and-tips`
- 7. **Field Selectors** `07-field-selectors`

### Kubeconfig

> `kubeconfig`

- 1. **What Is a Kubeconfig File** `01-kubeconfig-basics`
- 2. **Clusters, Users, and Contexts** `02-structure-clusters-users-contexts`
- 3. **Switching Contexts** `03-switching-contexts`
- 4. **Creating a Kubeconfig from Scratch** `04-creating-kubeconfig-from-scratch`

### Pods

> `pods`

- 1. **What Is a Pod** `01-what-is-a-pod`
- 2. **Pod Structure** `02-pod-structure`
- 3. **Creating Your First Pod** `03-creating-your-first-pod`
- 4. **Pod Lifecycle and Phases** `04-pod-lifecycle-and-phases`
- 5. **Container Restart Policies** `05-container-restart-policies`
- 6. **Editing Pods** `06-editing-pods`

### Namespaces

> `namespaces`

- 1. **What Are Namespaces** `01-what-are-namespaces`
- 2. **The Default Namespaces** `02-default-namespaces`
- 3. **Working Across Namespaces** `03-working-across-namespaces`
- 4. **When to Use Multiple Namespaces** `04-when-to-use-multiple-namespaces`

### Labels and Annotations

> `labels-and-annotations`

- 1. **What Are Labels** `01-what-are-labels`
- 2. **Label Selectors** `02-label-selectors`
- 3. **Annotations** `03-annotations`
- 4. **Recommended Labels** `04-recommended-labels`


## Cluster Architecture & Installation

### Cluster Architecture Deep Dive

> `cluster-architecture-deep`

- 1. **Etcd Deep Dive** `01-etcd-deep-dive`
- 2. **Kube Apiserver Internals** `02-kube-apiserver-internals`
- 3. **Kube Scheduler Internals** `03-kube-scheduler-internals`
- 4. **Kube Controller Manager** `04-kube-controller-manager`
- 5. **Container Runtime Interface** `05-container-runtime-interface`

### Cluster Installation

> `cluster-installation`

- 1. **Installation Options Overview** `01-installation-options-overview`
- 2. **Kubeadm Master Node Setup** `02-kubeadm-master-node-setup`
- 3. **Kubeadm Worker Node Join** `03-kubeadm-worker-node-join`
- 4. **High Availability Considerations** `04-high-availability-considerations`

### Cluster Maintenance

> `cluster-maintenance`

- 1. **Os Upgrades And Drain** `01-os-upgrades-and-drain`
- 2. **Version Skew Policy** `02-version-skew-policy`
- 3. **Cluster Upgrade Process** `03-cluster-upgrade-process`

### Backup and Restore

> `backup-and-restore`

- 1. **Backup Strategies** `01-backup-strategies`
- 2. **Etcd Backup With Etcdctl** `02-etcd-backup-with-etcdctl`
- 3. **Restore From Snapshot** `03-restore-from-snapshot`
- 4. **Etcdutl** `04-etcdutl`
- 5. **Etcd Restore Drill End To End** `05-etcd-restore-drill-end-to-end`


## Workloads & Scheduling

### ReplicaSets

> `replicasets`

- 1. **Why ReplicaSets** `01-why-replicasets`
- 2. **Creating a ReplicaSet** `02-creating-a-replicaset`
- 3. **Scaling and Self-Healing** `03-scaling-and-self-healing`
- 4. **Limitations of ReplicaSets** `04-limitations-of-replicasets`

### Deployments

> `deployments`

- 1. **What Is a Deployment** `01-what-is-a-deployment`
- 2. **Creating a Deployment** `02-creating-a-deployment`
- 3. **Rolling Updates** `03-rolling-updates`
- 4. **Rollback and Revision History** `04-rollback-and-revision-history`
- 5. **Update Strategies** `05-update-strategies`

### DaemonSets

> `daemonsets`

- 1. **What Is A Daemonset** `01-what-is-a-daemonset`
- 2. **Typical Use Cases** `02-typical-use-cases`
- 3. **Daemonset Scheduling** `03-daemonset-scheduling`
- 4. **Updating Daemonsets** `04-updating-daemonsets`

### Jobs and CronJobs

> `jobs`

- 1. **What Is A Job** `01-what-is-a-job`
- 2. **Job Parallelism And Completions** `02-job-parallelism-and-completions`
- 3. **Backoff And Retry** `03-backoff-and-retry`
- 4. **Cronjobs** `04-cronjobs`

### Commands and Args

> `commands-and-args`

- 1. **Docker Cmd Vs Entrypoint** `01-docker-cmd-vs-entrypoint`
- 2. **Command And Args In Kubernetes** `02-command-and-args-in-kubernetes`
- 3. **Practical Override Scenarios** `03-practical-override-scenarios`

### ConfigMaps

> `configmaps`

- 1. **What Is A Configmap** `01-what-is-a-configmap`
- 2. **Creating Configmaps** `02-creating-configmaps`
- 3. **Using Via Environment Variables** `03-using-via-environment-variables`
- 4. **Using Via Volume Mounts** `04-using-via-volume-mounts`
- 5. **Immutable Configmaps** `05-immutable-configmaps`

### Secrets

> `secrets`

- 1. **What Is A Secret** `01-what-is-a-secret`
- 2. **Types Of Secrets** `02-types-of-secrets`
- 3. **Creating And Using Secrets** `03-creating-and-using-secrets`
- 4. **Encrypting Secrets At Rest** `04-encrypting-secrets-at-rest`
- 5. **Security Best Practices** `05-security-best-practices`

### Resource Management

> `resource-management`

- 1. **Resource Requests And Limits** `01-resource-requests-and-limits`
- 2. **How Scheduling Uses Requests** `02-how-scheduling-uses-requests`
- 3. **What Happens When Limits Are Exceeded** `03-what-happens-when-limits-are-exceeded`
- 4. **Qos Classes** `04-qos-classes`
- 5. **Limitranges And Resourcequotas** `05-limitranges-and-resourcequotas`

### Multi-Container Pods

> `multi-container-pods`

- 1. **Why Multiple Containers** `01-why-multiple-containers`
- 2. **Sidecar Pattern** `02-sidecar-pattern`
- 3. **Ambassador And Adapter Patterns** `03-ambassador-and-adapter-patterns`
- 4. **Init Containers** `04-init-containers`
- 5. **Native Sidecar Patterns** `05-native-sidecar-patterns`

### Probes

> `probes`

- 1. **Why Probes Matter** `01-why-probes-matter`
- 2. **Liveness Probes** `02-liveness-probes`
- 3. **Readiness Probes** `03-readiness-probes`
- 4. **Startup Probes** `04-startup-probes`
- 5. **Probe Types And Configuration** `05-probe-types-and-configuration`

### Scheduling Basics

> `scheduling-basics`

- 1. **Taints And Tolerations** `01-taints-and-tolerations`
- 2. **Node Selectors** `02-node-selectors`
- 3. **Node Affinity** `03-node-affinity`
- 4. **Taints Vs Node Affinity** `04-taints-vs-node-affinity`

### Advanced Scheduling

> `advanced-scheduling`

- 1. **Manual Scheduling** `01-manual-scheduling`
- 2. **Static Pods** `02-static-pods`
- 3. **Priority Classes** `03-priority-classes`
- 4. **Multiple Schedulers** `04-multiple-schedulers`

### Autoscaling

> `autoscaling`

- 1. **Introduction To Autoscaling** `01-introduction-to-autoscaling`
- 2. **Horizontal Pod Autoscaler** `02-horizontal-pod-autoscaler`
- 3. **Hpa Stabilization And Behavior** `03-hpa-stabilization-and-behavior`
- 4. **Vertical Pod Autoscaler** `04-vertical-pod-autoscaler`
- 5. **In Place Resize Of Pods** `05-in-place-resize-of-pods`

### StatefulSets

> `statefulsets`

- 1. **Stateful Vs Stateless** `01-stateful-vs-stateless`
- 2. **Statefulset Fundamentals** `02-statefulset-fundamentals`
- 3. **Headless Services** `03-headless-services`
- 4. **Storage In Statefulsets** `04-storage-in-statefulsets`
- 5. **Ordering And Updates** `05-ordering-and-updates`


## Services & Networking

### Networking Fundamentals

> `networking-fundamentals`

- 1. **Switching And Routing** `01-switching-and-routing`
- 2. **Dns Fundamentals** `02-dns-fundamentals`
- 3. **Network Namespaces** `03-network-namespaces`
- 4. **Docker Networking** `04-docker-networking`

### Kubernetes Networking

> `kubernetes-networking`

- 1. **Cni Concepts** `01-cni-concepts`
- 2. **Pod Networking** `02-pod-networking`
- 3. **Service Networking** `03-service-networking`
- 4. **Cluster Networking Configuration** `04-cluster-networking-configuration`
- 5. **Ipam** `05-ipam`
- 6. **Cni Troubleshooting Method** `06-cni-troubleshooting-method`

### Services

> `services`

- 1. **Why Services** `01-why-services`
- 2. **Services and Endpoints** `02-service-and-endpoints`
- 3. **ClusterIP** `03-clusterip`
- 4. **NodePort** `04-nodeport`
- 5. **LoadBalancer** `05-loadbalancer`
- 6. **Named Ports** `06-named-ports`

### DNS

> `dns`

- 1. **DNS in Kubernetes** `01-dns-in-kubernetes`
- 2. **Service DNS Records** `02-service-dns-records`
- 3. **Pod DNS Records** `03-pod-dns-records`
- 4. **DNS Debugging** `04-dns-debugging`

### Gateway API

> `gateway-api`

- 1. **Introduction To Gateway Api** `01-introduction-to-gateway-api`
- 2. **Gateway Api Structure** `02-gateway-api-structure`
- 3. **Practical Gateway Api** `03-practical-gateway-api`
- 4. **Tls With Gateway Api** `04-tls-with-gateway-api`
- 5. **Mapping Ingress To Gateway Api** `05-mapping-ingress-to-gateway-api`
- 6. **Httproute Basics** `07-httproute-basics`

### Network Policies

> `network-policies`

- 1. **What Are Network Policies?** `01-what-are-network-policies`
- 2. **NetworkPolicy Structure** `02-networkpolicy-structure`
- 3. **Ingress Rules** `03-ingress-rules`
- 4. **Egress Rules** `04-egress-rules`
- 5. **Advanced NetworkPolicy Patterns** `05-advanced-rules`


## Storage

### Volumes

> `volumes`

- 1. **Why Volumes?** `01-why-volumes`
- 2. **emptyDir** `02-emptydir`
- 3. **hostPath** `03-hostpath`

### Persistent Storage

> `persistent-storage`

- 1. **PersistentVolumes and PersistentVolumeClaims** `01-pv-and-pvc-concepts`
- 2. **Creating a PersistentVolume** `02-creating-a-persistentvolume`
- 3. **Creating a PersistentVolumeClaim** `03-creating-a-persistentvolumeclaim`
- 4. **Using PVCs in Pods** `04-using-pvcs-in-pods`
- 5. **Access Modes and Reclaim Policies** `05-access-modes-and-reclaim-policies`

### Storage Classes

> `storage-classes`

- 1. **Static Vs Dynamic Provisioning** `01-static-vs-dynamic-provisioning`
- 2. **What Is A Storageclass** `02-what-is-a-storageclass`
- 3. **Dynamic Provisioning In Practice** `03-dynamic-provisioning-in-practice`
- 4. **Container Storage Interface** `04-container-storage-interface`


## Security & Auth

### Authentication

> `authentication`

- 1. **Kubernetes Security Fundamentals** `01-security-primitives`
- 2. **How Kubernetes Authenticates Identities** `02-authentication-methods`
- 3. **Users vs ServiceAccounts** `03-users-vs-serviceaccounts`

### Service Accounts

> `service-accounts`

- 1. **What Is a ServiceAccount** `01-what-is-a-serviceaccount`
- 2. **Creating and Assigning ServiceAccounts** `02-creating-and-assigning-sas`
- 3. **Token Projection and Automount** `03-token-projection-and-automount`
- 4. **ServiceAccount Practical Scenarios** `04-practical-scenarios`

### TLS Certificates

> `tls-certificates`

- 1. **TLS and PKI Basics** `01-tls-and-pki-basics`
- 2. **How Kubernetes Uses TLS** `02-tls-in-kubernetes`
- 3. **Creating Certificates** `03-certificate-creation`
- 4. **Viewing Certificate Details** `04-viewing-certificate-details`
- 5. **The Kubernetes Certificates API** `05-certificates-api`

### RBAC

> `rbac`

- 1. **Authorization in Kubernetes** `01-authorization-methods-overview`
- 2. **Roles and RoleBindings** `02-roles-and-rolebindings`
- 3. **ClusterRoles and ClusterRoleBindings** `03-clusterroles-and-clusterrolebindings`
- 4. **Testing Permissions with kubectl auth can-i** `04-testing-permissions`
- 5. **RBAC Best Practices** `05-rbac-best-practices`

### Security Contexts

> `security-contexts`

- 1. **Container Security: Linux Primitives** `01-security-in-docker-recap`
- 2. **Pod vs Container Security Context** `02-pod-vs-container-security-context`
- 3. **Running Containers as Non-Root** `03-runasuser-runasgroup-runasnonroot`
- 4. **Capabilities and Read-Only Root Filesystem** `04-capabilities-and-readonlyrootfilesystem`

### Image Security

> `image-security`

- 1. **Image Naming and Registries** `01-image-naming-and-registries`
- 2. **Pulling from Private Registries with imagePullSecrets** `02-imagepullsecrets`
- 3. **Image Pull Policies** `03-image-pull-policies`

### Admission Controllers

> `admission-controllers`

- 1. **What Are Admission Controllers** `01-what-are-admission-controllers`
- 2. **Enabling and Disabling Admission Controllers** `02-enabling-and-disabling`
- 3. **Validating Admission Webhooks** `03-validating-webhooks`
- 4. **Mutating Admission Webhooks** `04-mutating-webhooks`

### Pod Security

> `pod-security`

- 1. **Pod Security Standards** `01-pod-security-standards`
- 2. **Pod Security Admission** `02-pod-security-admission`
- 3. **Practical PSS Enforcement** `03-practical-enforcement`


## Observability & Troubleshooting

### Logging and Monitoring

> `logging-and-monitoring`

- 1. **Container Logging Basics** `01-container-logging-basics`
- 2. **Monitoring with Metrics Server** `02-monitoring-with-metrics-server`
- 3. **Kubernetes Events** `03-kubernetes-events`
- 4. **Monitoring Cluster Component Logs** `04-monitoring-cluster-component-logs`

### Troubleshooting

> `troubleshooting`

- 1. **Troubleshooting Application Failures** `01-troubleshooting-application-failures`
- 2. **Troubleshooting Service Connectivity** `02-troubleshooting-service-connectivity`
- 3. **Troubleshooting Control Plane** `03-troubleshooting-control-plane`
- 4. **Troubleshooting Worker Nodes** `04-troubleshooting-worker-nodes`
- 5. **Systematic Debugging Methodology** `05-systematic-debugging-methodology`
- 6. **Debug Distroless With Kubectl Debug** `06-debug-distroless-with-kubectl-debug`


## API & Extensibility

### Custom Resources

> `custom-resources`

- 1. **What Are Custom Resources** `01-what-are-custom-resources`
- 2. **Creating A Crd** `02-creating-a-crd`
- 3. **Custom Controllers** `03-custom-controllers`
- 4. **Operator Pattern** `04-operator-pattern`

### Helm

> `helm`

- 1. **What Is Helm** `01-what-is-helm`
- 2. **Installing Helm** `02-installing-helm`
- 3. **Working With Charts** `03-working-with-charts`
- 4. **Values And Configuration** `04-values-and-configuration`
- 5. **Finding And Using Charts** `05-finding-and-using-charts`

