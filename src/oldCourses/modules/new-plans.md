# Architecture des Cours — Plan de Refonte

## Principes fondamentaux

### Modèle à 3 niveaux

| Niveau | Nom | Responsabilité | Taille cible | Exemple |
|--------|-----|----------------|-------------|---------|
| Atome | **Topic** | UN concept, UNE page, UN quiz | 5-10 min (300-500 mots) | "Qu'est-ce qu'un Pod" |
| Unité | **Module** | UN sujet Kubernetes complet | 30-60 min, 4-6 topics | "Les Pods" |
| Parcours | **Course** | UNE audience, UN objectif | 10-30h, N modules | "Prépa CKAD" |

### Règles de découpage des modules

- **1 module = 1 concept K8s, 1 niveau de profondeur, 1 audience claire**
- Si deux profils d'étudiants n'ont pas besoin du même sous-ensemble → c'est 2 modules
- Si un module dépasse 6 topics → split par niveau (basics / advanced)
- Chaque module porte ses **prérequis** (IDs d'autres modules) → forme un DAG
- Chaque module porte ses **tags** (certifications, niveau, domaine)

### Génération IA

Chaque module possède un `spec.md` qui fournit à l'IA :
- Les pages de la doc officielle K8s à référencer
- Ce que l'étudiant sait déjà (prérequis)
- Ce que le module couvre (scope)
- Ce qu'il NE couvre PAS (limites)
- Le format attendu (contraintes de style)

### Structure de fichiers par module

```
modules/
└── {module-id}/
    ├── module.ts              # Métadonnées, prérequis, tags
    ├── spec.md                # Spec de génération IA
    └── {NN-topic-name}/
        └── en/
            ├── content.md     # Contenu (300-500 mots, H1, callouts, code)
            └── quiz.ts        # Quiz (3-5 questions)
```

---

## Domaines d'examen (référence 2025)

### CKAD — Certified Kubernetes Application Developer

| Domaine | Poids |
|---------|-------|
| Application Design and Build | 20% |
| Application Deployment | 20% |
| Application Observability and Maintenance | 15% |
| Application Environment, Configuration and Security | 25% |
| Services and Networking | 20% |

### CKA — Certified Kubernetes Administrator

| Domaine | Poids |
|---------|-------|
| Cluster Architecture, Installation & Configuration | 25% |
| Workloads & Scheduling | 15% |
| Services & Networking | 20% |
| Storage | 10% |
| Troubleshooting | 30% |

### KCNA — Kubernetes and Cloud-Native Associate

| Domaine | Poids |
|---------|-------|
| Kubernetes Fundamentals | 46% |
| Container Orchestration | 22% |
| Cloud Native Architecture | 16% |
| Cloud Native Observability | 8% |
| Cloud Native Application Delivery | 8% |

> L'examen KCNA est un **QCM théorique** (pas de pratique CLI). Il valide la compréhension des concepts Kubernetes et de l'écosystème cloud-native (CNCF, service mesh, GitOps, Prometheus, etc.).

---

## Catalogue des modules

### 🏁 Foundation

#### `onboarding`

> Prise en main de la plateforme et contexte des certifications.

- Prérequis : aucun
- Tags : `ckad`, `cka`, `beginner`

| # | Topic | Description |
|---|-------|-------------|
| 1 | How to use this platform | Navigation, interface, terminal intégré |
| 2 | Your practice environment | kubectl, cluster, connexion |
| 3 | Certification overview | CKAD vs CKA, format, conseils |

---

#### `kubernetes-basics`

> Qu'est-ce que Kubernetes, pourquoi l'utiliser, vue d'ensemble de l'architecture.

- Prérequis : aucun
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/overview/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is Kubernetes | Orchestration de conteneurs, ce que K8s fait et ne fait pas |
| 2 | Evolution of deployment | Physique → VMs → Containers → Orchestration |
| 3 | Cluster architecture overview | Control plane vs worker nodes, vue 10 000 pieds |
| 4 | Control plane components | apiserver, etcd, scheduler, controller-manager |
| 5 | Node components | kubelet, kube-proxy, container runtime |

---

#### `yaml-and-objects`

> Comprendre la structure des objets Kubernetes et le format YAML.

- Prérequis : `kubernetes-basics`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/overview/working-with-objects/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Kubernetes object model | Entités persistantes, spec vs status, desired state |
| 2 | Anatomy of a manifest | apiVersion, kind, metadata, spec — décortiqué |
| 3 | Generating manifests from CLI | `kubectl run --dry-run=client -o yaml` |
| 4 | Object names, UIDs and DNS rules | Contraintes de nommage, identifiants uniques |

---

#### `kubectl-essentials`

> Maîtriser les commandes kubectl fondamentales.

- Prérequis : `yaml-and-objects`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/reference/kubectl/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Imperative vs declarative | Commandes impératives, kubectl apply, quand utiliser quoi |
| 2 | Viewing resources | get, describe, explain — lire et comprendre |
| 3 | Logs and exec | kubectl logs, kubectl exec — debugger un container |
| 4 | Creating and editing resources | create, apply, edit, patch, replace |
| 5 | Delete and cleanup | delete, --grace-period, force delete |
| 6 | Formatting output and tips | -o wide/yaml/json, JSONPath, custom-columns, certification tips |

---

#### `pods`

> Le Pod : unité de base de Kubernetes. Créer, inspecter, comprendre le cycle de vie.

- Prérequis : `kubectl-essentials`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/workloads/pods/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is a Pod | Pourquoi le Pod, relation pod/container, networking intra-pod |
| 2 | Pod structure | containers, ports, env — anatomie du manifest |
| 3 | Creating your first Pod | Impératif et déclaratif, premier déploiement |
| 4 | Pod lifecycle and phases | Pending, Running, Succeeded, Failed, Unknown |
| 5 | Container restart policies | Always, OnFailure, Never — impact sur le comportement |
| 6 | Editing Pods | Ce qu'on peut/ne peut pas modifier, recréation |

---

#### `namespaces`

> Isolation logique des ressources dans un cluster.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What are namespaces | Isolation logique, multi-tenancy léger |
| 2 | Default namespaces | default, kube-system, kube-public, kube-node-lease |
| 3 | Working across namespaces | -n flag, DNS cross-namespace, context defaults |
| 4 | When to use multiple namespaces | Stratégies d'organisation, bonnes pratiques |

---

#### `labels-and-annotations`

> Labels, sélecteurs et annotations : organiser et filtrer les objets.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What are labels | Paires clé/valeur, syntaxe, contraintes |
| 2 | Label selectors | Equality-based, set-based, matchLabels vs matchExpressions |
| 3 | Annotations | Métadonnées non identifiantes, cas d'usage |
| 4 | Recommended labels | Standards app.kubernetes.io/*, bonnes pratiques |

---

### 📦 Workloads

#### `replicasets`

> Maintenir un nombre stable de répliques de Pods.

- Prérequis : `labels-and-annotations`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Why ReplicaSets | Le problème : pods éphémères, besoin de réplication |
| 2 | Creating a ReplicaSet | Manifest, template, label selector |
| 3 | Scaling and self-healing | Scaling manuel, auto-remplacement des pods crashés |
| 4 | Limitations of ReplicaSets | Pourquoi on utilise des Deployments à la place |

---

#### `deployments`

> Déployer, scaler et mettre à jour des applications de manière déclarative.

- Prérequis : `replicasets`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/workloads/controllers/deployment/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is a Deployment | Deployments vs ReplicaSets, quand utiliser quoi |
| 2 | Creating a Deployment | Manifest, scaling basique |
| 3 | Rolling updates | Stratégie par défaut, mise à jour d'image |
| 4 | Rollback and revision history | kubectl rollout undo, history, annotations |
| 5 | Update strategies | RollingUpdate vs Recreate, maxSurge, maxUnavailable |

---

#### `deployment-strategies`

> Stratégies de déploiement avancées : blue-green, canary.

- Prérequis : `deployments`
- Tags : `ckad`, `intermediate`
- CKAD : Application Deployment (20%)

| # | Topic | Description |
|---|-------|-------------|
| 1 | Blue-green deployments | Concept, implémentation avec labels/services |
| 2 | Canary deployments | Concept, implémentation avec poids/répliques |
| 3 | Pause and resume rollouts | kubectl rollout pause/resume, cas d'usage |
| 4 | Choosing a deployment strategy | Arbre de décision, trade-offs |

---

#### `multi-container-pods`

> Patterns multi-containers : sidecar, init containers, ambassador.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/workloads/pods/init-containers/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Why multiple containers | Shared network/storage, cas d'usage |
| 2 | Sidecar pattern | Logging, proxy, sync — exemples concrets |
| 3 | Ambassador and adapter patterns | Proxy sortant, normalisation de données |
| 4 | Init containers | Séquençage, cas d'usage, différences avec app containers |

---

#### `jobs`

> Tâches one-shot et planifiées : Jobs et CronJobs.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/workloads/controllers/job/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is a Job | Tâche à exécution unique, complétion |
| 2 | Job parallelism and completions | Parallélisme, multiple completions |
| 3 | Backoff and retry | backoffLimit, activeDeadlineSeconds, TTL |
| 4 | CronJobs | Syntaxe cron, concurrencyPolicy, suspend |

---

#### `daemonsets`

> Un Pod par node : logging, monitoring, networking agents.

- Prérequis : `deployments`
- Tags : `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is a DaemonSet | Un pod par node, différence avec Deployment |
| 2 | Typical use cases | Logging (fluentd), monitoring (node-exporter), CNI |
| 3 | DaemonSet scheduling | Tolerations, nodeSelector, affinity |
| 4 | Updating DaemonSets | Rolling update, on delete |

---

#### `statefulsets`

> Applications stateful : identité stable, stockage persistant par pod.

- Prérequis : `deployments`, `persistent-storage`, `services`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Stateful vs stateless | Pourquoi les Deployments ne suffisent pas |
| 2 | StatefulSet fundamentals | Identité stable, nommage ordonné |
| 3 | Headless Services | Pourquoi et comment, DNS par pod |
| 4 | Storage in StatefulSets | volumeClaimTemplates, PVC par pod |
| 5 | Ordering and updates | Ordered/parallel pod management, rolling updates |

---

#### `autoscaling`

> Scaling automatique : HPA, VPA, resize in-place.

- Prérequis : `deployments`, `resource-management`
- Tags : `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Introduction to autoscaling | Pourquoi scaler automatiquement, approches |
| 2 | Horizontal Pod Autoscaler | HPA basé CPU/mémoire, configuration |
| 3 | HPA stabilization and behavior | Stabilization window, scaling policies |
| 4 | Vertical Pod Autoscaler | VPA concepts, modes (Off, Initial, Auto) |
| 5 | In-place resize of Pods | Resize sans restart (K8s 1.27+) |

---

### ⚙️ Configuration

#### `commands-and-args`

> Contrôler le point d'entrée et les arguments d'un container.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `beginner`

| # | Topic | Description |
|---|-------|-------------|
| 1 | Docker CMD vs ENTRYPOINT | Rappel Docker, override behavior |
| 2 | command and args in Kubernetes | Mapping Docker → K8s, syntaxe YAML |
| 3 | Practical: override scenarios | Exemples concrets, debugging tips |

---

#### `configmaps`

> Externaliser la configuration applicative.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/configuration/configmap/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is a ConfigMap | Concept, séparation config/code |
| 2 | Creating ConfigMaps | --from-literal, --from-file, --from-env-file, YAML |
| 3 | Using via environment variables | envFrom, valueFrom, variables individuelles |
| 4 | Using via volume mounts | Montage complet, fichiers spécifiques, subPath |
| 5 | Immutable ConfigMaps | Pourquoi, comment, impact |

---

#### `secrets`

> Gérer les données sensibles (mots de passe, tokens, clés).

- Prérequis : `configmaps`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/configuration/secret/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is a Secret | Différence avec ConfigMap, encoding base64 |
| 2 | Types of Secrets | Opaque, docker-registry, tls, basic-auth |
| 3 | Creating and using Secrets | CLI, YAML, env vars, volume mounts |
| 4 | Encrypting Secrets at rest | EncryptionConfiguration, etcd encryption |
| 5 | Security best practices | Limitations, RBAC, external secret managers |

---

#### `resource-management`

> Contrôler CPU et mémoire : requests, limits, QoS.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Resource requests and limits | CPU (millicores), mémoire (Mi/Gi), syntaxe |
| 2 | How scheduling uses requests | Le scheduler et les requests, overcommit |
| 3 | What happens when limits are exceeded | OOMKilled, CPU throttling |
| 4 | QoS classes | Guaranteed, Burstable, BestEffort — impact éviction |
| 5 | LimitRanges and ResourceQuotas | Defaults namespace, limites globales |

---

#### `probes`

> Health checks : liveness, readiness, startup probes.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Why probes matter | Détection de pannes, traffic routing |
| 2 | Liveness probes | Quand le container est mort, restart automatique |
| 3 | Readiness probes | Quand le container n'est pas prêt, retrait du Service |
| 4 | Startup probes | Applications lentes à démarrer, protection |
| 5 | Probe types and configuration | httpGet, tcpSocket, exec, timing parameters |

---

#### `security-contexts`

> Contrôler les privilèges de sécurité des containers.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/tasks/configure-pod-container/security-context/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Security in Docker (recap) | Namespaces Linux, capabilities, root vs non-root |
| 2 | Pod vs container security context | Niveaux d'application, héritage |
| 3 | runAsUser, runAsGroup, runAsNonRoot | Contrôler l'identité du process |
| 4 | Capabilities and readOnlyRootFilesystem | Ajouter/retirer des capabilities, filesystem en lecture seule |

---

#### `service-accounts`

> Identité des Pods pour accéder à l'API Kubernetes.

- Prérequis : `pods`, `namespaces`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/security/service-accounts/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is a ServiceAccount | Identité pod, default SA, différence avec users |
| 2 | Creating and assigning SAs | Créer un SA, l'assigner à un pod |
| 3 | Token projection and automount | Projected tokens, automountServiceAccountToken |
| 4 | Practical scenarios | Accès API depuis un pod, debugging |

---

### 🌐 Networking

#### `services`

> Exposer des Pods avec un point d'accès réseau stable.

- Prérequis : `pods`, `labels-and-annotations`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/services-networking/service/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Why Services | IP éphémères des pods, besoin d'abstraction |
| 2 | Service and endpoints | Mécanisme de sélection, endpoints automatiques |
| 3 | ClusterIP | Type par défaut, accès interne uniquement |
| 4 | NodePort | Exposer sur un port de chaque node |
| 5 | LoadBalancer | Intégration cloud, IP externe |
| 6 | Named ports | Nommage des ports, bonnes pratiques |

---

#### `dns`

> Découverte de services via DNS interne.

- Prérequis : `services`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/

| # | Topic | Description |
|---|-------|-------------|
| 1 | DNS in Kubernetes | CoreDNS, résolution automatique |
| 2 | Service DNS records | `svc-name.namespace.svc.cluster.local` |
| 3 | Pod DNS records | Pods DNS, hostname et subdomain |
| 4 | DNS debugging | nslookup, dig depuis un pod, dépannage |

---

#### `ingress`

> Router le trafic HTTP/HTTPS externe vers les Services.

- Prérequis : `services`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/services-networking/ingress/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is Ingress | Concept, Ingress vs Service LoadBalancer |
| 2 | Ingress controllers | NGINX, Traefik — déploiement nécessaire |
| 3 | Routing rules | Host-based, path-based, default backend |
| 4 | TLS termination | Certificats, Secrets TLS, HTTPS |
| 5 | Annotations and rewrite-target | Configuration spécifique au controller |

---

#### `gateway-api`

> La nouvelle API de Gateway : remplacement moderne d'Ingress.

- Prérequis : `ingress`
- Tags : `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/services-networking/gateway/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Introduction to Gateway API | Pourquoi remplacer Ingress, avantages |
| 2 | Gateway API structure | Gateway, HTTPRoute, GatewayClass |
| 3 | Practical Gateway API | Déployer et configurer |
| 4 | TLS with Gateway API | TLS terminate mode, passthrough |
| 5 | Mapping Ingress to Gateway API | Migration, équivalences |

---

#### `network-policies`

> Contrôler le trafic réseau entre Pods.

- Prérequis : `services`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/services-networking/network-policies/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What are Network Policies | Concept, deny-all par défaut |
| 2 | NetworkPolicy structure | podSelector, policyTypes, rules |
| 3 | Ingress rules | Autoriser le trafic entrant, from selectors |
| 4 | Egress rules | Autoriser le trafic sortant, to selectors |
| 5 | Advanced rules | CIDR blocks, ports, protocols, except |

---

### 💾 Storage

#### `volumes`

> Partager et persister des données dans un Pod.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/storage/volumes/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Why volumes | Filesystem éphémère des containers, besoin de persistance |
| 2 | emptyDir | Partage entre containers, scratch space |
| 3 | hostPath | Monter un chemin du node, risques |
| 4 | configMap and secret volumes | Monter ConfigMaps et Secrets comme fichiers |

---

#### `persistent-storage`

> Persistent Volumes et Claims : stockage découplé du Pod.

- Prérequis : `volumes`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/storage/persistent-volumes/

| # | Topic | Description |
|---|-------|-------------|
| 1 | PV and PVC concepts | Séparation admin/dev, lifecycle |
| 2 | Creating a PersistentVolume | Manifest, capacity, accessModes |
| 3 | Creating a PersistentVolumeClaim | Binding, request vs capacity |
| 4 | Using PVCs in Pods | volumeMounts, claimName |
| 5 | Access modes and reclaim policies | RWO, ROX, RWX, Retain, Delete, Recycle |

---

#### `storage-classes`

> Provisionnement dynamique de volumes.

- Prérequis : `persistent-storage`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/storage/storage-classes/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Static vs dynamic provisioning | Le problème du provisionnement manuel |
| 2 | What is a StorageClass | Provisioner, parameters, reclaimPolicy |
| 3 | Dynamic provisioning in practice | Créer une SC, l'utiliser avec un PVC |
| 4 | Container Storage Interface | CSI concept, plugins courants |

---

### 🔐 Security

#### `authentication`

> Comment Kubernetes identifie les utilisateurs et les pods.

- Prérequis : `kubernetes-basics`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/reference/access-authn-authz/authentication/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Security primitives | Qui peut accéder ? Que peut-il faire ? |
| 2 | Authentication methods | Certificates, tokens, OIDC — vue d'ensemble |
| 3 | Users vs ServiceAccounts | Humains vs machines, pas d'objet User dans K8s |

---

#### `tls-certificates`

> PKI Kubernetes : créer, gérer et renouveler les certificats TLS.

- Prérequis : `authentication`
- Tags : `cka`, `advanced`
- Réf doc : https://kubernetes.io/docs/setup/best-practices/certificates/

| # | Topic | Description |
|---|-------|-------------|
| 1 | TLS and PKI basics | Chiffrement asymétrique, CA, chaîne de confiance |
| 2 | TLS in Kubernetes | Quels composants utilisent TLS, quels certificats |
| 3 | Certificate creation | openssl, cfssl — générer des certs pour K8s |
| 4 | Viewing certificate details | Inspecter les certs existants, expiration |
| 5 | Certificates API | CertificateSigningRequest, approbation, rotation |

---

#### `kubeconfig`

> Configurer l'accès au cluster : contextes, utilisateurs, clusters.

- Prérequis : `authentication`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/

| # | Topic | Description |
|---|-------|-------------|
| 1 | KubeConfig basics | Pourquoi kubeconfig, localisation par défaut |
| 2 | Structure: clusters, users, contexts | Les 3 sections, comment elles s'articulent |
| 3 | Switching contexts | kubectl config use-context, current-context |
| 4 | Creating kubeconfig from scratch | Construire un fichier complet manuellement |

---

#### `rbac`

> Contrôler les permissions : Roles, RoleBindings, ClusterRoles.

- Prérequis : `service-accounts`, `kubeconfig`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/reference/access-authn-authz/rbac/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Authorization methods overview | RBAC, ABAC, webhooks — pourquoi RBAC |
| 2 | Roles and RoleBindings | Permissions namespace-scoped, création |
| 3 | ClusterRoles and ClusterRoleBindings | Permissions cluster-wide |
| 4 | Testing permissions | kubectl auth can-i, impersonation |
| 5 | RBAC best practices | Least privilege, audit, agrégation |

---

#### `image-security`

> Sécuriser l'approvisionnement des images container.

- Prérequis : `pods`
- Tags : `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/containers/images/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Image naming and registries | Registry privé, fully qualified image names |
| 2 | imagePullSecrets | Créer et utiliser des secrets de registry |
| 3 | Image pull policies | Always, IfNotPresent, Never — impact |

---

#### `admission-controllers`

> Intercepter et modifier les requêtes API avant persistence.

- Prérequis : `rbac`
- Tags : `ckad`, `cka`, `advanced`
- Réf doc : https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What are admission controllers | Chaîne de traitement API, built-in controllers |
| 2 | Enabling and disabling | kube-apiserver flags, controllers courants |
| 3 | Validating webhooks | Rejeter les requêtes non conformes |
| 4 | Mutating webhooks | Modifier les requêtes à la volée, injection de sidecar |

---

#### `pod-security`

> Pod Security Standards et Pod Security Admission.

- Prérequis : `security-contexts`, `namespaces`
- Tags : `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/security/pod-security-standards/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Pod Security Standards | Privileged, Baseline, Restricted — les 3 niveaux |
| 2 | Pod Security Admission | Labels de namespace, enforce/audit/warn |
| 3 | Practical enforcement | Appliquer des standards à un namespace |

---

### 📅 Scheduling

#### `scheduling-basics`

> Contrôler où les Pods s'exécutent : taints, tolerations, affinity.

- Prérequis : `pods`, `labels-and-annotations`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/concepts/scheduling-eviction/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Taints and tolerations | Repousser les pods, NoSchedule, NoExecute, PreferNoSchedule |
| 2 | Node selectors | Placer un pod sur un node spécifique (simple) |
| 3 | Node affinity | requiredDuringScheduling, preferredDuringScheduling |
| 4 | Taints vs node affinity | Quand utiliser quoi, combiner les deux |

---

#### `advanced-scheduling`

> Scheduling avancé : static pods, priority, multi-schedulers.

- Prérequis : `scheduling-basics`
- Tags : `cka`, `advanced`
- Réf doc : https://kubernetes.io/docs/concepts/scheduling-eviction/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Manual scheduling | Assigner un pod à un node sans scheduler |
| 2 | Static Pods | Pods gérés par kubelet, manifests statiques |
| 3 | Priority classes | PriorityClass, preemption |
| 4 | Multiple schedulers | Déployer un scheduler custom, schedulerName |
| 5 | Scheduler profiles | Configurer les plugins du scheduler |

---

### 📊 Observability

#### `logging-and-monitoring`

> Logs, métriques et événements pour surveiller les applications.

- Prérequis : `pods`
- Tags : `ckad`, `cka`, `beginner`
- Réf doc : https://kubernetes.io/docs/concepts/cluster-administration/logging/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Container logging basics | kubectl logs, -f, --previous, multi-container |
| 2 | Monitoring with metrics server | kubectl top pods/nodes, installation |
| 3 | Kubernetes events | kubectl get events, describe, event sources |
| 4 | Monitoring cluster component logs | Logs apiserver, scheduler, kubelet |

---

#### `troubleshooting`

> Diagnostiquer et résoudre les pannes application et cluster.

- Prérequis : `logging-and-monitoring`, `services`, `deployments`
- Tags : `cka`, `intermediate`
- CKA : Troubleshooting (30% — le plus gros domaine !)

| # | Topic | Description |
|---|-------|-------------|
| 1 | Troubleshooting application failures | CrashLoopBackOff, ImagePullBackOff, pending pods |
| 2 | Troubleshooting service connectivity | Endpoints manquants, DNS, network policies |
| 3 | Troubleshooting control plane | apiserver, etcd, scheduler, controller-manager down |
| 4 | Troubleshooting worker nodes | Node NotReady, kubelet, disk pressure |
| 5 | Systematic debugging methodology | Approche structurée, checklist de diagnostic |

---

### 🏗️ Cluster Administration (CKA)

#### `cluster-architecture-deep`

> Plongée dans les composants internes du cluster.

- Prérequis : `kubernetes-basics`
- Tags : `cka`, `advanced`

| # | Topic | Description |
|---|-------|-------------|
| 1 | etcd deep dive | Stockage clé-valeur, consensus, HA |
| 2 | kube-apiserver internals | Processing pipeline, admission, audit |
| 3 | kube-scheduler internals | Filtering, scoring, extensibilité |
| 4 | kube-controller-manager | Controllers built-in, reconciliation loops |
| 5 | Container Runtime Interface | CRI, containerd, CRI-O, dockershim deprecation |

---

#### `cluster-installation`

> Installer un cluster Kubernetes avec kubeadm.

- Prérequis : `cluster-architecture-deep`
- Tags : `cka`, `advanced`
- Réf doc : https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Installation options overview | Managed vs self-hosted, minikube/kind/kubeadm |
| 2 | kubeadm: master node setup | kubeadm init, phases, CNI |
| 3 | kubeadm: worker node join | kubeadm join, token, discovery |
| 4 | High availability considerations | Multi-master, etcd topology, LB |

---

#### `cluster-maintenance`

> Maintenir un cluster en production : upgrades, drain, eviction.

- Prérequis : `cluster-installation`
- Tags : `cka`, `advanced`
- Réf doc : https://kubernetes.io/docs/tasks/administer-cluster/

| # | Topic | Description |
|---|-------|-------------|
| 1 | OS upgrades and drain | kubectl drain, cordon, uncordon |
| 2 | Version skew policy | Compatibilité entre composants |
| 3 | Cluster upgrade process | kubeadm upgrade plan/apply, worker upgrade |
| 4 | Taint-based evictions | Eviction automatique, tolerationSeconds |

---

#### `backup-and-restore`

> Sauvegarder et restaurer l'état du cluster via etcd.

- Prérequis : `cluster-architecture-deep`
- Tags : `cka`, `advanced`
- Réf doc : https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/

| # | Topic | Description |
|---|-------|-------------|
| 1 | Backup strategies | Ressources YAML vs etcd snapshot |
| 2 | etcd backup with ETCDCTL | ETCDCTL_API=3, snapshot save |
| 3 | Restore from snapshot | snapshot restore, reconfiguration |
| 4 | ETCDUTL | Nouvel outil, migration depuis ETCDCTL |

---

#### `networking-fundamentals`

> Prérequis réseau pour le CKA : switching, routing, DNS, namespaces.

- Prérequis : `kubernetes-basics`
- Tags : `cka`, `advanced`

| # | Topic | Description |
|---|-------|-------------|
| 1 | Switching and routing | Interfaces, routes, gateways (rappels Linux) |
| 2 | DNS fundamentals | Résolution, /etc/hosts, /etc/resolv.conf |
| 3 | Network namespaces | Isolation réseau Linux, veth pairs |
| 4 | Docker networking | Bridge, host, none — rappel |

---

#### `kubernetes-networking`

> Réseau interne Kubernetes : CNI, pod networking, service networking.

- Prérequis : `networking-fundamentals`, `services`
- Tags : `cka`, `advanced`
- Réf doc : https://kubernetes.io/docs/concepts/cluster-administration/networking/

| # | Topic | Description |
|---|-------|-------------|
| 1 | CNI concepts | Container Network Interface, plugins |
| 2 | Pod networking | Modèle réseau K8s, communication inter-pods |
| 3 | Service networking | kube-proxy modes (iptables, IPVS), ClusterIP internals |
| 4 | Cluster networking configuration | Configurer le réseau, CNI Weave/Calico/Flannel |
| 5 | IPAM | IP Address Management, pod CIDR |

---

### 🧩 Extensions

#### `api-and-versioning`

> Groupes d'API, versions et politique de dépréciation.

- Prérequis : `kubectl-essentials`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://kubernetes.io/docs/reference/using-api/

| # | Topic | Description |
|---|-------|-------------|
| 1 | API groups | /api (core), /apis (named groups) |
| 2 | API versions | alpha, beta, stable — signification |
| 3 | API deprecation policy | Durée de support, migration |
| 4 | Field selectors | Filtrer par champs (status.phase, metadata.name) |

---

#### `custom-resources`

> Étendre Kubernetes avec des CRDs et des controllers custom.

- Prérequis : `api-and-versioning`
- Tags : `ckad`, `cka`, `advanced`
- Réf doc : https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What are Custom Resources | Étendre l'API, CRDs |
| 2 | Creating a CRD | Manifest, validation, schema |
| 3 | Custom controllers | Reconciliation, watch, react |
| 4 | Operator pattern | Operators, frameworks (Operator SDK, kubebuilder) |

---

#### `helm`

> Gestionnaire de packages Kubernetes.

- Prérequis : `kubectl-essentials`
- Tags : `ckad`, `cka`, `intermediate`
- Réf doc : https://helm.sh/docs/

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is Helm | Charts, releases, repositories — concepts |
| 2 | Installing Helm | Installation, configuration |
| 3 | Working with charts | helm install, upgrade, rollback, uninstall |
| 4 | Values and configuration | values.yaml, --set, override hierarchy |
| 5 | Finding and using charts | helm search, artifact hub, helm repo |

---

### ☁️ Cloud Native Ecosystem (KCNA)

#### `containers-fundamentals`

> Comprendre les conteneurs, les runtimes et les standards OCI.

- Prérequis : aucun
- Tags : `kcna`, `beginner`

| # | Topic | Description |
|---|-------|-------------|
| 1 | What are containers | Isolation, namespaces Linux, cgroups — concept |
| 2 | Containers vs VMs | Différences architecturales, avantages/inconvénients |
| 3 | Container runtimes | containerd, CRI-O, Docker, CRI — la chaîne |
| 4 | OCI standards | Open Container Initiative, image spec, runtime spec |
| 5 | Container images | Layers, registries, tags, digests |

---

#### `cloud-native-ecosystem`

> L'écosystème cloud-native : CNCF, standards ouverts, gouvernance Kubernetes.

- Prérequis : `kubernetes-basics`
- Tags : `kcna`, `beginner`

| # | Topic | Description |
|---|-------|-------------|
| 1 | What is cloud-native | Définition CNCF, principes, 12-factor apps |
| 2 | The CNCF landscape | Projets graduated/incubating/sandbox, catégories |
| 3 | Open standards | OCI, CNI, CRI, CSI, SMI — pourquoi les standards comptent |
| 4 | KEPs and SIGs | Comment Kubernetes évolue, processus de contribution |
| 5 | Serverless on Kubernetes | Knative, concepts FaaS, quand l'utiliser |

---

#### `observability-concepts`

> Concepts d'observabilité : métriques, SLO/SLA/SLI, introduction à Prometheus.

- Prérequis : `logging-and-monitoring`
- Tags : `kcna`, `intermediate`

| # | Topic | Description |
|---|-------|-------------|
| 1 | Observability fundamentals | Logs, métriques, traces — les 3 piliers |
| 2 | SLO, SLA, SLI | Définitions, exemples concrets, error budgets |
| 3 | Prometheus basics | Architecture, pull model, PromQL intro |
| 4 | Prometheus on Kubernetes | Node exporter, kube-state-metrics, monitoring des pods |
| 5 | Cost management | Coûts cloud, right-sizing, outils d'optimisation |

---

#### `service-mesh`

> Service mesh : proxy sidecar, Envoy, Istio.

- Prérequis : `services`, `multi-container-pods`
- Tags : `kcna`, `intermediate`

| # | Topic | Description |
|---|-------|-------------|
| 1 | Monoliths vs microservices | Évolution architecturale, challenges des microservices |
| 2 | What is a service mesh | Concept, data plane vs control plane |
| 3 | Envoy proxy | Sidecar proxy, fonctionnalités, rôle dans le mesh |
| 4 | Istio introduction | Architecture, installation, traffic management |
| 5 | When to use a service mesh | Trade-offs, complexité vs bénéfices |

---

#### `gitops`

> GitOps : principes, CI/CD cloud-native, ArgoCD.

- Prérequis : `deployments`, `helm`
- Tags : `kcna`, `intermediate`

| # | Topic | Description |
|---|-------|-------------|
| 1 | Application delivery fundamentals | Build, ship, run — pipeline overview |
| 2 | What is GitOps | Git comme source de vérité, principes fondamentaux |
| 3 | Push vs pull-based deployments | Modèles de déploiement, avantages du pull |
| 4 | ArgoCD introduction | Architecture, Application CRD, sync |
| 5 | CI/CD with GitOps | Pipeline complète, intégration CI + CD GitOps |

---

## Graphe de prérequis (vue simplifiée)

```
onboarding
    └─→ kubernetes-basics
            └─→ yaml-and-objects
                    └─→ kubectl-essentials
                            └─→ pods ──────────────────────────────────────────┐
                                 ├─→ namespaces                                │
                                 ├─→ labels-and-annotations                    │
                                 │       ├─→ replicasets                        │
                                 │       │       └─→ deployments               │
                                 │       │               ├─→ deployment-strategies
                                 │       │               ├─→ daemonsets (CKA)  │
                                 │       │               ├─→ statefulsets ←─────┤(+ persistent-storage, services)
                                 │       │               └─→ autoscaling ←─────┤(+ resource-management)
                                 │       └─→ scheduling-basics                 │
                                 │               └─→ advanced-scheduling (CKA) │
                                 ├─→ commands-and-args                         │
                                 ├─→ configmaps                                │
                                 │       └─→ secrets                           │
                                 ├─→ resource-management                       │
                                 ├─→ probes                                    │
                                 ├─→ security-contexts                         │
                                 │       └─→ pod-security (CKA)                │
                                 ├─→ multi-container-pods                      │
                                 ├─→ service-accounts                          │
                                 ├─→ logging-and-monitoring                    │
                                 │       └─→ troubleshooting (CKA)             │
                                 ├─→ jobs                                      │
                                 ├─→ volumes                                   │
                                 │       └─→ persistent-storage                │
                                 │               └─→ storage-classes           │
                                 ├─→ services ←────────────────────────────────┘(+ labels-and-annotations)
                                 │       ├─→ dns
                                 │       ├─→ ingress
                                 │       │       └─→ gateway-api (CKA)
                                 │       └─→ network-policies
                                 └─→ image-security (CKA)

            └─→ authentication
                    ├─→ tls-certificates (CKA)
                    └─→ kubeconfig
                            └─→ rbac (+ service-accounts)
                                    └─→ admission-controllers

            └─→ cluster-architecture-deep (CKA)
                    ├─→ cluster-installation
                    │       └─→ cluster-maintenance
                    └─→ backup-and-restore

            └─→ networking-fundamentals (CKA)
                    └─→ kubernetes-networking (+ services)

kubectl-essentials
    ├─→ api-and-versioning
    │       └─→ custom-resources
    └─→ helm
```

---

## Parcours CKAD — Certified Kubernetes Application Developer

**Objectif** : Préparer l'examen CKAD — concevoir, déployer, configurer et exposer des applications sur Kubernetes.
**Durée estimée** : 25-30h
**Nombre de modules** : 30
**Prérequis** : Connaissances de base Linux, Docker, YAML (→ parcours Prerequisites)

### Section 1 — Foundations (7 modules)
> Se familiariser avec Kubernetes, créer et inspecter ses premiers objets.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 1 | `onboarding` | — |
| 2 | `kubernetes-basics` | — |
| 3 | `yaml-and-objects` | Application Design and Build |
| 4 | `kubectl-essentials` | Application Design and Build |
| 5 | `pods` | Application Design and Build |
| 6 | `namespaces` | Application Environment |
| 7 | `labels-and-annotations` | Application Deployment |

### Section 2 — Application Design and Build (4 modules)
> Construire des applications : commandes, multi-containers, jobs.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 8 | `commands-and-args` | Application Design and Build |
| 9 | `multi-container-pods` | Application Design and Build |
| 10 | `jobs` | Application Design and Build |
| 11 | `configmaps` | Application Design and Build |

### Section 3 — Application Configuration (4 modules)
> Configurer les applications : secrets, resources, probes, security.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 12 | `secrets` | Application Environment |
| 13 | `resource-management` | Application Environment |
| 14 | `probes` | Application Observability |
| 15 | `security-contexts` | Application Environment |

### Section 4 — Scaling and Deployment (3 modules)
> Déployer à l'échelle : ReplicaSets, Deployments, stratégies.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 16 | `replicasets` | Application Deployment |
| 17 | `deployments` | Application Deployment |
| 18 | `deployment-strategies` | Application Deployment |

### Section 5 — Services and Networking (4 modules)
> Exposer les applications : Services, DNS, Ingress, Network Policies.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 19 | `services` | Services and Networking |
| 20 | `dns` | Services and Networking |
| 21 | `ingress` | Services and Networking |
| 22 | `network-policies` | Services and Networking |

### Section 6 — State Persistence (3 modules)
> Persister les données : Volumes, PV/PVC, StatefulSets.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 23 | `volumes` | Application Design and Build |
| 24 | `persistent-storage` | Application Design and Build |
| 25 | `statefulsets` | Application Design and Build |

### Section 7 — Security and API (5 modules)
> Sécuriser l'accès et étendre Kubernetes.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 26 | `service-accounts` | Application Environment |
| 27 | `authentication` | Application Environment |
| 28 | `kubeconfig` | Application Environment |
| 29 | `rbac` | Application Environment |
| 30 | `admission-controllers` | Application Environment |

### Section 8 — Observability and Tools (4 modules)
> Surveiller, débugger, utiliser Helm et comprendre l'API.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 31 | `logging-and-monitoring` | Application Observability |
| 32 | `api-and-versioning` | Application Environment |
| 33 | `custom-resources` | Application Environment |
| 34 | `helm` | Application Design and Build |

---

## Parcours CKA — Certified Kubernetes Administrator

**Objectif** : Préparer l'examen CKA — installer, configurer, administrer et dépanner un cluster Kubernetes.
**Durée estimée** : 30-35h
**Nombre de modules** : 39
**Prérequis** : Connaissances de base Linux, Docker, YAML (→ parcours Prerequisites)

> Le CKA partage la majorité des modules "Foundation" et "Application" avec le CKAD. Les modules marqués 🆕 sont spécifiques au CKA.

### Section 1 — Foundations (7 modules)
> Identique au CKAD : se familiariser avec Kubernetes.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 1 | `onboarding` | — |
| 2 | `kubernetes-basics` | Cluster Architecture |
| 3 | `yaml-and-objects` | Cluster Architecture |
| 4 | `kubectl-essentials` | Cluster Architecture |
| 5 | `pods` | Workloads & Scheduling |
| 6 | `namespaces` | Cluster Architecture |
| 7 | `labels-and-annotations` | Workloads & Scheduling |

### Section 2 — Cluster Architecture Deep Dive (3 modules) 🆕
> Comprendre les composants internes du cluster.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 8 | 🆕 `cluster-architecture-deep` | Cluster Architecture (25%) |
| 9 | 🆕 `networking-fundamentals` | Services & Networking |
| 10 | 🆕 `kubernetes-networking` | Services & Networking (20%) |

### Section 3 — Workloads and Scheduling (8 modules)
> Déployer et planifier des workloads.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 11 | `commands-and-args` | Workloads & Scheduling |
| 12 | `configmaps` | Workloads & Scheduling |
| 13 | `secrets` | Workloads & Scheduling |
| 14 | `resource-management` | Workloads & Scheduling (15%) |
| 15 | `replicasets` | Workloads & Scheduling |
| 16 | `deployments` | Workloads & Scheduling |
| 17 | 🆕 `daemonsets` | Workloads & Scheduling |
| 18 | `multi-container-pods` | Workloads & Scheduling |

### Section 4 — Scheduling (2 modules)
> Contrôler le placement des Pods.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 19 | `scheduling-basics` | Workloads & Scheduling (15%) |
| 20 | 🆕 `advanced-scheduling` | Workloads & Scheduling |

### Section 5 — Application Lifecycle (3 modules)
> Probes, jobs, autoscaling.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 21 | `probes` | Workloads & Scheduling |
| 22 | `jobs` | Workloads & Scheduling |
| 23 | 🆕 `autoscaling` | Workloads & Scheduling |

### Section 6 — Services and Networking (5 modules)
> Exposer et sécuriser le trafic réseau.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 24 | `services` | Services & Networking (20%) |
| 25 | `dns` | Services & Networking |
| 26 | `ingress` | Services & Networking |
| 27 | 🆕 `gateway-api` | Services & Networking |
| 28 | `network-policies` | Services & Networking |

### Section 7 — Storage (4 modules)
> Persister les données, provisionnement dynamique.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 29 | `volumes` | Storage (10%) |
| 30 | `persistent-storage` | Storage |
| 31 | `storage-classes` | Storage |
| 32 | `statefulsets` | Workloads & Scheduling |

### Section 8 — Security (7 modules)
> Sécuriser le cluster : authentification, RBAC, TLS, admission.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 33 | `service-accounts` | Cluster Architecture |
| 34 | `authentication` | Cluster Architecture (25%) |
| 35 | 🆕 `tls-certificates` | Cluster Architecture |
| 36 | `kubeconfig` | Cluster Architecture |
| 37 | `rbac` | Cluster Architecture |
| 38 | `security-contexts` | Cluster Architecture |
| 39 | 🆕 `image-security` | Cluster Architecture |
| 40 | `admission-controllers` | Cluster Architecture |
| 41 | 🆕 `pod-security` | Cluster Architecture |

### Section 9 — Cluster Administration (3 modules) 🆕
> Installer, upgrader et sauvegarder un cluster.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 42 | 🆕 `cluster-installation` | Cluster Architecture (25%) |
| 43 | 🆕 `cluster-maintenance` | Cluster Architecture |
| 44 | 🆕 `backup-and-restore` | Cluster Architecture |

### Section 10 — Observability and Troubleshooting (2 modules)
> Diagnostiquer et résoudre les problèmes (30% de l'examen !).

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 45 | `logging-and-monitoring` | Troubleshooting (30%) |
| 46 | 🆕 `troubleshooting` | Troubleshooting |

### Section 11 — Extensions and Tools (3 modules)
> Étendre Kubernetes et utiliser Helm.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 47 | `api-and-versioning` | Cluster Architecture |
| 48 | `custom-resources` | Cluster Architecture |
| 49 | `helm` | Cluster Architecture |

---

## Parcours KCNA — Kubernetes and Cloud-Native Associate

**Objectif** : Préparer l'examen KCNA — comprendre les concepts Kubernetes et l'écosystème cloud-native.
**Format d'examen** : QCM théorique (pas de CLI), 90 minutes, 60 questions.
**Durée estimée** : 15-20h
**Nombre de modules** : 22
**Prérequis** : Aucun (le KCNA est la porte d'entrée)
**Progression recommandée** : KCNA → CKAD → CKA

> Le KCNA est plus large que le CKAD/CKA sur l'écosystème cloud-native (CNCF, service mesh, GitOps, Prometheus) mais moins profond sur chaque sujet K8s. Il couvre les **concepts** sans exiger de pratique CLI.

### Section 1 — Containers and Kubernetes Fundamentals (6 modules)
> Comprendre les conteneurs et les bases de Kubernetes.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 1 | `onboarding` | — |
| 2 | 🆕 `containers-fundamentals` | Kubernetes Fundamentals (46%) |
| 3 | `kubernetes-basics` | Kubernetes Fundamentals |
| 4 | `yaml-and-objects` | Kubernetes Fundamentals |
| 5 | `kubectl-essentials` | Kubernetes Fundamentals |
| 6 | `pods` | Kubernetes Fundamentals |

### Section 2 — Kubernetes Resources (5 modules)
> Les ressources fondamentales de Kubernetes.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 7 | `namespaces` | Kubernetes Fundamentals (46%) |
| 8 | `labels-and-annotations` | Kubernetes Fundamentals |
| 9 | `replicasets` | Kubernetes Fundamentals |
| 10 | `deployments` | Kubernetes Fundamentals |
| 11 | `services` | Container Orchestration (22%) |

### Section 3 — Scheduling and Networking (4 modules)
> Placement des pods et réseau Kubernetes.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 12 | `scheduling-basics` | Container Orchestration (22%) |
| 13 | `dns` | Container Orchestration |
| 14 | `ingress` | Container Orchestration |
| 15 | `network-policies` | Container Orchestration |

### Section 4 — Storage (2 modules)
> Stockage dans Kubernetes.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 16 | `volumes` | Container Orchestration (22%) |
| 17 | `persistent-storage` | Container Orchestration |

### Section 5 — Cloud Native Architecture (2 modules)
> Écosystème CNCF, standards, autoscaling, serverless.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 18 | 🆕 `cloud-native-ecosystem` | Cloud Native Architecture (16%) |
| 19 | `autoscaling` | Cloud Native Architecture |

### Section 6 — Cloud Native Observability and Delivery (3 modules)
> Observabilité, Prometheus, GitOps.

| Ordre | Module | Exam Domain |
|-------|--------|-------------|
| 20 | `logging-and-monitoring` | Cloud Native Observability (8%) |
| 21 | 🆕 `observability-concepts` | Cloud Native Observability |
| 22 | 🆕 `gitops` | Cloud Native Application Delivery (8%) |

### Module optionnel (recommandé)

| Module | Exam Domain |
|--------|-------------|
| 🆕 `service-mesh` | Container Orchestration |

> Le service mesh apparaît dans l'examen KCNA mais avec un poids faible. Ce module est recommandé mais peut être étudié après les 22 modules principaux.

---

## Matrice de partage KCNA ↔ CKAD ↔ CKA

| Module | KCNA | CKAD | CKA | Spécifique à |
|--------|:----:|:----:|:---:|:-------------|
| `onboarding` | ✓ | ✓ | ✓ | — |
| `kubernetes-basics` | ✓ | ✓ | ✓ | — |
| `yaml-and-objects` | ✓ | ✓ | ✓ | — |
| `kubectl-essentials` | ✓ | ✓ | ✓ | — |
| `pods` | ✓ | ✓ | ✓ | — |
| `namespaces` | ✓ | ✓ | ✓ | — |
| `labels-and-annotations` | ✓ | ✓ | ✓ | — |
| `replicasets` | ✓ | ✓ | ✓ | — |
| `deployments` | ✓ | ✓ | ✓ | — |
| `services` | ✓ | ✓ | ✓ | — |
| `dns` | ✓ | ✓ | ✓ | — |
| `ingress` | ✓ | ✓ | ✓ | — |
| `network-policies` | ✓ | ✓ | ✓ | — |
| `volumes` | ✓ | ✓ | ✓ | — |
| `persistent-storage` | ✓ | ✓ | ✓ | — |
| `scheduling-basics` | ✓ | ✓ | ✓ | — |
| `logging-and-monitoring` | ✓ | ✓ | ✓ | — |
| `autoscaling` | ✓ | — | ✓ | KCNA + CKA |
| `containers-fundamentals` | ✓ | — | — | **KCNA** |
| `cloud-native-ecosystem` | ✓ | — | — | **KCNA** |
| `observability-concepts` | ✓ | — | — | **KCNA** |
| `service-mesh` | ✓* | — | — | **KCNA** (optionnel) |
| `gitops` | ✓ | — | — | **KCNA** |
| `commands-and-args` | — | ✓ | ✓ | CKAD + CKA |
| `configmaps` | — | ✓ | ✓ | CKAD + CKA |
| `secrets` | — | ✓ | ✓ | CKAD + CKA |
| `resource-management` | — | ✓ | ✓ | CKAD + CKA |
| `probes` | — | ✓ | ✓ | CKAD + CKA |
| `security-contexts` | — | ✓ | ✓ | CKAD + CKA |
| `multi-container-pods` | — | ✓ | ✓ | CKAD + CKA |
| `service-accounts` | — | ✓ | ✓ | CKAD + CKA |
| `jobs` | — | ✓ | ✓ | CKAD + CKA |
| `statefulsets` | — | ✓ | ✓ | CKAD + CKA |
| `authentication` | — | ✓ | ✓ | CKAD + CKA |
| `kubeconfig` | — | ✓ | ✓ | CKAD + CKA |
| `rbac` | — | ✓ | ✓ | CKAD + CKA |
| `admission-controllers` | — | ✓ | ✓ | CKAD + CKA |
| `api-and-versioning` | — | ✓ | ✓ | CKAD + CKA |
| `custom-resources` | — | ✓ | ✓ | CKAD + CKA |
| `helm` | — | ✓ | ✓ | CKAD + CKA |
| `storage-classes` | — | ✓ | ✓ | CKAD + CKA |
| `deployment-strategies` | — | ✓ | — | **CKAD** |
| `daemonsets` | — | — | ✓ | **CKA** |
| `gateway-api` | — | — | ✓ | **CKA** |
| `tls-certificates` | — | — | ✓ | **CKA** |
| `image-security` | — | — | ✓ | **CKA** |
| `pod-security` | — | — | ✓ | **CKA** |
| `advanced-scheduling` | — | — | ✓ | **CKA** |
| `cluster-architecture-deep` | — | — | ✓ | **CKA** |
| `cluster-installation` | — | — | ✓ | **CKA** |
| `cluster-maintenance` | — | — | ✓ | **CKA** |
| `backup-and-restore` | — | — | ✓ | **CKA** |
| `networking-fundamentals` | — | — | ✓ | **CKA** |
| `kubernetes-networking` | — | — | ✓ | **CKA** |
| `troubleshooting` | — | — | ✓ | **CKA** |

**Résumé** :
- **17 modules** partagés par les 3 certifications (le socle commun)
- **5 modules** spécifiques KCNA (ecosystem, containers, observability, gitops, service-mesh)
- **1 module** spécifique CKAD (`deployment-strategies`)
- **11 modules** spécifiques CKA (cluster admin, TLS, networking deep, troubleshooting)
- **15 modules** partagés CKAD + CKA mais pas KCNA (config avancée, security, etc.)

### Progression entre certifications

| Transition | Modules à étudier | Durée estimée |
|---|---|---|
| KCNA → CKAD | +16 modules (config, security, stateful, jobs...) | +15h |
| KCNA → CKA | +27 modules | +25h |
| CKAD → CKA | +11 modules (cluster admin, networking deep, troubleshooting) | +10h |
| KCNA → CKAD → CKA | KCNA (20h) + CKAD delta (15h) + CKA delta (10h) = **~45h total** |

---

## Parcours futurs (placeholders)

### Parcours Prerequisites

> **Objectif** : Acquérir les bases nécessaires avant de commencer Kubernetes.
> **Cible** : Vrais débutants sans expérience Linux, Docker ou YAML.
> **Statut** : À créer ultérieurement.

Modules envisagés :
- `linux-basics` — Terminal, filesystem, permissions, processes, networking
- `docker-fundamentals` — Images, containers, Dockerfile, registry, volumes
- `yaml-basics` — Syntaxe, types, listes, maps, ancres
- `networking-basics` — TCP/IP, DNS, HTTP, ports, firewalls

### Parcours Beyond Certification

> **Objectif** : Aller au-delà des certifications — sujets avancés et production-ready.
> **Cible** : Étudiants ayant terminé CKAD et/ou CKA.
> **Statut** : À créer ultérieurement.

Modules envisagés :
- `helm-advanced` — Création de charts, templating Go, hooks
- `cost-optimization` — Right-sizing, spot instances, resource tuning
- `multi-cluster` — Federation, multi-cluster services
- `supply-chain-security` — Signing, SBOM, policy engines (OPA/Kyverno)

> Note : `service-mesh`, `gitops` et `observability-concepts` sont désormais dans le parcours KCNA.

---

## Migration depuis la structure actuelle

### Mapping ancien → nouveau

| Ancien module | Ancien chapitre | Nouveau module |
|---------------|----------------|----------------|
| overview | onboarding | `onboarding` |
| overview | concepts-fondamentaux | `kubernetes-basics` |
| overview | objets-kubernetes | `yaml-and-objects` |
| overview | object-management | `kubectl-essentials` (topics 1, 4) |
| overview | namespaces | `namespaces` |
| overview | labels-intro | `labels-and-annotations` (topics 1-2) |
| overview | annotations | `labels-and-annotations` (topic 3) |
| overview | operations | `kubectl-essentials` (topics 2-3, 5-6) |
| workloads | pods-intro | `pods` (topics 1-3) |
| workloads | pod-lifecycle | `pods` (topics 4-6) |
| workloads | replicasets | `replicasets` |
| workloads | deployments-intro | `deployments` (topics 1-2) |
| workloads | deployments-updates | `deployments` (topics 3-5) |
| workloads | statefulsets-intro | `statefulsets` |
| workloads | jobs-intro | `jobs` (topics 1-2) |
| workloads | cronjobs | `jobs` (topic 4) |
| services-networking | services-intro | `services` (topics 1-3) |
| services-networking | services-types | `services` (topics 4-6) |
| services-networking | dns-intro | `dns` |
| services-networking | ingress-intro | `ingress` |
| configuration | configmaps-intro | `configmaps` |
| configuration | secrets-intro | `secrets` |
| configuration | resource-management-intro | `resource-management` |
| configuration | probes-intro | `probes` |
| configuration | kubeconfig | `kubeconfig` |
| security | cloud-native-security | `authentication` (topic 1) |
| security | controlling-api-access | `authentication` (topics 2-3) |
| security | service-accounts-intro | `service-accounts` |
| security | rbac-intro | `rbac` |
| security | pod-security-standards | `pod-security` |
| security | linux-security-intro | `security-contexts` |
| storage | volumes-intro | `volumes` |
| storage | pv-pvc-intro | `persistent-storage` |
| storage | storage-class-intro | `storage-classes` |
| policy | resource-quotas | `resource-management` (topic 5) |
| policy | limit-ranges | `resource-management` (topic 5) |
| administration | logging | `logging-and-monitoring` |
| administration | observability | `logging-and-monitoring` |
| administration | certificates | `tls-certificates` |
| extend-kubernetes | custom-resources | `custom-resources` |
| extend-kubernetes | operators | `custom-resources` (topic 4) |
| extend-kubernetes | kubectl-plugins | — (supprimé ou → Beyond Certification) |

### Stratégie de migration

1. **Créer les nouveaux types TypeScript** (`Module` avec prerequisites, `CourseStructure` avec sections/modules)
2. **Créer les modules un par un** en partant des modules Foundation (pas de dépendances)
3. **Pour chaque module** : migrer le contenu existant + enrichir via IA avec le `spec.md`
4. **Mettre à jour le glob-adapter** pour le nouveau filesystem layout
5. **Recréer les course-structure.ts** pour CKAD et CKA
6. **Valider le DAG** de prérequis (script de validation)

---

## Statistiques

| Métrique | Valeur |
|----------|--------|
| **Modules total** | **54** |
| Topics estimés | ~245 |
| Parcours actifs | 3 (KCNA, CKAD, CKA) |
| Socle commun (3 certifs) | 17 modules |
| Modules KCNA | 22 (dont 5 spécifiques) |
| Modules CKAD | 35 (dont 1 spécifique) |
| Modules CKA | 49 (dont 11 spécifiques) |
| Modules Beyond Cert (futur) | ~4+ |
| Modules Prerequisites (futur) | ~4 |
