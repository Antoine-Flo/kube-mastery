# CKA curriculum v1.34 :

10% - Storage
• Implement storage classes and dynamic
volume provisioning
• Configure volume types, access modes
and reclaim policies
• Manage persistent volumes and persistent
volume claims

30% - Troubleshooting
• Troubleshoot clusters and nodes
• Troubleshoot cluster components
• Monitor cluster and application resource
usage
• Manage and evaluate container output
streams
• Troubleshoot services and networking

15% - Workloads and Scheduling
• Understand application deployments and
how to perform rolling update and rollbacks
• Use ConfigMaps and Secrets to configure
applications
• Configure workload autoscaling
• Understand the primitives used to create
robust, self-healing, application deployments
• Configure Pod admission and scheduling
(limits, node affinity, etc.)

25% - Cluster Architecture, Installation and Configuration
• Manage role based access control (RBAC)
• Prepare underlying infrastructure for installing
a Kubernetes cluster
• Create and manage Kubernetes clusters using kubeadm
• Manage the lifecycle of Kubernetes clusters
• Implement and configure a highly-available
control plane
• Use Helm and Kustomize to install cluster
components
• Understand extension interfaces (CNI, CSI,
CRI, etc.)
• Understand CRDs, install and configure
operators

20% - Servicing and Networking
• Understand connectivity between Pods
• Define and enforce Network Policies
• Use ClusterIP, NodePort, LoadBalancer
service types and endpoints
• Use the Gateway API to manage Ingress
traffic
• Know how to use Ingress controllers and
Ingress resources
• Understand and use CoreDNS

# Coverage :

## 10% - Storage

### ✅ Implémenté

- Aucun (stockage non implémenté actuellement)

### ⏳ Prévu (Roadmap)

- **Sprint 8** : PersistentVolume (PV) et PersistentVolumeClaim (PVC)
- **Sprint 8** : Binding logic (match PV to PVC)
- **Sprint 8** : StatefulSets avec identités réseau stables

### ❌ Manquant

- StorageClasses et provisioning dynamique de volumes
- Configuration des types de volumes, modes d'accès et politiques de récupération
- Gestion complète des PV/PVC (modes d'accès: ReadWriteOnce, ReadOnlyMany, ReadWriteMany)
- Politiques de récupération (Retain, Recycle, Delete)

**Priorité** : Moyenne (10% de l'examen)

---

## 30% - Troubleshooting

### ✅ Implémenté

- `kubectl logs <pod>` : Affichage des logs des conteneurs
- `kubectl logs <pod> -c <container>` : Logs pour conteneurs spécifiques (multi-container)
- `kubectl describe <type> <name>` : Détails des ressources avec événements
- `kubectl exec -it <pod> -- <cmd>` : Exécution de commandes dans les pods
- `kubectl get pods` : Affichage du statut des pods (phase, age)
- `kubectl version` : Affichage des versions client et serveur (avec --client, --output json/yaml)
- `kubectl cluster-info` : Affichage des informations du cluster (control plane et services)
- `kubectl cluster-info dump` : Dump des informations du cluster pour debugging
- `kubectl api-resources` : Liste des ressources API disponibles avec leurs métadonnées (shortnames, apiversion, namespaced, kind)
- `kubectl api-resources --output wide` : Format wide avec VERBS et CATEGORIES
- `kubectl api-resources --namespaced=true/false` : Filtrage par ressources namespaced
- `kubectl api-resources --sort-by=name/kind` : Tri des ressources
- Terminal complet avec filesystem virtuel pour navigation et debugging

### ⏳ Prévu (Roadmap)

- **Sprint 10** : `kubectl top` (CPU/memory metrics)
- **Sprint 11** : Troubleshooting réseau (NetworkPolicies, Services)
- **Sprint 12** : Monitoring des ressources (HPA, ResourceQuotas)

### ❌ Manquant

- Troubleshooting des composants du cluster (kubelet, kube-proxy, etcd, API server)
- Troubleshooting des nœuds (node status, node conditions)
- Analyse approfondie des logs du cluster (journalctl, logs des composants)
- Surveillance avancée des applications (metrics, probes détaillées)
- Troubleshooting réseau avancé (CoreDNS, CNI plugins, connectivité inter-pods)
- Gestion des événements Kubernetes (`kubectl get events`)

**Priorité** : **CRITIQUE** (30% de l'examen - le plus important)

---

## 15% - Workloads and Scheduling

### ✅ Implémenté

- Pods : Création, gestion, multi-container, init containers
- Deployments : Ressource simulée (affichage dans `kubectl get`)
- ConfigMaps : Création, lecture, utilisation dans les pods
- Secrets : Création, lecture, types (Opaque, etc.)
- Namespaces : Gestion et navigation
- `kubectl apply -f <file>` : Application de manifests YAML
- `kubectl create -f <file>` : Création depuis YAML
- Labels et annotations : `kubectl label`, `kubectl annotate`

### ⏳ Prévu (Roadmap)

- **Sprint 9** : Jobs avec tracking des complétions
- **Sprint 9** : CronJobs avec parsing de schedule
- **Sprint 9** : DaemonSets (un pod par nœud)
- **Sprint 10** : `kubectl rollout` (status, history, undo, pause/resume)
- **Sprint 12** : HorizontalPodAutoscaler (HPA)
- **Sprint 12** : ResourceQuotas par namespace
- **Sprint 12** : LimitRanges avec defaults

### ❌ Manquant

- Rolling updates et rollbacks complets (actuellement Deployments sont simulés)
- ReplicaSets (gestion automatique par Deployments)
- Configuration avancée de Pod admission (tolerations, node affinity, pod affinity)
- Scheduling avancé (taints, node selectors, pod disruption budgets)
- Primitives pour applications auto-guérissantes (liveness/readiness probes avancées)
- StatefulSets (prévu Sprint 8 mais pas encore implémenté)

**Priorité** : Moyenne-Haute (15% de l'examen)

---

## 25% - Cluster Architecture, Installation and Configuration

### ✅ Implémenté

- Concepts de base : Architecture générale, API Server, etcd, Worker Nodes
- Terminal complet pour simulation d'environnement d'examen
- Filesystem virtuel pour création de manifests

### ⏳ Prévu (Roadmap)

- **Sprint 11** : RBAC (Roles, ClusterRoles, Bindings)
- **Sprint 11** : `kubectl auth can-i` (vérification des permissions)

### ❌ Manquant

- **CRITIQUE** : Installation avec kubeadm (préparation infrastructure, création cluster)
- **CRITIQUE** : Gestion du cycle de vie des clusters (upgrade, maintenance)
- **CRITIQUE** : Configuration d'un control plane hautement disponible (HA)
- **CRITIQUE** : Sauvegarde et restauration d'etcd
- Helm et Kustomize pour installer des composants du cluster
- Interfaces d'extension (CNI, CSI, CRI) - compréhension théorique nécessaire
- CRDs (Custom Resource Definitions) et opérateurs (installation et configuration)

**Priorité** : **CRITIQUE** (25% de l'examen - deuxième plus important)

**Note** : Pour la formation, on se concentre sur les leçons théoriques détaillées et la simulation des commandes (kubeadm init, etcd backup/restore) dans le simulateur.

---

## 20% - Servicing and Networking

### ✅ Implémenté

- Services : Ressource simulée (affichage dans `kubectl get`)
- Concepts de base : Introduction aux Services, Service Discovery
- Leçons sur ClusterIP, NodePort, LoadBalancer (théorie)

### ⏳ Prévu (Roadmap)

- **Sprint 10** : `kubectl port-forward` (simulation)
- **Sprint 11** : Ingress avec règles de routing
- **Sprint 11** : NetworkPolicies (définition et enforcement)

### ❌ Manquant

- **CRITIQUE** : Connectivité réelle entre Pods (simulation réseau)
- **CRITIQUE** : Types de Services fonctionnels (ClusterIP, NodePort, LoadBalancer avec routing réel)
- **CRITIQUE** : Endpoints des Services (gestion automatique)
- **CRITIQUE** : CoreDNS (compréhension et utilisation)
- Gateway API pour gérer le trafic Ingress
- Contrôleurs Ingress (installation et configuration)
- NetworkPolicies avancées (isolation réseau configurable)

**Priorité** : Haute (20% de l'examen)

**Note** : Pour la formation CKA, on explique les concepts théoriques et on simule les commandes (`kubectl get endpoints`, `kubectl get svc`) dans le simulateur.

---

## Récapitulatif de couverture

| Domaine                    | Poids | Couverture actuelle                       | Priorité    |
| -------------------------- | ----- | ----------------------------------------- | ----------- |
| **Troubleshooting**        | 30%   | ~40% (logs, describe, exec)               | 🔴 CRITIQUE |
| **Cluster Architecture**   | 25%   | ~10% (concepts théoriques)                | 🔴 CRITIQUE |
| **Servicing & Networking** | 20%   | ~20% (concepts, pas de simulation réseau) | 🟠 Haute    |
| **Workloads & Scheduling** | 15%   | ~60% (Pods, ConfigMaps, Secrets)          | 🟡 Moyenne  |
| **Storage**                | 10%   | ~0%                                       | 🟡 Moyenne  |

### Couverture globale estimée : ~30%

### Actions prioritaires pour CKA

1. **Troubleshooting (30%)** - Le plus important
   - [ ] Ajouter `kubectl get events`
   - [ ] Scénarios de troubleshooting (pods en CrashLoopBackOff, ImagePullBackOff, etc.)
   - [ ] Leçons sur troubleshooting des composants du cluster
   - [ ] Exercices pratiques de debugging

2. **Cluster Architecture (25%)**
   - [ ] Leçons détaillées sur kubeadm (théorie + commandes)
   - [ ] Leçons sur etcd backup/restore (théorie + commandes)
   - [ ] Leçons sur upgrade de cluster
   - [ ] Leçons sur HA control plane

3. **Networking (20%)**
   - [ ] Implémenter Services fonctionnels (Sprint 11)
   - [ ] Leçons sur CoreDNS
   - [ ] Ingress fonctionnel (Sprint 11)
   - [ ] NetworkPolicies (Sprint 11)

4. **Workloads (15%)**
   - [ ] Rolling updates/rollbacks fonctionnels (Sprint 10)
   - [ ] Jobs/CronJobs/DaemonSets (Sprint 9)
   - [ ] HPA (Sprint 12)

5. **Storage (10%)**
   - [ ] PV/PVC (Sprint 8)
   - [ ] StorageClasses

### Ressources officielles

- **Curriculum CNCF** : https://github.com/cncf/curriculum
- **Guide d'examen CKA** : https://www.cncf.io/certification/cka/
- **Kubernetes.io** : https://kubernetes.io/docs/
- **kubeadm** : https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/
- **etcd** : https://etcd.io/docs/

### Notes importantes

- Le simulateur couvre la théorie et les commandes ; focus sur le contenu et la préparation CKA
- Focus immédiat : Troubleshooting (30%) et Cluster Architecture (25%) = 55% de l'examen
