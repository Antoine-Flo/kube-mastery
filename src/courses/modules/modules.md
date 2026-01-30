📘 PLATEFORME

├─ 🎯 MODULE : Onboarding
│  [prérequis: aucun]
│  └─ Chapitre : 01-bienvenue ✓
│     ├─ Leçon : Comment utiliser cette plateforme
│     ├─ Leçon : Votre environnement de pratique (kubectl + cluster)
│     └─ Leçon : Parcours vs Modules : comment choisir
│
├─ 🐳 MODULE : Containers
│  [prérequis: aucun]
│  ├─ Chapitre : 01-introduction
│  │  ├─ Leçon : Qu'est-ce qu'un container
│  │  ├─ Leçon : Containers vs VMs
│  │  └─ Leçon : Images et registries
│  └─ Chapitre : 02-images
│     ├─ Leçon : Anatomie d'une image
│     ├─ Leçon : Layers et optimisation
│     └─ Leçon : Tags et versioning
│
├─ ⚙️ MODULE : Kubernetes-Intro
│  [prérequis: aucun]
│  ├─ Chapitre : 01-concepts-fondamentaux ✓
│  │  ├─ Leçon : Qu'est-ce que Kubernetes
│  │  ├─ Leçon : Architecture : control plane et nodes
│  │  ├─ Leçon : Les objets Kubernetes
│  │  └─ Leçon : Namespaces et isolation
│  ├─ Chapitre : 02-kubectl-essentials ✓
│  │  ├─ Leçon : Commandes de base (get, describe, logs)
│  │  ├─ Leçon : Créer et modifier des ressources
│  │  ├─ Leçon : Delete et cleanup
│  │  └─ Leçon : Kubectl tips et raccourcis
│  └─ Chapitre : 03-yaml-manifests
│     ├─ Leçon : Structure d'un manifest Kubernetes
│     ├─ Leçon : apiVersion, kind, metadata, spec
│     ├─ Leçon : Labels et selectors
│     └─ Leçon : Annotations
│
├─ 🎁 MODULE : Pods
│  [prérequis: Kubernetes-Intro/01-concepts-fondamentaux, Kubernetes-Intro/02-kubectl-essentials]
│  ├─ Chapitre : 01-introduction ✓
│  │  ├─ Leçon : Qu'est-ce qu'un Pod
│  │  ├─ Leçon : Créer votre premier Pod
│  │  └─ Leçon : Cycle de vie d'un Pod
│  ├─ Chapitre : 02-operations
│  │  ├─ Leçon : Inspecter et débugger un Pod
│  │  └─ Leçon : Logs et exec
│  ├─ Chapitre : 03-configuration
│  │  ├─ Leçon : Variables d'environnement
│  │  ├─ Leçon : Ports et exposition
│  │  └─ Leçon : Commandes et arguments
│  ├─ Chapitre : 04-multi-containers
│  │  ├─ Leçon : Plusieurs containers dans un Pod
│  │  ├─ Leçon : Pattern sidecar
│  │  └─ Leçon : Pattern init containers
│  └─ Chapitre : 05-avance
│     ├─ Leçon : Resource requests et limits
│     ├─ Leçon : Liveness probes
│     ├─ Leçon : Readiness probes
│     └─ Leçon : Startup probes
│
├─ 📦 MODULE : ReplicaSets
│  [prérequis: Pods/01-introduction]
│  └─ Chapitre : 01-introduction ✓
│     ├─ Leçon : Pourquoi les ReplicaSets
│     ├─ Leçon : Créer un ReplicaSet
│     └─ Leçon : Scaling et self-healing
│
├─ 📦 MODULE : Deployments
│  [prérequis: ReplicaSets/01-introduction]
│  ├─ Chapitre : 01-introduction ✓
│  │  ├─ Leçon : Deployments vs ReplicaSets
│  │  ├─ Leçon : Créer un Deployment
│  │  └─ Leçon : Scaling un Deployment
│  ├─ Chapitre : 02-rolling-updates
│  │  ├─ Leçon : Mettre à jour un Deployment
│  │  ├─ Leçon : Rolling updates
│  │  └─ Leçon : Rollback et historique
│  ├─ Chapitre : 03-strategies
│  │  ├─ Leçon : Stratégies de déploiement (RollingUpdate, Recreate)
│  │  ├─ Leçon : Pause et resume
│  │  └─ Leçon : Rolling updates personnalisés (maxSurge, maxUnavailable)
│  └─ Chapitre : 04-troubleshooting
│     ├─ Leçon : Problèmes de rollout
│     └─ Leçon : Debugging avec kubectl rollout
│
├─ 🌐 MODULE : Services
│  [prérequis: Pods/01-introduction]
│  ├─ Chapitre : 01-introduction ✓
│  │  ├─ Leçon : Pourquoi les Services
│  │  ├─ Leçon : ClusterIP (par défaut)
│  │  └─ Leçon : Endpoints et discovery
│  ├─ Chapitre : 02-types-services
│  │  ├─ Leçon : NodePort
│  │  ├─ Leçon : LoadBalancer
│  │  └─ Leçon : ExternalName
│  └─ Chapitre : 03-avance
│     ├─ Leçon : Headless Services
│     └─ Leçon : Service selectors avancés
│
├─ 🌐 MODULE : Networking
│  [prérequis: Services/01-introduction]
│  ├─ Chapitre : 01-dns
│  │  ├─ Leçon : DNS dans Kubernetes
│  │  └─ Leçon : Résolution de noms de services
│  ├─ Chapitre : 02-ingress
│  │  ├─ Leçon : Qu'est-ce qu'un Ingress
│  │  ├─ Leçon : Ingress Controllers
│  │  ├─ Leçon : Routing basique (host et path)
│  │  └─ Leçon : TLS/SSL
│  └─ Chapitre : 03-network-policies
│     ├─ Leçon : Network Policies - Introduction
│     ├─ Leçon : Network Policies - Ingress rules
│     └─ Leçon : Network Policies - Egress rules
│
├─ 💾 MODULE : ConfigMaps
│  [prérequis: Pods/03-configuration]
│  ├─ Chapitre : 01-introduction
│  │  ├─ Leçon : Qu'est-ce qu'une ConfigMap
│  │  └─ Leçon : Créer une ConfigMap
│  ├─ Chapitre : 02-utilisation
│  │  ├─ Leçon : Utiliser via variables d'environnement
│  │  ├─ Leçon : Utiliser via volumes
│  │  └─ Leçon : Montage de fichiers spécifiques
│  └─ Chapitre : 03-avance
│     └─ Leçon : Updates et immutabilité
│
├─ 💾 MODULE : Secrets
│  [prérequis: ConfigMaps/01-introduction]
│  ├─ Chapitre : 01-introduction
│  │  ├─ Leçon : Qu'est-ce qu'un Secret
│  │  ├─ Leçon : Types de Secrets
│  │  └─ Leçon : Créer et utiliser des Secrets
│  ├─ Chapitre : 02-utilisation
│  │  ├─ Leçon : Secrets via env vs volumes
│  │  └─ Leçon : Base64 et limitations
│  └─ Chapitre : 03-securite
│     └─ Leçon : Best practices de sécurité
│
├─ 💿 MODULE : Volumes
│  [prérequis: Pods/01-introduction]
│  ├─ Chapitre : 01-volumes-ephemeres
│  │  ├─ Leçon : EmptyDir
│  │  ├─ Leçon : ConfigMap et Secret volumes
│  │  └─ Leçon : DownwardAPI volumes
│  ├─ Chapitre : 02-persistent-volumes
│  │  ├─ Leçon : PV et PVC - Concepts
│  │  ├─ Leçon : Créer un PV et PVC
│  │  ├─ Leçon : Binding et lifecycle
│  │  └─ Leçon : Access modes et reclaim policies
│  └─ Chapitre : 03-storage-classes
│     ├─ Leçon : Storage Classes
│     └─ Leçon : Dynamic provisioning
│
├─ 📊 MODULE : Observabilite
│  [prérequis: Pods/02-operations]
│  ├─ Chapitre : 01-logging
│  │  ├─ Leçon : Logs de containers (kubectl logs)
│  │  ├─ Leçon : Logs de containers précédents
│  │  ├─ Leçon : Suivre les logs en temps réel
│  │  └─ Leçon : Patterns de logging (stdout/stderr)
│  ├─ Chapitre : 02-monitoring
│  │  ├─ Leçon : Metrics API
│  │  ├─ Leçon : kubectl top
│  │  └─ Leçon : Resource usage
│  └─ Chapitre : 03-debugging
│     ├─ Leçon : kubectl describe et events
│     ├─ Leçon : kubectl debug
│     └─ Leçon : Troubleshooting Pods crashés
│
├─ 📦 MODULE : StatefulSets
│  [prérequis: Deployments/01-introduction, Services/03-avance, Volumes/02-persistent-volumes]
│  ├─ Chapitre : 01-introduction
│  │  ├─ Leçon : Applications stateful vs stateless
│  │  ├─ Leçon : Créer un StatefulSet
│  │  └─ Leçon : Identité stable et ordre
│  ├─ Chapitre : 02-operations
│  │  ├─ Leçon : Scaling et updates
│  │  └─ Leçon : Headless Services et StatefulSets
│  └─ Chapitre : 03-storage
│     └─ Leçon : StatefulSets et storage persistent
│
├─ 📦 MODULE : DaemonSets
│  [prérequis: Deployments/01-introduction]
│  └─ Chapitre : 01-introduction
│     ├─ Leçon : Qu'est-ce qu'un DaemonSet
│     ├─ Leçon : Cas d'usage typiques
│     └─ Leçon : Updates de DaemonSets
│
├─ 📦 MODULE : Jobs
│  [prérequis: Pods/01-introduction]
│  ├─ Chapitre : 01-jobs
│  │  ├─ Leçon : Jobs one-shot
│  │  ├─ Leçon : Parallélisme et completion
│  │  └─ Leçon : Backoff et retry
│  └─ Chapitre : 02-cronjobs
│     └─ Leçon : CronJobs planifiés
│
├─ 🔐 MODULE : RBAC
│  [prérequis: Kubernetes-Intro/01-concepts-fondamentaux]
│  ├─ Chapitre : 01-introduction
│  │  ├─ Leçon : ServiceAccounts
│  │  ├─ Leçon : Roles et permissions
│  │  └─ Leçon : ClusterRoles
│  ├─ Chapitre : 02-bindings
│  │  ├─ Leçon : RoleBindings et ClusterRoleBindings
│  │  └─ Leçon : Testing permissions (kubectl auth)
│  └─ Chapitre : 03-avance
│     └─ Leçon : Best practices RBAC
│
├─ 🔐 MODULE : Security-Contexts
│  [prérequis: Pods/01-introduction]
│  ├─ Chapitre : 01-introduction
│  │  ├─ Leçon : Pod Security Context
│  │  └─ Leçon : Container Security Context
│  ├─ Chapitre : 02-configuration
│  │  ├─ Leçon : runAsUser et runAsGroup
│  │  ├─ Leçon : Capabilities Linux
│  │  └─ Leçon : readOnlyRootFilesystem
│  └─ Chapitre : 03-pod-security-standards
│     ├─ Leçon : Pod Security Standards
│     └─ Leçon : Pod Security Admission
│
├─ 🎛️ MODULE : Resource-Management
│  [prérequis: Pods/05-avance]
│  ├─ Chapitre : 01-quotas
│  │  ├─ Leçon : LimitRanges
│  │  └─ Leçon : ResourceQuotas
│  ├─ Chapitre : 02-autoscaling
│  │  ├─ Leçon : HorizontalPodAutoscaler (HPA)
│  │  └─ Leçon : Métriques custom pour HPA
│  └─ Chapitre : 03-scheduling
│     ├─ Leçon : Node selectors
│     ├─ Leçon : Node affinity et anti-affinity
│     └─ Leçon : Taints et tolerations
│
├─ 🔧 MODULE : Helm
│  [prérequis: Kubernetes-Intro/03-yaml-manifests, Deployments/01-introduction]
│  ├─ Chapitre : 01-introduction
│  │  ├─ Leçon : Qu'est-ce que Helm
│  │  ├─ Leçon : Charts, releases, repositories
│  │  └─ Leçon : Architecture de Helm 3
│  ├─ Chapitre : 02-utilisation
│  │  ├─ Leçon : Rechercher des charts
│  │  ├─ Leçon : Installer une chart
│  │  ├─ Leçon : Gérer les releases
│  │  └─ Leçon : Values et configuration
│  └─ Chapitre : 03-creation-charts
│     ├─ Leçon : Structure d'une chart
│     ├─ Leçon : Templates et Go templating
│     └─ Leçon : Packager et partager une chart
│
└─ 🔍 MODULE : CoreDNS (Deep Dive)
   [prérequis: Networking/01-dns]
   ├─ Chapitre : 01-architecture
   │  ├─ Leçon : Architecture de CoreDNS dans Kubernetes
   │  └─ Leçon : Configuration Corefile
   ├─ Chapitre : 02-configuration
   │  ├─ Leçon : Custom DNS entries
   │  └─ Leçon : Plugins CoreDNS
   └─ Chapitre : 03-troubleshooting
      ├─ Leçon : Debugging DNS
      └─ Leçon : Problèmes courants de résolution DNS
