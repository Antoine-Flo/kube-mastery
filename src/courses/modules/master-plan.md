# Master Plan - Matrice des sujets couverts

## Matrice Modules / Sujets

| Sujet                             | Module              | Niveau | Notes                             |
| --------------------------------- | ------------------- | ------ | --------------------------------- |
| **OVERVIEW**                      |                     |        |                                   |
| Onboarding                        | Overview            | intro  | Plateforme, environnement         |
| Kubernetes overview               | Overview            | intro  | Pourquoi K8s, ce qu'il fait       |
| Évolution déploiement             | Overview            | intro  | Physique → VMs → Containers       |
| Components intro                  | Overview            | intro  | Control plane, nodes              |
| Objets Kubernetes                 | Overview            | intro  | Spec, status, YAML                |
| Object management                 | Overview            | intro  | Impératif vs déclaratif           |
| Namespaces                        | Overview            | intro  | Isolation logique                 |
| Labels (intro)                    | Overview            | intro  | Clé/valeur, sélecteurs            |
| Labels (avancé)                   | Overview            | avancé | matchExpressions, nodeSelector    |
| Annotations                       | Overview            | intro  | Métadonnées non identifiantes     |
| Names et UIDs                     | Overview            | intro  | Identifiants uniques              |
| Field selectors                   | Overview            | avancé | Filtrage par champs               |
| API Kubernetes (intro)            | Overview            | intro  | REST, kubectl, clients            |
| API discovery                     | Overview            | avancé | OpenAPI, Protobuf                 |
| API versioning                    | Overview            | avancé | Groupes, alpha/beta/stable        |
| Persistence etcd                  | Overview            | avancé | Stockage clé-valeur               |
| Field validation                  | Overview            | avancé | Strict, warn, ignore              |
| Finalizers                        | Overview            | avancé | Contrôle suppression              |
| Owners/dependents                 | Overview            | avancé | ownerReferences, cascade          |
| Common labels                     | Overview            | intro  | app.kubernetes.io/*               |
| Operations                        | Overview            | intro  | kubectl get/describe/edit         |
| **ARCHITECTURE**                  |                     |        |                                   |
| Nodes (kubelet, kube-proxy)       | Architecture        | intro  | Détails techniques                |
| Control plane components          | Architecture        | intro  | kube-apiserver, etcd, scheduler   |
| Controllers pattern               | Architecture        | avancé | Boucles de contrôle               |
| Communication control-plane/nodes | Architecture        | avancé |                                   |
| Garbage collection                | Architecture        | avancé |                                   |
| Leases, coordination              | Architecture        | avancé |                                   |
| cgroups                           | Architecture        | avancé |                                   |
| **CONTAINERS**                    |                     |        |                                   |
| Images container                  | Containers          | intro  | Registries, pull policy           |
| Container runtime (CRI)           | Containers          | avancé | containerd, CRI-O                 |
| Container environment             | Containers          | intro  | Filesystem, variables             |
| Lifecycle hooks                   | Containers          | avancé | PostStart, PreStop                |
| RuntimeClass                      | Containers          | avancé | Sandboxed containers              |
| **WORKLOADS - PODS**              |                     |        |                                   |
| Pods (base)                       | Workloads           | intro  | Anatomie, premier Pod             |
| Pods multi-containers             | Workloads           | avancé | Patterns de communication         |
| Pod lifecycle                     | Workloads           | intro  | Phases, conditions                |
| Init containers                   | Workloads           | avancé |                                   |
| Sidecar containers                | Workloads           | avancé |                                   |
| Ephemeral containers              | Workloads           | avancé | Debugging                         |
| Pod QoS                           | Workloads           | avancé | Guaranteed, Burstable, BestEffort |
| Pod disruptions                   | Workloads           | avancé | PDBs                              |
| Downward API                      | Workloads           | avancé | Métadonnées                       |
| **WORKLOADS - CONTROLLERS**       |                     |        |                                   |
| ReplicaSets                       | Workloads           | intro  | Concept de réplication            |
| Deployments (intro)               | Workloads           | intro  | Création, scaling basique         |
| Deployments (updates)             | Workloads           | intro  | Rolling updates basiques          |
| Deployments (avancé)              | Workloads           | avancé | Stratégies, rollback, pause       |
| StatefulSets (intro)              | Workloads           | intro  | Concept, identité stable          |
| StatefulSets (avancé)             | Workloads           | avancé | Storage, headless, updates        |
| DaemonSets                        | Workloads           | avancé | Un pod/node                       |
| Jobs (intro)                      | Workloads           | intro  | Job one-shot basique              |
| Jobs (avancé)                     | Workloads           | avancé | Parallélisme, backoff             |
| CronJobs                          | Workloads           | intro  | Tâches planifiées                 |
| **WORKLOADS - AUTOSCALING**       |                     |        |                                   |
| HPA (intro)                       | Workloads           | intro  | Scaling CPU/mémoire basique       |
| HPA (avancé)                      | Workloads           | avancé | Métriques custom, behavior        |
| VPA                               | Workloads           | avancé | Scaling vertical                  |
| **SERVICES & NETWORKING**         |                     |        |                                   |
| Services (intro)                  | Services-Networking | intro  | Concept, ClusterIP                |
| Services (types)                  | Services-Networking | intro  | NodePort, LB, ExternalName        |
| Services (avancé)                 | Services-Networking | avancé | Affinity, headless, external IPs  |
| Endpoints                         | Services-Networking | avancé | EndpointSlices, internals         |
| DNS (intro)                       | Services-Networking | intro  | Découverte par DNS                |
| DNS (avancé)                      | Services-Networking | avancé | Pods DNS policy, config           |
| Ingress (intro)                   | Services-Networking | intro  | Règles basiques, path routing     |
| Ingress (avancé)                  | Services-Networking | avancé | TLS, annotations, rewrite         |
| Ingress Controllers               | Services-Networking | avancé | NGINX, Traefik, etc.              |
| Gateway API                       | Services-Networking | avancé | Nouvelle API                      |
| Network Policies (intro)          | Services-Networking | intro  | Concept, ingress basique          |
| Network Policies (avancé)         | Services-Networking | avancé | Egress, CIDR, complex rules       |
| Dual-stack                        | Services-Networking | avancé | IPv4/IPv6                         |
| Topology-aware routing            | Services-Networking | avancé |                                   |
| **STORAGE**                       |                     |        |                                   |
| Volumes (intro)                   | Storage             | intro  | emptyDir, partage                 |
| Volumes (types)                   | Storage             | intro  | hostPath, configMap, secret       |
| PV/PVC (intro)                    | Storage             | intro  | Concept, binding basique          |
| PV/PVC (avancé)                   | Storage             | avancé | Access modes, reclaim             |
| StorageClass (intro)              | Storage             | intro  | Dynamic provisioning basique      |
| StorageClass (avancé)             | Storage             | avancé | Paramètres, binding modes         |
| Ephemeral volumes                 | Storage             | avancé |                                   |
| Projected volumes                 | Storage             | avancé |                                   |
| Volume snapshots                  | Storage             | avancé |                                   |
| CSI                               | Storage             | avancé | Plugins de stockage               |
| **CONFIGURATION**                 |                     |        |                                   |
| ConfigMaps (intro)                | Configuration       | intro  | Création, env vars                |
| ConfigMaps (avancé)               | Configuration       | avancé | Volumes, immutabilité             |
| Secrets (intro)                   | Configuration       | intro  | Création, utilisation basique     |
| Secrets (avancé)                  | Configuration       | avancé | Types, volumes                    |
| Resource management (intro)       | Configuration       | intro  | Requests, limits basiques         |
| Resource management (avancé)      | Configuration       | avancé | QoS, OOM, scheduling              |
| Probes (intro)                    | Configuration       | intro  | Liveness, readiness basiques      |
| Probes (avancé)                   | Configuration       | avancé | Startup, timing, gRPC             |
| kubeconfig                        | Configuration       | intro  | Accès cluster                     |
| **SECURITY**                      |                     |        |                                   |
| Cloud-native security (4C)        | Security            | intro  | Modèle global                     |
| Controlling API access            | Security            | intro  | Vue d'ensemble AuthN/AuthZ        |
| ServiceAccounts (intro)           | Security            | intro  | Concept, utilisation basique      |
| ServiceAccounts (avancé)          | Security            | avancé | Tokens projetés, bonnes pratiques |
| RBAC (intro)                      | Security            | intro  | Roles, RoleBindings               |
| RBAC (avancé)                     | Security            | avancé | ClusterRoles, aggregation         |
| Pod Security Standards            | Security            | intro  | Privileged, Baseline, Restricted  |
| Pod Security Admission            | Security            | avancé | Enforcement par namespace         |
| Secrets best practices            | Security            | avancé | Encryption, rotation              |
| Linux security (intro)            | Security            | intro  | runAsUser, runAsNonRoot           |
| Linux security (avancé)           | Security            | avancé | Capabilities, seccomp             |
| Multi-tenancy                     | Security            | avancé | Isolation                         |
| **POLICY**                        |                     |        |                                   |
| ResourceQuotas                    | Policy              | avancé | Quotas namespace                  |
| LimitRanges                       | Policy              | avancé | Defaults                          |
| PID limiting                      | Policy              | avancé |                                   |
| Node resource managers            | Policy              | avancé | CPU/Memory/Topology Manager       |
| **ADMINISTRATION**                |                     |        |                                   |
| Addons                            | Administration      | intro  | DNS, Dashboard, etc.              |
| Certificates                      | Administration      | avancé | PKI, rotation                     |
| Logging                           | Administration      | intro  | Architecture logging              |
| Cluster networking                | Administration      | avancé | CNI, config                       |
| Node autoscaling                  | Administration      | avancé | Cluster Autoscaler                |
| Node shutdown                     | Administration      | avancé | Graceful shutdown                 |
| Observability                     | Administration      | intro  | Metrics, tracing                  |
| Flow control                      | Administration      | avancé | API Priority                      |
| Admission webhooks                | Administration      | avancé | Bonnes pratiques                  |
| **SETUP**                         |                     |        |                                   |
| Learning environments             | Setup               | intro  | minikube, kind, k3s               |
| Production environments           | Setup               | avancé | Considérations                    |
| kubeadm                           | Setup               | avancé | Installation                      |
| Container runtimes config         | Setup               | avancé |                                   |
| Managed solutions                 | Setup               | intro  | EKS, GKE, AKS                     |
| **WINDOWS**                       |                     |        |                                   |
| Windows nodes                     | Windows             | intro  | Support, limitations              |
| Windows scheduling                | Windows             | intro  | Node selectors                    |
| Windows networking                | Windows             | avancé | Particularités                    |
| Windows storage                   | Windows             | avancé |                                   |
| Windows security                  | Windows             | avancé | gMSA, HostProcess                 |
| **EXTENSIONS**                    |                     |        |                                   |
| Custom Resources (CRDs)           | Extend-Kubernetes   | avancé |                                   |
| API Aggregation                   | Extend-Kubernetes   | avancé |                                   |
| kubectl plugins                   | Extend-Kubernetes   | avancé |                                   |
| Auth webhooks                     | Extend-Kubernetes   | avancé | AuthN, AuthZ                      |
| Admission webhooks (dev)          | Extend-Kubernetes   | avancé | Création                          |
| Device plugins                    | Extend-Kubernetes   | avancé | GPU, FPGA                         |
| Network plugins (CNI)             | Extend-Kubernetes   | avancé | Développement                     |
| Storage plugins (CSI)             | Extend-Kubernetes   | avancé | Développement                     |
| Scheduler extensions              | Extend-Kubernetes   | avancé | Custom schedulers                 |
| Operators                         | Extend-Kubernetes   | avancé | Pattern, frameworks               |

## Chevauchements intentionnels

| Sujet              | Modules                              | Distinction                      |
| ------------------ | ------------------------------------ | -------------------------------- |
| Admission webhooks | Security, Administration, Extend-K8s | Sécurité vs Ops vs Développement |
| Network Policies   | Services-Networking, Security        | Usage vs Sécurité                |
| Secrets            | Configuration, Security              | Usage vs Bonnes pratiques        |
| CSI                | Storage, Extend-K8s                  | Usage vs Développement           |
| CNI                | Administration, Extend-K8s           | Config vs Développement          |

## Sujets pour cours d'introduction

Chapitres marqués "intro" qui peuvent être assemblés pour un parcours débutant :
- Overview : onboarding, kubernetes-overview, evolution-deployment, components-intro, objects-intro, object-management, namespaces-intro, labels-intro, annotations, names-uids, api-intro, common-labels, operations
- Workloads : pods-intro, pod-lifecycle, replicasets, deployments-intro, deployments-updates, statefulsets-intro, jobs-intro, cronjobs, hpa-intro
- Services-Networking : services-intro, services-types, dns-intro, ingress-intro, network-policies-intro
- Storage : volumes-intro, volumes-types, pv-intro, storage-classes-intro
- Configuration : configmaps-intro, secrets-intro, resource-management-intro, probes-intro, kubeconfig
- Security : cloud-native-security, controlling-access, service-accounts-intro, rbac-intro, pod-security-standards, linux-security-intro

## Sujets exclus (hors scope ou trop avancés)

- Scheduling-Eviction (couvert partiellement dans Workloads et Administration)
- Windows-specific details beyond basics (trop niche)
- API reference details (documentation de référence, pas cours)

---

## Cours planifiés

### Cours 1 : Fondamentaux Kubernetes (7 chapitres)

Objectif : Comprendre les concepts de base et déployer ses premières applications.
Profil cible : Développeur qui découvre Kubernetes.

| #   | Module              | Chapitre              | Objectif                                   |
| --- | ------------------- | --------------------- | ------------------------------------------ |
| 1   | Overview            | onboarding            | Utiliser la plateforme, environnement      |
| 2   | Overview            | concepts-fondamentaux | Qu'est-ce que K8s, pourquoi l'utiliser     |
| 3   | Overview            | objets-kubernetes     | Structure YAML, apiVersion, kind, metadata |
| 4   | Workloads           | pods-intro            | Premier Pod, anatomie de base              |
| 5   | Workloads           | deployments-intro     | Création, scaling basique                  |
| 6   | Services-Networking | services-intro        | Exposer ses Pods, ClusterIP                |
| 7   | Services-Networking | services-types        | NodePort, LoadBalancer                     |

### Cours 2 : Kubernetes Complet (50+ chapitres)

Objectif : Maîtriser Kubernetes de A à Z, des concepts de base aux fonctionnalités avancées.
Profil cible : Développeur ou ops qui veut une compréhension approfondie de Kubernetes.
Prérequis : Avoir suivi le Cours 1 ou avoir des bases solides.

#### Partie 1 : Fondations et Architecture (10 chapitres)

| #   | Module     | Chapitre                    | Objectif                                           |
| --- | ---------- | --------------------------- | -------------------------------------------------- |
| 1   | Overview   | onboarding                  | Utiliser la plateforme, environnement              |
| 2   | Overview   | concepts-fondamentaux       | Qu'est-ce que K8s, pourquoi l'utiliser             |
| 3   | Overview   | evolution-deployment        | Physique → VMs → Containers, contexte historique  |
| 4   | Overview   | objets-kubernetes           | Structure YAML, apiVersion, kind, metadata         |
| 5   | Overview   | object-management           | Impératif vs déclaratif, kubectl apply             |
| 6   | Overview   | namespaces                  | Isolation logique, organisation                    |
| 7   | Overview   | labels-intro                | Clé/valeur, sélecteurs, organisation              |
| 8   | Overview   | annotations                 | Métadonnées non identifiantes                      |
| 9   | Overview   | common-labels               | Standards app.kubernetes.io/*                      |
| 10  | Overview   | operations                  | kubectl get/describe/edit, bonnes pratiques        |

#### Partie 2 : Architecture Interne (6 chapitres)

| #   | Module      | Chapitre                        | Objectif                                    |
| --- | ----------- | ------------------------------- | ------------------------------------------- |
| 11  | Architecture | components-intro                | Control plane, nodes, composants            |
| 12  | Architecture | nodes                           | kubelet, kube-proxy, fonctionnement         |
| 13  | Architecture | control-plane-components        | kube-apiserver, etcd, scheduler, controller |
| 14  | Overview     | api-intro                       | REST API, kubectl, clients                  |
| 15  | Overview     | api-versioning                  | Groupes API, alpha/beta/stable               |
| 16  | Architecture | controllers-pattern             | Boucles de contrôle, réconciliation         |

#### Partie 3 : Containers et Pods (10 chapitres)

| #   | Module     | Chapitre              | Objectif                                    |
| --- | ---------- | --------------------- | ------------------------------------------- |
| 17  | Containers | images-container      | Registries, pull policy, imagePullSecrets   |
| 18  | Containers | container-environment | Filesystem, variables d'environnement       |
| 19  | Workloads  | pods-intro            | Premier Pod, anatomie de base               |
| 20  | Workloads  | pod-lifecycle         | Phases, conditions, transitions             |
| 21  | Workloads  | pods-multi-containers | Patterns de communication inter-containers  |
| 22  | Workloads  | init-containers       | Initialisation, séquençage                  |
| 23  | Workloads  | sidecar-containers    | Pattern sidecar, use cases                  |
| 24  | Workloads  | ephemeral-containers  | Debugging avec containers éphémères         |
| 25  | Containers | lifecycle-hooks       | PostStart, PreStop                          |
| 26  | Workloads  | pod-qos               | Guaranteed, Burstable, BestEffort           |

#### Partie 4 : Controllers de Workloads (12 chapitres)

| #   | Module    | Chapitre              | Objectif                                    |
| --- | --------- | --------------------- | ------------------------------------------- |
| 27  | Workloads | replicasets           | Concept de réplication, sélecteurs          |
| 28  | Workloads | deployments-intro     | Création, scaling basique                   |
| 29  | Workloads | deployments-updates   | Rolling updates basiques                    |
| 30  | Workloads | deployments-avance    | Stratégies, rollback, pause, maxSurge      |
| 31  | Workloads | statefulsets-intro    | Concept, identité stable, ordre            |
| 32  | Workloads | statefulsets-avance   | Storage, headless services, updates         |
| 33  | Workloads | daemonsets            | Un pod par node, use cases                  |
| 34  | Workloads | jobs-intro            | Job one-shot basique                        |
| 35  | Workloads | jobs-avance           | Parallélisme, backoff, retries              |
| 36  | Workloads | cronjobs              | Tâches planifiées, timezones                |
| 37  | Workloads | pod-disruptions       | PodDisruptionBudgets, maintenance           |
| 38  | Workloads | downward-api          | Métadonnées Pod dans containers             |

#### Partie 5 : Autoscaling (3 chapitres)

| #   | Module    | Chapitre     | Objectif                                    |
| --- | --------- | ------------ | ------------------------------------------- |
| 39  | Workloads | hpa-intro    | Scaling CPU/mémoire basique                 |
| 40  | Workloads | hpa-avance   | Métriques custom, behavior, scaling policies |
| 41  | Workloads | vpa          | Scaling vertical, recommandations           |

#### Partie 6 : Networking et Services (12 chapitres)

| #   | Module              | Chapitre              | Objectif                                    |
| --- | ------------------- | --------------------- | ------------------------------------------- |
| 42  | Services-Networking | services-intro        | Concept, ClusterIP, sélecteurs              |
| 43  | Services-Networking | services-types        | NodePort, LoadBalancer, ExternalName        |
| 44  | Services-Networking | services-avance       | Affinity, headless, external IPs            |
| 45  | Services-Networking | endpoints             | EndpointSlices, internals, watch             |
| 46  | Services-Networking | dns-intro             | Découverte par DNS, FQDN                    |
| 47  | Services-Networking | dns-avance            | Pods DNS policy, config, custom DNS         |
| 48  | Services-Networking | ingress-intro         | Règles basiques, path routing               |
| 49  | Services-Networking | ingress-avance        | TLS, annotations, rewrite, canary            |
| 50  | Services-Networking | ingress-controllers   | NGINX, Traefik, configuration               |
| 51  | Services-Networking | gateway-api           | Nouvelle API, HTTPRoute, Gateway            |
| 52  | Services-Networking | network-policies-intro | Concept, ingress basique, isolation         |
| 53  | Services-Networking | network-policies-avance | Egress, CIDR, complex rules, multi-namespace |

#### Partie 7 : Storage (10 chapitres)

| #   | Module  | Chapitre              | Objectif                                    |
| --- | ------- | --------------------- | ------------------------------------------- |
| 54  | Storage | volumes-intro         | emptyDir, partage entre containers          |
| 55  | Storage | volumes-types         | hostPath, configMap, secret volumes         |
| 56  | Storage | pv-pvc-intro          | Concept, binding basique, statique          |
| 57  | Storage | pv-pvc-avance         | Access modes, reclaim policy, binding      |
| 58  | Storage | storage-class-intro   | Dynamic provisioning basique                |
| 59  | Storage | storage-class-avance  | Paramètres, binding modes, defaults         |
| 60  | Storage | ephemeral-volumes     | Volumes éphémères, CSI ephemeral            |
| 61  | Storage | projected-volumes     | Projection de plusieurs sources             |
| 62  | Storage | volume-snapshots      | Snapshots, backup/restore                   |
| 63  | Storage | csi                   | Plugins de stockage, concepts               |

#### Partie 8 : Configuration (8 chapitres)

| #   | Module        | Chapitre                    | Objectif                                    |
| --- | ------------- | --------------------------- | ------------------------------------------- |
| 64  | Configuration | configmaps-intro            | Création, env vars, utilisation             |
| 65  | Configuration | configmaps-avance           | Volumes, immutabilité, hot reload           |
| 66  | Configuration | secrets-intro               | Création, utilisation basique              |
| 67  | Configuration | secrets-avance              | Types, volumes, rotation                    |
| 68  | Configuration | resource-management-intro   | Requests, limits basiques                   |
| 69  | Configuration | resource-management-avance | QoS, OOM, scheduling, overcommit            |
| 70  | Configuration | probes-intro                | Liveness, readiness basiques                |
| 71  | Configuration | probes-avance               | Startup, timing, gRPC, exec/http/tcp        |

#### Partie 9 : Sécurité (10 chapitres)

| #   | Module   | Chapitre                  | Objectif                                    |
| --- | -------- | ------------------------- | ------------------------------------------- |
| 72  | Security | cloud-native-security     | Modèle 4C (Cloud, Cluster, Container, Code) |
| 73  | Security | controlling-api-access    | Vue d'ensemble AuthN/AuthZ                  |
| 74  | Security | service-accounts-intro     | Concept, utilisation basique                |
| 75  | Security | service-accounts-avance    | Tokens projetés, bonnes pratiques            |
| 76  | Security | rbac-intro                | Roles, RoleBindings, permissions            |
| 77  | Security | rbac-avance               | ClusterRoles, aggregation, best practices  |
| 78  | Security | pod-security-standards    | Privileged, Baseline, Restricted           |
| 79  | Security | pod-security-admission    | Enforcement par namespace, audit            |
| 80  | Security | linux-security-intro      | runAsUser, runAsNonRoot, fsGroup            |
| 81  | Security | linux-security-avance     | Capabilities, seccomp, AppArmor, SELinux   |

#### Partie 10 : Policies et Administration (8 chapitres)

| #   | Module        | Chapitre              | Objectif                                    |
| --- | ------------- | --------------------- | ------------------------------------------- |
| 82  | Policy        | resource-quotas       | Quotas namespace, limites                   |
| 83  | Policy        | limit-ranges          | Defaults, min/max par container             |
| 84  | Administration | logging               | Architecture logging, collecte            |
| 85  | Administration | observability         | Metrics, tracing, monitoring                |
| 86  | Administration | node-autoscaling      | Cluster Autoscaler, scaling horizontal      |
| 87  | Administration | certificates          | PKI, rotation, CA                           |
| 88  | Administration | admission-webhooks    | Validation, mutation, bonnes pratiques     |
| 89  | Administration | flow-control          | API Priority, fairness                      |

#### Partie 11 : Avancé - Extensions (6 chapitres)

| #   | Module           | Chapitre              | Objectif                                    |
| --- | ---------------- | --------------------- | ------------------------------------------- |
| 90  | Extend-Kubernetes | custom-resources      | CRDs, définition, validation                |
| 91  | Extend-Kubernetes | admission-webhooks-dev | Création, développement                     |
| 92  | Extend-Kubernetes | operators             | Pattern, frameworks, controllers           |
| 93  | Extend-Kubernetes | api-aggregation       | Extension API server                        |
| 94  | Extend-Kubernetes | kubectl-plugins       | Création de plugins kubectl                 |
| 95  | Overview         | labels-avance         | matchExpressions, nodeSelector avancé       |

**Total : 95 chapitres**

**Note** : Ce parcours couvre l'essentiel de Kubernetes pur. Les sujets très avancés (CNI/CSI development, device plugins, scheduler extensions) peuvent faire l'objet d'un parcours séparé "Extension de Kubernetes".
