# Plans Deep Research (Gemini) — Consolidation pour les parcours

## Pourquoi ce document

Ce document transforme le rapport de veille 2026 en actions concrètes pour améliorer les parcours `KCNA`, `CKAD`, `CKA` sans dupliquer les sujets ni casser la cohérence pédagogique.

Objectif: décider quoi ajouter, où l'ajouter, et comment l'évaluer (terminal + quiz) avec un coût de maintenance faible.

## Positionnement recommandé

- Garder les plans d'examen officiels comme référence principale (pondérations CNCF actuelles).
- Utiliser les signaux 2026 comme **delta pédagogique** (topics, labs, quiz), pas comme remplacement total du cadre existant.
- Éviter la prolifération de modules: privilégier l'ajout de topics dans les modules existants.

## Décisions structurantes

1. **Gateway API**
   - CKA: responsabilité infra (GatewayClass, Gateway controller, exploitation).
   - CKAD: responsabilité applicative (HTTPRoute, traffic split, policies côté app).
   - KCNA: compréhension conceptuelle uniquement.

2. **Sécurité workload moderne**
   - CKAD/CKA: renforcer `service-accounts`, `security-contexts`, `pod-security`.
   - Ajouter explicitement la logique d'identité workload (tokens projetés, rotation, bonnes pratiques).

3. **Troubleshooting orienté production**
   - CKA: approfondir diagnostics control plane, DNS/CNI, etcd restore.
   - CKAD: debug applicatif avec `kubectl logs/describe/debug`.

4. **Autoscaling réaliste**
   - KCNA: concepts HPA/VPA/KEDA.
   - CKA/CKAD: pratique HPA/VPA et limites opérationnelles.

## Deltas recommandés par parcours

## KCNA (conceptuel, non CLI-heavy)

Conserver l'orientation théorique et ajouter des topics de contexte moderne:

- `cloud-native-ecosystem`
  - ajouter topic `platform-engineering-basics` (IDP, self-service, golden paths).
- `autoscaling`
  - ajouter topic `event-driven-scaling-concepts` (KEDA, file/lag based scaling).
- `observability-concepts`
  - ajouter topic `opentelemetry-foundations` (collector, traces, metrics, logs).
- `cloud-native-ecosystem`
  - ajouter topic `finops-greenops-basics` (coût, capacity, right-sizing).

Quiz recommandé:
- 70% `mcq_single|mcq_multi`
- 30% `order_sequence` conceptuel (ordre d'un pipeline GitOps, ordre de diagnostic de base).

## CKAD (design applicatif + exploitation app)

Priorité aux patterns applicatifs modernes:

- `multi-container-pods`
  - ajouter topic `native-sidecar-patterns` (sidecar natif et implications lifecycle).
- `gateway-api`
  - rendre accessible au CKAD (au moins en module optionnel recommandé).
  - topics: `httproute-basics`, `weighted-routing-canary`.
- `probes`
  - ajouter topic `startup-probe-for-slow-apps`.
- `service-accounts`
  - ajouter topic `projected-serviceaccount-token`.
- `troubleshooting` (app-level)
  - ajouter topic `debug-distroless-with-kubectl-debug`.

Quiz recommandé:
- 50% `mcq`
- 30% `order_sequence` (déploiement, rollback, debug flow)
- 20% `command_fill_blank` (compléter la commande kubectl correcte)

## CKA (infra, opérations, dépannage)

Renforcer la couche opérationnelle:

- `cluster-maintenance`
  - ajouter topic `version-skew-and-safe-upgrade-flow`.
- `backup-and-restore`
  - ajouter topic `etcd-restore-drill-end-to-end`.
- `kubernetes-networking`
  - ajouter topic `cni-troubleshooting-method`.
- `gateway-api`
  - ajouter topic `gatewayclass-and-controller-operations`.
- `resource-management` / `autoscaling`
  - ajouter topic `in-place-resize-operational-considerations`.

Quiz recommandé:
- 40% `mcq`
- 40% `order_sequence` (incident response)
- 20% `command_fill_blank` / `command_debug`

## Éviter la duplication des sujets

Règle simple:
- Un sujet appartient à **un module owner**.
- Les autres modules ne recopient pas le fond, ils référencent ce module owner.

Exemples:
- `Gateway API`
  - Owner: `gateway-api`
  - Référencé depuis `ingress`, `services`, `deployment-strategies`.
- `Projected ServiceAccount Token`
  - Owner: `service-accounts`
  - Référencé depuis `authentication`, `rbac`, `security-contexts`.
- `Debug distroless`
  - Owner: `troubleshooting`
  - Référencé depuis `pods`, `probes`, `logging-and-monitoring`.

## Stratégie terminal (intégrée à la plateforme)

Chaque topic pratique doit avoir une progression de commandes:

1. **Observe** (`get`, `describe`, `logs`)
2. **Create/Update** (`apply`, `patch`, `set`, `rollout`)
3. **Verify** (`get -o`, `events`, health checks)
4. **Troubleshoot** (`debug`, `exec`, corriger puis revérifier)

Important:
- Ne pas écrire des commandes en texte libre partout.
- Utiliser un catalogue de commandes réutilisables (`command_id -> template`).
- Les topics référencent des `command_ids`, pas des strings copiées.

## Stratégie quiz multi-format

Types minimaux recommandés:
- `mcq_single`
- `mcq_multi`
- `order_sequence`

Types à ajouter ensuite:
- `command_fill_blank`
- `command_debug`

Règles:
- Chaque topic a au moins 1 quiz.
- Chaque module a au moins 1 quiz pratique (`order_sequence` ou commande) sauf module purement théorique.
- Les quiz de type ordre doivent valider la compréhension du workflow, pas la mémorisation brute.

## Ajustements de structure de parcours

Pour éviter les incohérences de comptage:

- Une seule source canonique (JSON master) pour:
  - liste des modules
  - ordre par parcours
  - coverage par domaine d'examen
- Les pages markdown deviennent des vues générées, pas la source de vérité.

## Priorisation de mise en place

Phase 1 (court terme):
- Corriger la cohérence CKAD/CKA (comptages, sections).
- Introduire quiz `order_sequence` sur 5 modules critiques (`deployments`, `services`, `probes`, `troubleshooting`, `backup-and-restore`).

Phase 2:
- Ajouter topics 2026 à fort impact (Gateway API split CKA/CKAD, workload identity, debug distroless).
- Uniformiser les commandes par catalogue réutilisable.

Phase 3:
- Étendre aux quiz `command_fill_blank` et `command_debug`.
- Ajouter métriques de coverage (domaines examen, pratique terminal, types de quiz).

## Résultat attendu

Avec cette approche:
- les parcours restent lisibles,
- la couverture examen est traçable,
- les nouveautés 2026 sont intégrées sans explosion du nombre de modules,
- et la plateforme terminal devient un levier d'évaluation pratique cohérent.
Rapport Stratégique : Maîtrise de l'Écosystème Kubernetes et Certifications Cloud Native à l'Horizon 2026Résumé ExécutifL'année 2026 marque un point d'inflexion décisif dans la trajectoire des technologies Cloud Native. Kubernetes, ayant atteint sa version v1.35, a transcendé son rôle initial d'orchestrateur de conteneurs pour devenir le système d'exploitation universel du cloud, ou le "plan de contrôle de tout". Cette maturation s'accompagne d'une complexité accrue, rendant la validation des compétences non plus optionnelle, mais impérative pour la stabilité opérationnelle des entreprises.Ce rapport fournit une analyse exhaustive et prospective des trois certifications piliers de la Cloud Native Computing Foundation (CNCF) : Kubernetes and Cloud Native Associate (KCNA), Certified Kubernetes Administrator (CKA), et Certified Kubernetes Application Developer (CKAD). Il dissèque les curricula mis à jour pour 2026, met en lumière l'intégration de paradigmes émergents tels que l'ingénierie de plateforme (Platform Engineering), l'intelligence artificielle (IA) dans l'orchestration, et l'adoption généralisée de la Gateway API et des SidecarContainers natifs.L'objectif de ce document est de servir de plan directeur pour les professionnels cherchant à naviguer dans ce paysage dense, en identifiant les synergies entre les certifications, les nouvelles exigences techniques, et les stratégies de préparation adaptées aux réalités de la production en 2026.1. Le Paysage Cloud Native en 2026 : Contexte et Évolutions Majeures1.1 De l'Orchestration à l'Ingénierie de PlateformeEn 2026, l'industrie a massivement pivoté vers l'Ingénierie de Plateforme (Platform Engineering). Kubernetes n'est plus seulement consommé directement via kubectl par les développeurs, mais sert de fondation à des "Internal Developer Platforms" (IDP). Cette transition influence directement les certifications : le KCNA valide la compréhension de ces couches d'abstraction, tandis que le CKA exige une capacité à maintenir le moteur sous-jacent qui propulse ces plateformes. L'automatisation et l'approche "as-a-product" des infrastructures sont désormais des connaissances implicites requises pour contextualiser les tâches techniques des examens.1.2 L'Impact de l'IA et des Workloads de Haute PerformanceL'intégration de l'Intelligence Artificielle générative et des Large Language Models (LLM) a transformé les exigences envers les clusters Kubernetes. En 2026, la gestion des ressources ne concerne plus seulement des microservices web statless, mais aussi des workloads d'inférence et d'entraînement intensifs. Les certifications reflètent cette réalité par une emphase accrue sur le scheduling avancé, la gestion des ressources GPU (via les extensions de nœuds), et les mécanismes d'autoscaling prédictifs ou événementiels comme KEDA, qui sont devenus des standards de facto aux côtés des HPA/VPA traditionnels.1.3 Maturation des Standards : Gateway API et Sécurité NativeL'année 2026 consacre la Gateway API comme le standard de gestion du trafic, reléguant l'objet Ingress traditionnel au statut de technologie "legacy" mais toujours présente. Ce changement structurel est le plus significatif dans les examens CKA et CKAD, redéfinissant les frontières entre l'administration du cluster (Infrastructure Provider) et la configuration applicative (Route Producer). Parallèlement, la sécurité s'est durcie avec l'introduction de Workload Identity natif et des User Namespaces, rendant les architectures Zero Trust plus accessibles et testables.2. Kubernetes and Cloud Native Associate (KCNA) : La Littératie du Cloud NativeLa certification KCNA, en 2026, dépasse largement le cadre d'un simple glossaire terminologique. Elle s'est imposée comme le prérequis culturel pour toute personne interagissant avec l'écosystème, des managers aux ingénieurs débutants, en validant une compréhension systémique des interactions entre les composants cloud native.2.1 Philosophie et Public CibleLe KCNA cible une audience élargie incluant les ingénieurs DevOps juniors, les architectes de solutions, les chefs de produits techniques et les responsables IT. L'examen vérifie la capacité du candidat à naviguer dans le paysage CNCF, à comprendre les compromis architecturaux (ex: Monolithe vs Microservices, Serverless vs Conteneurs) et à appréhender les principes de la sécurité "Shift-Left".2.2 Analyse Détaillée du Plan de Connaissances (Syllabus 2026)Le plan d'étude du KCNA est structuré autour de cinq domaines stratégiques, pondérés pour refléter l'importance critique des fondamentaux.Domaine 1 : Fondamentaux de Kubernetes (46%)Ce domaine constitue la colonne vertébrale de la certification. Il ne s'agit pas simplement de définir un Pod, mais de comprendre la mécanique interne du cluster.Architecture du Plan de Contrôle (Control Plane) : La compréhension fine des rôles de l'API Server (le cerveau), de l'etcd (la mémoire), du Scheduler (le décisionnaire) et du Controller Manager (le régulateur) est exigée. En 2026, cela inclut la compréhension de la séparation des plans de données et de contrôle dans les environnements gérés (Managed K8s).Architecture des Nœuds (Worker Nodes) : Le candidat doit maîtriser le rôle du Kubelet, du Kube-proxy et, crucialement, l'interaction avec le Container Runtime Interface (CRI). La disparition du Docker shim étant actée depuis longtemps, la distinction entre containerd, CRI-O et les runtimes sécurisés (Kata Containers) est essentielle.Objets API Core : La maîtrise conceptuelle des Pods, ReplicaSets, Deployments, StatefulSets (pour la persistance), DaemonSets (pour l'observabilité) et Jobs/CronJobs est requise. Le candidat doit savoir quel objet répond à quel besoin architectural (ex: "J'ai besoin d'un agent de log sur chaque nœud" => DaemonSet).Domaine 2 : Orchestration de Conteneurs (22%)Ce module explore les standards qui permettent l'interopérabilité.Standards OCI (Open Container Initiative) : La distinction entre la spécification d'image (le format de packaging) et la spécification de runtime (l'exécution) est fondamentale.Interfaces d'Extension (CNI, CSI, CRI) : Le KCNA 2026 insiste sur la modularité de Kubernetes. Le candidat doit comprendre pourquoi et comment le réseau (CNI) et le stockage (CSI) sont découplés du noyau Kubernetes, permettant l'intégration de solutions tierces comme Cilium ou Rook.Sécurité des Conteneurs : Les concepts de balayage de vulnérabilités (scanning), de signature d'images (supply chain security) et de principes de moindre privilège sont testés, reflétant l'importance de la sécurité dès la conception.Domaine 3 : Architecture Cloud Native (16%)C'est dans ce domaine que les mises à jour 2026 sont les plus visibles, intégrant les concepts modernes d'infrastructure.Autoscaling Avancé : Au-delà du HPA (Horizontal Pod Autoscaler), le KCNA couvre désormais le VPA (Vertical Pod Autoscaler) et les concepts de scaling événementiel (KEDA), essentiels pour les architectures serverless sur Kubernetes.Service Mesh et Networking Moderne : La compréhension conceptuelle du maillage de services (mTLS, observabilité, gestion du trafic) est requise. Le candidat doit savoir distinguer les cas d'usage d'un Service Mesh par rapport à une simple Gateway API.Serverless et FaaS : Comprendre comment les fonctions (Function-as-a-Service) s'intègrent dans un cluster Kubernetes (via des projets comme Knative) et le concept de "Scale-to-Zero".Domaine 4 : Observabilité Cloud Native (8%)L'observabilité est passée du statut de "monitoring" à celui de pilier architectural.Les Trois Piliers : La distinction et la corrélation entre Métriques (Prometheus), Logs (Fluentd/Fluent Bit) et Traces Distribuées (Jaeger/OpenTelemetry) sont essentielles.OpenTelemetry (OTel) : En 2026, OTel est le standard absolu. Le KCNA valide la compréhension de son architecture (collecteurs, exportateurs) comme couche d'unification de la télémétrie.Domaine 5 : Livraison d'Applications Cloud Native (8%)GitOps : Ce paradigme est désormais la norme pour le déploiement continu. Comprendre la réconciliation d'état, la source de vérité unique (Git) et la différence entre le modèle "Push" (CI/CD classique) et "Pull" (GitOps avec ArgoCD ou Flux) est impératif.Culture DevOps et SRE : Les principes de base de l'ingénierie de fiabilité des sites (SLO, SLA, SLI) sont abordés pour assurer une compréhension du langage opérationnel.3. Certified Kubernetes Administrator (CKA) : L'Expertise Opérationnelle et InfrastructurelleLe CKA demeure la certification "Reine" pour les professionnels de l'infrastructure. En 2026, l'examen a évolué pour se concentrer intensément sur le cycle de vie du cluster, le dépannage complexe et la maîtrise des nouvelles interfaces de gestion, délaissant les tâches triviales au profit de scénarios de production réalistes.3.1 Philosophie : L'Opérateur de Cluster ModerneLe titulaire du CKA n'est pas seulement un utilisateur de kubectl ; il est le garant de la stabilité, de la sécurité et de l'évolutivité de la plateforme. L'examen, basé sur Kubernetes v1.34/v1.35, est purement pratique (Performance-Based), exigeant une rapidité et une précision chirurgicale dans un environnement Linux.3.2 Plan Détaillé et Compétences Critiques (Syllabus v1.34)Le curriculum 2026 a été rééquilibré pour accorder une pondération massive au dépannage (30%), reflétant la réalité du terrain où l'IA peut générer du YAML, mais seul un humain peut diagnostiquer une panne complexe.Domaine 1 : Dépannage (Troubleshooting) - 30%Ce domaine est le plus discriminant de l'examen. Il exige une compréhension profonde des interactions système.Diagnostic du Cluster et des Nœuds : Le candidat doit être capable de réparer un nœud en état NotReady. Cela implique l'analyse des logs système (journalctl -u kubelet), la vérification des certificats, et la gestion des problèmes de swap ou de configuration container runtime.Panne du Plan de Contrôle : Scénarios où l'API Server ne démarre pas (souvent dû à une erreur dans /etc/kubernetes/manifests), ou où le Scheduler est crashé. L'analyse des logs via crictl ou les logs des pods statiques est requise.Réseau et DNS : Résolution de problèmes où les Pods ne communiquent pas (problème CNI, règles NetworkPolicy trop restrictives) ou où la résolution de noms (CoreDNS) échoue. Savoir utiliser nslookup et analyser les logs de CoreDNS est indispensable.Domaine 2 : Architecture, Installation et Configuration - 25%Gestion du Cycle de Vie avec Kubeadm : L'installation "from scratch" reste une compétence clé, mais l'accent est mis sur la mise à jour (Upgrade) du cluster (ex: v1.34 vers v1.35) sans interruption de service, et la gestion des certificats (kubeadm certs check-expiration et renouvellement).Sauvegarde et Restauration ETCD : La compétence "Make-or-Break". Le candidat doit savoir effectuer un snapshot d'etcd et, surtout, restaurer un cluster à partir de ce snapshot en situation de crise.Gestion des Rôles (RBAC) : Création granulaire de Roles et ClusterRoles. En 2026, cela inclut souvent la restriction d'accès aux nouvelles ressources comme les GatewayClasses ou les VerticalPodAutoscalers.Domaine 3 : Services et Réseaux (Networking) - 20%L'introduction de la Gateway API transforme ce domaine.Gateway API (Infrastructure) : Contrairement à l'Ingress classique, le CKA doit savoir installer et configurer les GatewayClasses et les objets Gateway qui représentent l'infrastructure de load balancing physique ou virtuelle.Ingress "Legacy" : La configuration d'Ingress Controllers (type NGINX) et de ressources Ingress reste au programme, car de nombreux clusters de production les utilisent encore.Network Policies : Implémentation de la sécurité "Zero Trust" intra-cluster. Le candidat doit savoir isoler des namespaces par défaut (Deny-All) et ouvrir des flux spécifiques.Domaine 4 : Workloads et Scheduling - 15%Gestion des Ressources Avancée : Avec l'arrivée de l'In-place Pod Resize en v1.35 stable, le CKA doit savoir modifier les ressources CPU/RAM d'un pod actif sans le redémarrer, une compétence nouvelle et critique pour les workloads stateful.Scheduling : Utilisation experte des NodeSelector, Affinity, Taints & Tolerations pour garantir que les workloads critiques (ou AI) atterrissent sur le matériel approprié.Domaine 5 : Stockage (Storage) - 10%Gestion des Volumes Persistants : Compréhension du cycle de vie PV/PVC, des StorageClasses, et du redimensionnement des volumes. Le dépannage de volumes "Stuck" en état Terminating ou Pending est fréquent.4. Certified Kubernetes Application Developer (CKAD) : L'Architecte de Solutions Cloud NativeLe CKAD certifie la capacité à concevoir, déployer et maintenir des applications distribuées sur Kubernetes. En 2026, il ne s'agit plus seulement de déployer un conteneur web simple, mais d'orchestrer des microservices complexes intégrant des patterns d'observabilité, de sécurité et de routage avancé.4.1 Philosophie : Le Développeur "Ops-Aware"Le développeur certifié CKAD comprend les contraintes de l'infrastructure sans nécessairement savoir la gérer. Il maîtrise les primitives Kubernetes pour rendre son application résiliente, observable et sécurisée "by design". L'examen est également pratique et intensif.4.2 Plan Détaillé et Compétences Critiques (Syllabus v1.34)Domaine 1 : Conception et Construction d'Applications (20%)Patterns Multi-Conteneurs : En 2026, l'usage des SidecarContainers est devenu natif (via initContainers avec restartPolicy: Always). Le CKAD doit savoir implémenter les patterns Ambassadeur (proxy), Adaptateur (normalisation de logs) et Sidecar (helper) en utilisant cette nouvelle syntaxe native, simplifiant grandement la gestion du cycle de vie des pods.Jobs et CronJobs : Gestion des tâches batch, essentielle pour les pipelines de données et les tâches de maintenance automatisées.Domaine 2 : Déploiement d'Applications (20%)Stratégies de Déploiement : Implémentation pratique de stratégies Blue/Green et Canary. Le candidat doit savoir manipuler les sélecteurs de services et les labels pour basculer le trafic manuellement ou via des mécanismes de déploiement progressif.Helm et Kustomize : Contrairement au CKA qui les installe, le CKAD doit maîtriser l'utilisation de Helm pour déployer des charts existants, gérer les valeurs (values.yaml), et utiliser Kustomize pour la gestion des overlays (dev/staging/prod).Domaine 3 : Observabilité et Maintenance (15%)Sondes (Probes) Avancées : Configuration précise des Liveness (redémarrage), Readiness (trafic) et Startup probes. En 2026, la configuration incorrecte d'une Startup Probe pour une application Java ou AI lente au démarrage est une faute éliminatoire.Débogage Applicatif : Utilisation de conteneurs éphémères (kubectl debug) pour diagnostiquer des pods distroless (sans shell) est devenue une compétence standard.Domaine 4 : Environnement, Configuration et Sécurité (25%)Workload Identity et ServiceAccounts : Avec la dépréciation des tokens de ServiceAccount secrets montés automatiquement, le CKAD 2026 doit savoir configurer la Projected Volume Token API pour fournir des identités sécurisées et rotatives aux workloads.Contextes de Sécurité : Configuration des SecurityContext au niveau Pod et Container (runAsUser, fsGroup, capabilities). Savoir interdire l'escalade de privilèges (allowPrivilegeEscalation: false) est systématique.Quotas et Limites : Définition des Requests et Limits pour assurer la QoS (Quality of Service) des applications.Domaine 5 : Services et Réseaux (20%)Gateway API (Routage) : Le développeur gère les HTTPRoute et GRPCRoute. Il doit savoir définir des règles de routage complexes (ex: header-based routing, traffic splitting 90/10 pour le Canary) via l'API Gateway, remplaçant les annotations Ingress complexes.Network Policies Applicatives : Écriture de politiques pour sécuriser les microservices (ex: "Seul le frontend peut parler au backend").5. Analyse Comparative : Chevauchements, Différences et Nouveautés 2026L'écosystème 2026 présente une interconnexion croissante entre les certifications, tout en maintenant des frontières de responsabilité claires. Le tableau suivant synthétise ces relations.5.1 Matrice de Chevauchement et de ResponsabilitéDomaine de ConnaissanceKCNA (Conceptuel)CKA (Infra & Ops)CKAD (Applicatif & Design)Nuance 2026 & ResponsabilitéArchitecture Cluster✅ (Vue d'ensemble)✅ (Expertise profonde)❌Le CKA répare l'API Server ; le CKAD l'utilise.Installation & Upgrade❌✅ (Kubeadm)❌CKA exclusif. Le dev suppose que le cluster existe.Gateway API✅ (Concept)✅ (Infra : GatewayClass)✅ (Routage : HTTPRoute)Chevauchement Critique. CKA fournit la route ("le tuyau"), CKAD définit le trafic ("l'eau").Réseau (NetPol)❌✅ (Sécurité Infra)✅ (Sécurité App)CKA isole les tenants/namespaces. CKAD isole les microservices.Stockage (PV/PVC)✅ (Concept)✅ (Admin : StorageClass)✅ (User : PVC usage)CKA gère le stockage physique/cloud. CKAD réclame du volume.Workload Identity✅ (Concept)✅ (Config API Server)✅ (Config Pod Spec)Nouveau. CKA active la feature, CKAD consomme l'identité.Sidecar Containers❌✅ (Dépannage)✅ (Architecture)CKAD doit concevoir le pattern. CKA doit savoir pourquoi il échoue.Helm / Kustomize❌✅ (Install composants)✅ (Déploiement Apps)Outils communs, usages différents.RBAC✅ (Concept)✅ (Création Rôles)✅ (Usage ServiceAccount)CKA donne les droits. CKAD structure les identités applicatives.Dépannage❌✅ (Système & Nœud)✅ (Application & Pod)La frontière est le système d'exploitation du nœud.5.2 Les Différences Fondamentales en 2026La Frontière de l'OS : La différence la plus nette réside dans l'accès au nœud. Le CKA exige de se connecter en SSH aux nœuds, de manipuler systemd, journalctl, et les fichiers de configuration du Kubelet. Le CKAD reste strictement au niveau de l'API Kubernetes ; si un problème nécessite un accès root au nœud, il sort du périmètre CKAD.L'Approche du Réseau (Gateway API) : En 2026, la distinction est claire. Le CKA est responsable de l'installation des Gateway Controllers (le logiciel qui implémente l'API) et des GatewayClasses. Le CKAD est responsable de l'utilisation de ces passerelles pour exposer des applications via des Routes. C'est un changement majeur par rapport à l'époque Ingress où tout était souvent mélangé dans une seule ressource.Gestion des Ressources et IA : Le CKA se concentre sur la capacité globale du cluster (Node Autoscaling, Taints pour GPU). Le CKAD se concentre sur l'efficacité du workload individuel (Requests/Limits, VPA) pour maximiser l'usage de ces ressources coûteuses.5.3 Nouveautés Critiques par Certification (Horizon 2026)Pour le CKA (v1.35 Spécifique) :In-Place Pod Resize : La capacité à redimensionner les pods sans redémarrage est une compétence d'administration pure pour gérer la stabilité.User Namespaces : Configuration de l'isolation des utilisateurs au niveau du nœud pour la sécurité.Pour le CKAD (v1.35 Spécifique) :Native Sidecars : Utilisation de restartPolicy: Always dans les initContainers. C'est le nouveau standard de design à maîtriser.CEL Admission Policies : Comprendre comment valider les configurations applicatives via le Common Expression Language, remplaçant les anciens validateurs complexes.Pour le KCNA :FinOps & GreenOps : Concepts d'optimisation des coûts et de l'empreinte carbone des clusters, devenus centraux dans la gestion cloud native moderne.6. Stratégie de Préparation et Recommandations (Guide 2026)Réussir ces certifications en 2026 demande une approche méthodique, axée sur la pratique intensive et la compréhension des "nouveaux" fondamentaux.6.1 L'Ordre de Bataille RecommandéL'ordre de passage des certifications doit suivre la logique de construction des compétences :KCNA : Point de départ idéal pour tous. Il permet de valider le vocabulaire et de comprendre "pourquoi" Kubernetes est complexe avant d'apprendre "comment" le gérer. C'est un accélérateur pour les certifications techniques suivantes.CKA ou CKAD?Pour les Profils Ops/Platform : Enchaîner sur le CKA. C'est le fondement de l'ingénierie de plateforme.Pour les Profils Dev/Architecte : Enchaîner sur le CKAD. Il offre un retour sur investissement immédiat pour le travail quotidien.L'Étape Ultime : Le CKS (Certified Kubernetes Security Specialist) est fortement recommandé après le CKA, car la sécurité est transverse en 2026.6.2 Stratégies Techniques pour l'ExamenLa Maîtrise de l'Impératif : Les examens CKA/CKAD durent 2 heures. Il est impossible de réussir en écrivant du YAML à la main. La maîtrise des commandes impératives est non-négociable :Générer un Pod : kubectl run my-pod --image=nginx --restart=Never --dry-run=client -o yaml > pod.yamlGénérer un CronJob : kubectl create cronjob my-job --image=busybox --schedule="*/1 * * * *" --dry-run=client -o yaml > cron.yamlGénérer un Service : kubectl expose pod my-pod --port=80 --name=my-svc --dry-run=client -o yamlLa Navigation Documentaire : L'accès à kubernetes.io/docs est autorisé. Le candidat doit savoir utiliser la barre de recherche pour trouver instantanément les templates YAML complexes (ex: PersistentVolume, NetworkPolicy, Gateway) qui ne peuvent pas être générés en ligne de commande.Entraînement sur Simulateur : L'utilisation de Killer.sh (inclus officiellement avec l'examen) est impérative. Le niveau de difficulté du simulateur est supérieur à l'examen réel, ce qui constitue une excellente préparation au stress et à la gestion du temps.6.3 Focus Mental pour 2026Il faut abandonner les réflexes de 2021.Ne cherchez pas Docker, il n'est plus là. Utilisez crictl pour le débogage bas niveau.Ne comptez pas uniquement sur Ingress ; attendez-vous à voir des objets Gateway API.Pensez "GitOps ready" : même si l'examen est manuel, les bonnes pratiques de nommage et de structure sont attendues.ConclusionEn 2026, les certifications Kubernetes KCNA, CKA et CKAD ne sont plus de simples badges de compétence technique, mais des indicateurs de maturité professionnelle dans un monde dominé par l'ingénierie de plateforme et l'IA.Le KCNA garantit que vous parlez la langue.Le CKA prouve que vous pouvez maintenir le moteur critique de l'entreprise.Le CKAD démontre que vous pouvez construire de la valeur sur ce moteur de manière résiliente et sécurisée.La réussite dans ce parcours exige d'embrasser les changements profonds apportés par les versions v1.34 et v1.35 : la Gateway API n'est plus une option, la sécurité est native, et le dépannage est l'art ultime qui sépare l'amateur de l'expert. Pour le professionnel de l'infrastructure en 2026, ces certifications constituent le socle indispensable pour rester pertinent face à l'automatisation croissante et à la complexité des systèmes distribués modernes.