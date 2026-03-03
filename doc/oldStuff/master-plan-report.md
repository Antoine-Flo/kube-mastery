# Master Plan Report

Schema version : 1.0.0
Generated on : 2026-02-18
Source : new-plans.md + plans-deep-research-gemini.md

## Global Stats

Modules : 55
Topics : 260
Commands : 26
Assessments : 3
Learning paths : 6
Domains : 15

Topic split : theory 65 (25.0%) / practical 195 (75.0%)
Module status : ready=55, draft=0, deprecated=0, archived=0

## Learning Paths Overview

| Path               | Modules | Topics | AvgTopics/Module | Theory | Practical | UnknownRefs |
| ------------------ | ------- | ------ | ---------------- | ------ | --------- | ----------- |
| common-core        | 16      | 74     | 4.63             | 10.8%  | 89.2%     | 0           |
| kcna               | 23      | 112    | 4.87             | 27.7%  | 72.3%     | 0           |
| ckad               | 34      | 155    | 4.56             | 16.1%  | 83.9%     | 0           |
| cka                | 49      | 228    | 4.65             | 18.4%  | 81.6%     | 0           |
| kcna-to-ckad-delta | 18      | 81     | 4.50             | 21.0%  | 79.0%     | 0           |
| ckad-to-cka-delta  | 16      | 77     | 4.81             | 22.1%  | 77.9%     | 0           |

## Domain Coverage Overview

| Certification | Domain                                             | Weight | Modules | UnknownRefs |
| ------------- | -------------------------------------------------- | ------ | ------- | ----------- |
| ckad          | application-design-and-build                       | 20%    | 11      | 0           |
| ckad          | application-deployment                             | 20%    | 4       | 0           |
| ckad          | application-observability-and-maintenance          | 15%    | 2       | 0           |
| ckad          | application-environment-configuration-and-security | 25%    | 11      | 0           |
| ckad          | services-and-networking                            | 20%    | 5       | 0           |
| cka           | cluster-architecture-installation-configuration    | 25%    | 13      | 0           |
| cka           | workloads-and-scheduling                           | 15%    | 16      | 0           |
| cka           | services-and-networking                            | 20%    | 7       | 0           |
| cka           | storage                                            | 10%    | 4       | 0           |
| cka           | troubleshooting                                    | 30%    | 2       | 0           |
| kcna          | kubernetes-fundamentals                            | 46%    | 10      | 0           |
| kcna          | container-orchestration                            | 22%    | 8       | 0           |
| kcna          | cloud-native-architecture                          | 16%    | 2       | 0           |
| kcna          | cloud-native-observability                         | 8%     | 2       | 0           |
| kcna          | cloud-native-application-delivery                  | 8%     | 1       | 0           |

## Certification Domain Weights

| Certification | TotalWeight | Status |
| ------------- | ----------- | ------ |
| kcna          | 100%        | OK     |
| ckad          | 100%        | OK     |
| cka           | 100%        | OK     |

## Top Modules by Topic Count

| Module                 | Topics | Status |
| ---------------------- | ------ | ------ |
| gateway-api            | 8      | ready  |
| cloud-native-ecosystem | 7      | ready  |
| kubectl-essentials     | 6      | ready  |
| pods                   | 6      | ready  |
| autoscaling            | 6      | ready  |
| resource-management    | 6      | ready  |
| probes                 | 6      | ready  |
| services               | 6      | ready  |
| troubleshooting        | 6      | ready  |
| kubernetes-networking  | 6      | ready  |
| observability-concepts | 6      | ready  |
| kubernetes-basics      | 5      | ready  |

## Distribution Signals

Modules <= 2 topics : 0
Modules >= 8 topics : 1

- gateway-api

## Assessment Usage (topic links)

| Type           | LinkedCount |
| -------------- | ----------- |
| mcq_single     | 260         |
| mcq_multi      | 0           |
| order_sequence | 195         |

## Path vs Domain Coverage

| Path | Status | UncoveredDomains |
| ---- | ------ | ---------------- |
| kcna | OK     | -                |
| ckad | OK     | -                |
| cka  | OK     | -                |

## Detailed Learning Paths

### Path: common-core

Description: Tronc commun mutualise KCNA, CKAD et CKA pour maximiser la reutilisation.
Modules: 16

1. onboarding
   - description: Prise en main de la plateforme et contexte des certifications.
   - status: ready
   - prerequisites: none
   - topics: 3
     1. how-to-use-this-platform
        description: Navigation, interface, terminal intégré
     2. your-practice-environment
        description: kubectl, cluster, connexion
     3. certification-overview
        description: CKAD vs CKA, format, conseils
2. kubernetes-basics
   - description: Qu'est-ce que Kubernetes, pourquoi l'utiliser, vue d'ensemble de l'architecture.
   - status: ready
   - prerequisites: none
   - topics: 5
     1. what-is-kubernetes
        description: Orchestration de conteneurs, ce que K8s fait et ne fait pas
     2. evolution-of-deployment
        description: Physique → VMs → Containers → Orchestration
     3. cluster-architecture-overview
        description: Control plane vs worker nodes, vue 10 000 pieds
     4. control-plane-components
        description: apiserver, etcd, scheduler, controller-manager
     5. node-components
        description: kubelet, kube-proxy, container runtime
3. yaml-and-objects
   - description: Comprendre la structure des objets Kubernetes et le format YAML.
   - status: ready
   - prerequisites: kubernetes-basics
   - topics: 4
     1. kubernetes-object-model
        description: Entités persistantes, spec vs status, desired state
     2. anatomy-of-a-manifest
        description: apiVersion, kind, metadata, spec — décortiqué
     3. generating-manifests-from-cli
        description: `kubectl run --dry-run=client -o yaml`
     4. object-names-uids-and-dns-rules
        description: Contraintes de nommage, identifiants uniques
4. kubectl-essentials
   - description: Maîtriser les commandes kubectl fondamentales.
   - status: ready
   - prerequisites: yaml-and-objects
   - topics: 6
     1. imperative-vs-declarative
        description: Commandes impératives, kubectl apply, quand utiliser quoi
     2. viewing-resources
        description: get, describe, explain — lire et comprendre
     3. logs-and-exec
        description: kubectl logs, kubectl exec — debugger un container
     4. creating-and-editing-resources
        description: create, apply, edit, patch, replace
     5. delete-and-cleanup
        description: delete, --grace-period, force delete
     6. formatting-output-and-tips
        description: -o wide/yaml/json, JSONPath, custom-columns, certification tips
5. pods
   - description: Le Pod : unité de base de Kubernetes. Créer, inspecter, comprendre le cycle de vie.
   - status: ready
   - prerequisites: kubectl-essentials
   - topics: 6
     1. what-is-a-pod
        description: Pourquoi le Pod, relation pod/container, networking intra-pod
     2. pod-structure
        description: containers, ports, env — anatomie du manifest
     3. creating-your-first-pod
        description: Impératif et déclaratif, premier déploiement
     4. pod-lifecycle-and-phases
        description: Pending, Running, Succeeded, Failed, Unknown
     5. container-restart-policies
        description: Always, OnFailure, Never — impact sur le comportement
     6. editing-pods
        description: Ce qu'on peut/ne peut pas modifier, recréation
6. namespaces
   - description: Isolation logique des ressources dans un cluster.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. what-are-namespaces
        description: Isolation logique, multi-tenancy léger
     2. default-namespaces
        description: default, kube-system, kube-public, kube-node-lease
     3. working-across-namespaces
        description: -n flag, DNS cross-namespace, context defaults
     4. when-to-use-multiple-namespaces
        description: Stratégies d'organisation, bonnes pratiques
7. labels-and-annotations
   - description: Labels, sélecteurs et annotations : organiser et filtrer les objets.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. what-are-labels
        description: Paires clé/valeur, syntaxe, contraintes
     2. label-selectors
        description: Equality-based, set-based, matchLabels vs matchExpressions
     3. annotations
        description: Métadonnées non identifiantes, cas d'usage
     4. recommended-labels
        description: Standards app.kubernetes.io/\*, bonnes pratiques
8. replicasets
   - description: Maintenir un nombre stable de répliques de Pods.
   - status: ready
   - prerequisites: labels-and-annotations
   - topics: 4
     1. why-replicasets
        description: Le problème : pods éphémères, besoin de réplication
     2. creating-a-replicaset
        description: Manifest, template, label selector
     3. scaling-and-self-healing
        description: Scaling manuel, auto-remplacement des pods crashés
     4. limitations-of-replicasets
        description: Pourquoi on utilise des Deployments à la place
9. deployments
   - description: Déployer, scaler et mettre à jour des applications de manière déclarative.
   - status: ready
   - prerequisites: replicasets
   - topics: 5
     1. what-is-a-deployment
        description: Deployments vs ReplicaSets, quand utiliser quoi
     2. creating-a-deployment
        description: Manifest, scaling basique
     3. rolling-updates
        description: Stratégie par défaut, mise à jour d'image
     4. rollback-and-revision-history
        description: kubectl rollout undo, history, annotations
     5. update-strategies
        description: RollingUpdate vs Recreate, maxSurge, maxUnavailable
10. services

- description: Exposer des Pods avec un point d'accès réseau stable.
- status: ready
- prerequisites: pods, labels-and-annotations
- topics: 6
  1.  why-services
      description: IP éphémères des pods, besoin d'abstraction
  2.  service-and-endpoints
      description: Mécanisme de sélection, endpoints automatiques
  3.  clusterip
      description: Type par défaut, accès interne uniquement
  4.  nodeport
      description: Exposer sur un port de chaque node
  5.  loadbalancer
      description: Intégration cloud, IP externe
  6.  named-ports
      description: Nommage des ports, bonnes pratiques

11. dns

- description: Découverte de services via DNS interne.
- status: ready
- prerequisites: services
- topics: 4
  1.  dns-in-kubernetes
      description: CoreDNS, résolution automatique
  2.  service-dns-records
      description: `svc-name.namespace.svc.cluster.local`
  3.  pod-dns-records
      description: Pods DNS, hostname et subdomain
  4.  dns-debugging
      description: nslookup, dig depuis un pod, dépannage

12. ingress

- description: Router le trafic HTTP/HTTPS externe vers les Services.
- status: ready
- prerequisites: services
- topics: 5
  1.  what-is-ingress
      description: Concept, Ingress vs Service LoadBalancer
  2.  ingress-controllers
      description: NGINX, Traefik — déploiement nécessaire
  3.  routing-rules
      description: Host-based, path-based, default backend
  4.  tls-termination
      description: Certificats, Secrets TLS, HTTPS
  5.  annotations-and-rewrite-target
      description: Configuration spécifique au controller

13. network-policies

- description: Contrôler le trafic réseau entre Pods.
- status: ready
- prerequisites: services
- topics: 5
  1.  what-are-network-policies
      description: Concept, deny-all par défaut
  2.  networkpolicy-structure
      description: podSelector, policyTypes, rules
  3.  ingress-rules
      description: Autoriser le trafic entrant, from selectors
  4.  egress-rules
      description: Autoriser le trafic sortant, to selectors
  5.  advanced-rules
      description: CIDR blocks, ports, protocols, except

14. volumes

- description: Partager et persister des données dans un Pod.
- status: ready
- prerequisites: pods
- topics: 4
  1.  why-volumes
      description: Filesystem éphémère des containers, besoin de persistance
  2.  emptydir
      description: Partage entre containers, scratch space
  3.  hostpath
      description: Monter un chemin du node, risques
  4.  configmap-and-secret-volumes
      description: Monter ConfigMaps et Secrets comme fichiers

15. persistent-storage

- description: Persistent Volumes et Claims : stockage découplé du Pod.
- status: ready
- prerequisites: volumes
- topics: 5
  1.  pv-and-pvc-concepts
      description: Séparation admin/dev, lifecycle
  2.  creating-a-persistentvolume
      description: Manifest, capacity, accessModes
  3.  creating-a-persistentvolumeclaim
      description: Binding, request vs capacity
  4.  using-pvcs-in-pods
      description: volumeMounts, claimName
  5.  access-modes-and-reclaim-policies
      description: RWO, ROX, RWX, Retain, Delete, Recycle

16. logging-and-monitoring

- description: Logs, métriques et événements pour surveiller les applications.
- status: ready
- prerequisites: pods
- topics: 4
  1.  container-logging-basics
      description: kubectl logs, -f, --previous, multi-container
  2.  monitoring-with-metrics-server
      description: kubectl top pods/nodes, installation
  3.  kubernetes-events
      description: kubectl get events, describe, event sources
  4.  monitoring-cluster-component-logs
      description: Logs apiserver, scheduler, kubelet

### Path: kcna

Description: Parcours conceptuel cloud-native et fondamentaux Kubernetes (orientation theorie).
Modules: 23

1. onboarding
   - description: Prise en main de la plateforme et contexte des certifications.
   - status: ready
   - prerequisites: none
   - topics: 3
     1. how-to-use-this-platform
        description: Navigation, interface, terminal intégré
     2. your-practice-environment
        description: kubectl, cluster, connexion
     3. certification-overview
        description: CKAD vs CKA, format, conseils
2. containers-fundamentals
   - description: Comprendre les conteneurs, les runtimes et les standards OCI.
   - status: ready
   - prerequisites: none
   - topics: 5
     1. what-are-containers
        description: Isolation, namespaces Linux, cgroups — concept
     2. containers-vs-vms
        description: Différences architecturales, avantages/inconvénients
     3. container-runtimes
        description: containerd, CRI-O, Docker, CRI — la chaîne
     4. oci-standards
        description: Open Container Initiative, image spec, runtime spec
     5. container-images
        description: Layers, registries, tags, digests
3. kubernetes-basics
   - description: Qu'est-ce que Kubernetes, pourquoi l'utiliser, vue d'ensemble de l'architecture.
   - status: ready
   - prerequisites: none
   - topics: 5
     1. what-is-kubernetes
        description: Orchestration de conteneurs, ce que K8s fait et ne fait pas
     2. evolution-of-deployment
        description: Physique → VMs → Containers → Orchestration
     3. cluster-architecture-overview
        description: Control plane vs worker nodes, vue 10 000 pieds
     4. control-plane-components
        description: apiserver, etcd, scheduler, controller-manager
     5. node-components
        description: kubelet, kube-proxy, container runtime
4. yaml-and-objects
   - description: Comprendre la structure des objets Kubernetes et le format YAML.
   - status: ready
   - prerequisites: kubernetes-basics
   - topics: 4
     1. kubernetes-object-model
        description: Entités persistantes, spec vs status, desired state
     2. anatomy-of-a-manifest
        description: apiVersion, kind, metadata, spec — décortiqué
     3. generating-manifests-from-cli
        description: `kubectl run --dry-run=client -o yaml`
     4. object-names-uids-and-dns-rules
        description: Contraintes de nommage, identifiants uniques
5. kubectl-essentials
   - description: Maîtriser les commandes kubectl fondamentales.
   - status: ready
   - prerequisites: yaml-and-objects
   - topics: 6
     1. imperative-vs-declarative
        description: Commandes impératives, kubectl apply, quand utiliser quoi
     2. viewing-resources
        description: get, describe, explain — lire et comprendre
     3. logs-and-exec
        description: kubectl logs, kubectl exec — debugger un container
     4. creating-and-editing-resources
        description: create, apply, edit, patch, replace
     5. delete-and-cleanup
        description: delete, --grace-period, force delete
     6. formatting-output-and-tips
        description: -o wide/yaml/json, JSONPath, custom-columns, certification tips
6. pods
   - description: Le Pod : unité de base de Kubernetes. Créer, inspecter, comprendre le cycle de vie.
   - status: ready
   - prerequisites: kubectl-essentials
   - topics: 6
     1. what-is-a-pod
        description: Pourquoi le Pod, relation pod/container, networking intra-pod
     2. pod-structure
        description: containers, ports, env — anatomie du manifest
     3. creating-your-first-pod
        description: Impératif et déclaratif, premier déploiement
     4. pod-lifecycle-and-phases
        description: Pending, Running, Succeeded, Failed, Unknown
     5. container-restart-policies
        description: Always, OnFailure, Never — impact sur le comportement
     6. editing-pods
        description: Ce qu'on peut/ne peut pas modifier, recréation
7. namespaces
   - description: Isolation logique des ressources dans un cluster.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. what-are-namespaces
        description: Isolation logique, multi-tenancy léger
     2. default-namespaces
        description: default, kube-system, kube-public, kube-node-lease
     3. working-across-namespaces
        description: -n flag, DNS cross-namespace, context defaults
     4. when-to-use-multiple-namespaces
        description: Stratégies d'organisation, bonnes pratiques
8. labels-and-annotations
   - description: Labels, sélecteurs et annotations : organiser et filtrer les objets.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. what-are-labels
        description: Paires clé/valeur, syntaxe, contraintes
     2. label-selectors
        description: Equality-based, set-based, matchLabels vs matchExpressions
     3. annotations
        description: Métadonnées non identifiantes, cas d'usage
     4. recommended-labels
        description: Standards app.kubernetes.io/\*, bonnes pratiques
9. replicasets
   - description: Maintenir un nombre stable de répliques de Pods.
   - status: ready
   - prerequisites: labels-and-annotations
   - topics: 4
     1. why-replicasets
        description: Le problème : pods éphémères, besoin de réplication
     2. creating-a-replicaset
        description: Manifest, template, label selector
     3. scaling-and-self-healing
        description: Scaling manuel, auto-remplacement des pods crashés
     4. limitations-of-replicasets
        description: Pourquoi on utilise des Deployments à la place
10. deployments

- description: Déployer, scaler et mettre à jour des applications de manière déclarative.
- status: ready
- prerequisites: replicasets
- topics: 5
  1.  what-is-a-deployment
      description: Deployments vs ReplicaSets, quand utiliser quoi
  2.  creating-a-deployment
      description: Manifest, scaling basique
  3.  rolling-updates
      description: Stratégie par défaut, mise à jour d'image
  4.  rollback-and-revision-history
      description: kubectl rollout undo, history, annotations
  5.  update-strategies
      description: RollingUpdate vs Recreate, maxSurge, maxUnavailable

11. services

- description: Exposer des Pods avec un point d'accès réseau stable.
- status: ready
- prerequisites: pods, labels-and-annotations
- topics: 6
  1.  why-services
      description: IP éphémères des pods, besoin d'abstraction
  2.  service-and-endpoints
      description: Mécanisme de sélection, endpoints automatiques
  3.  clusterip
      description: Type par défaut, accès interne uniquement
  4.  nodeport
      description: Exposer sur un port de chaque node
  5.  loadbalancer
      description: Intégration cloud, IP externe
  6.  named-ports
      description: Nommage des ports, bonnes pratiques

12. scheduling-basics

- description: Contrôler où les Pods s'exécutent : taints, tolerations, affinity.
- status: ready
- prerequisites: pods, labels-and-annotations
- topics: 4
  1.  taints-and-tolerations
      description: Repousser les pods, NoSchedule, NoExecute, PreferNoSchedule
  2.  node-selectors
      description: Placer un pod sur un node spécifique (simple)
  3.  node-affinity
      description: requiredDuringScheduling, preferredDuringScheduling
  4.  taints-vs-node-affinity
      description: Quand utiliser quoi, combiner les deux

13. dns

- description: Découverte de services via DNS interne.
- status: ready
- prerequisites: services
- topics: 4
  1.  dns-in-kubernetes
      description: CoreDNS, résolution automatique
  2.  service-dns-records
      description: `svc-name.namespace.svc.cluster.local`
  3.  pod-dns-records
      description: Pods DNS, hostname et subdomain
  4.  dns-debugging
      description: nslookup, dig depuis un pod, dépannage

14. ingress

- description: Router le trafic HTTP/HTTPS externe vers les Services.
- status: ready
- prerequisites: services
- topics: 5
  1.  what-is-ingress
      description: Concept, Ingress vs Service LoadBalancer
  2.  ingress-controllers
      description: NGINX, Traefik — déploiement nécessaire
  3.  routing-rules
      description: Host-based, path-based, default backend
  4.  tls-termination
      description: Certificats, Secrets TLS, HTTPS
  5.  annotations-and-rewrite-target
      description: Configuration spécifique au controller

15. network-policies

- description: Contrôler le trafic réseau entre Pods.
- status: ready
- prerequisites: services
- topics: 5
  1.  what-are-network-policies
      description: Concept, deny-all par défaut
  2.  networkpolicy-structure
      description: podSelector, policyTypes, rules
  3.  ingress-rules
      description: Autoriser le trafic entrant, from selectors
  4.  egress-rules
      description: Autoriser le trafic sortant, to selectors
  5.  advanced-rules
      description: CIDR blocks, ports, protocols, except

16. volumes

- description: Partager et persister des données dans un Pod.
- status: ready
- prerequisites: pods
- topics: 4
  1.  why-volumes
      description: Filesystem éphémère des containers, besoin de persistance
  2.  emptydir
      description: Partage entre containers, scratch space
  3.  hostpath
      description: Monter un chemin du node, risques
  4.  configmap-and-secret-volumes
      description: Monter ConfigMaps et Secrets comme fichiers

17. persistent-storage

- description: Persistent Volumes et Claims : stockage découplé du Pod.
- status: ready
- prerequisites: volumes
- topics: 5
  1.  pv-and-pvc-concepts
      description: Séparation admin/dev, lifecycle
  2.  creating-a-persistentvolume
      description: Manifest, capacity, accessModes
  3.  creating-a-persistentvolumeclaim
      description: Binding, request vs capacity
  4.  using-pvcs-in-pods
      description: volumeMounts, claimName
  5.  access-modes-and-reclaim-policies
      description: RWO, ROX, RWX, Retain, Delete, Recycle

18. cloud-native-ecosystem

- description: L'écosystème cloud-native : CNCF, standards ouverts, gouvernance Kubernetes.
- status: ready
- prerequisites: kubernetes-basics
- topics: 7
  1.  what-is-cloud-native
      description: Définition CNCF, principes, 12-factor apps
  2.  the-cncf-landscape
      description: Projets graduated/incubating/sandbox, catégories
  3.  open-standards
      description: OCI, CNI, CRI, CSI, SMI — pourquoi les standards comptent
  4.  keps-and-sigs
      description: Comment Kubernetes évolue, processus de contribution
  5.  serverless-on-kubernetes
      description: Knative, concepts FaaS, quand l'utiliser
  6.  platform-engineering-basics
      description: Extension 2026: platform engineering basics.
  7.  finops-greenops-basics
      description: Extension 2026: finops greenops basics.

19. autoscaling

- description: Scaling automatique : HPA, VPA, resize in-place.
- status: ready
- prerequisites: deployments, resource-management
- topics: 6
  1.  introduction-to-autoscaling
      description: Pourquoi scaler automatiquement, approches
  2.  horizontal-pod-autoscaler
      description: HPA basé CPU/mémoire, configuration
  3.  hpa-stabilization-and-behavior
      description: Stabilization window, scaling policies
  4.  vertical-pod-autoscaler
      description: VPA concepts, modes (Off, Initial, Auto)
  5.  in-place-resize-of-pods
      description: Resize sans restart (K8s 1.27+)
  6.  event-driven-scaling-concepts
      description: Extension 2026: event driven scaling concepts.

20. logging-and-monitoring

- description: Logs, métriques et événements pour surveiller les applications.
- status: ready
- prerequisites: pods
- topics: 4
  1.  container-logging-basics
      description: kubectl logs, -f, --previous, multi-container
  2.  monitoring-with-metrics-server
      description: kubectl top pods/nodes, installation
  3.  kubernetes-events
      description: kubectl get events, describe, event sources
  4.  monitoring-cluster-component-logs
      description: Logs apiserver, scheduler, kubelet

21. observability-concepts

- description: Concepts d'observabilité : métriques, SLO/SLA/SLI, introduction à Prometheus.
- status: ready
- prerequisites: logging-and-monitoring
- topics: 6
  1.  observability-fundamentals
      description: Logs, métriques, traces — les 3 piliers
  2.  slo-sla-sli
      description: Définitions, exemples concrets, error budgets
  3.  prometheus-basics
      description: Architecture, pull model, PromQL intro
  4.  prometheus-on-kubernetes
      description: Node exporter, kube-state-metrics, monitoring des pods
  5.  cost-management
      description: Coûts cloud, right-sizing, outils d'optimisation
  6.  opentelemetry-foundations
      description: Extension 2026: opentelemetry foundations.

22. gitops

- description: GitOps : principes, CI/CD cloud-native, ArgoCD.
- status: ready
- prerequisites: deployments, helm
- topics: 5
  1.  application-delivery-fundamentals
      description: Build, ship, run — pipeline overview
  2.  what-is-gitops
      description: Git comme source de vérité, principes fondamentaux
  3.  push-vs-pull-based-deployments
      description: Modèles de déploiement, avantages du pull
  4.  argocd-introduction
      description: Architecture, Application CRD, sync
  5.  ci-cd-with-gitops
      description: Pipeline complète, intégration CI + CD GitOps

23. service-mesh

- description: Service mesh : proxy sidecar, Envoy, Istio.
- status: ready
- prerequisites: services, multi-container-pods
- topics: 5
  1.  monoliths-vs-microservices
      description: Évolution architecturale, challenges des microservices
  2.  what-is-a-service-mesh
      description: Concept, data plane vs control plane
  3.  envoy-proxy
      description: Sidecar proxy, fonctionnalités, rôle dans le mesh
  4.  istio-introduction
      description: Architecture, installation, traffic management
  5.  when-to-use-a-service-mesh
      description: Trade-offs, complexité vs bénéfices

### Path: ckad

Description: Parcours developpeur Kubernetes axe design, deploiement et exploitation applicative.
Modules: 34

1. onboarding
   - description: Prise en main de la plateforme et contexte des certifications.
   - status: ready
   - prerequisites: none
   - topics: 3
     1. how-to-use-this-platform
        description: Navigation, interface, terminal intégré
     2. your-practice-environment
        description: kubectl, cluster, connexion
     3. certification-overview
        description: CKAD vs CKA, format, conseils
2. kubernetes-basics
   - description: Qu'est-ce que Kubernetes, pourquoi l'utiliser, vue d'ensemble de l'architecture.
   - status: ready
   - prerequisites: none
   - topics: 5
     1. what-is-kubernetes
        description: Orchestration de conteneurs, ce que K8s fait et ne fait pas
     2. evolution-of-deployment
        description: Physique → VMs → Containers → Orchestration
     3. cluster-architecture-overview
        description: Control plane vs worker nodes, vue 10 000 pieds
     4. control-plane-components
        description: apiserver, etcd, scheduler, controller-manager
     5. node-components
        description: kubelet, kube-proxy, container runtime
3. yaml-and-objects
   - description: Comprendre la structure des objets Kubernetes et le format YAML.
   - status: ready
   - prerequisites: kubernetes-basics
   - topics: 4
     1. kubernetes-object-model
        description: Entités persistantes, spec vs status, desired state
     2. anatomy-of-a-manifest
        description: apiVersion, kind, metadata, spec — décortiqué
     3. generating-manifests-from-cli
        description: `kubectl run --dry-run=client -o yaml`
     4. object-names-uids-and-dns-rules
        description: Contraintes de nommage, identifiants uniques
4. kubectl-essentials
   - description: Maîtriser les commandes kubectl fondamentales.
   - status: ready
   - prerequisites: yaml-and-objects
   - topics: 6
     1. imperative-vs-declarative
        description: Commandes impératives, kubectl apply, quand utiliser quoi
     2. viewing-resources
        description: get, describe, explain — lire et comprendre
     3. logs-and-exec
        description: kubectl logs, kubectl exec — debugger un container
     4. creating-and-editing-resources
        description: create, apply, edit, patch, replace
     5. delete-and-cleanup
        description: delete, --grace-period, force delete
     6. formatting-output-and-tips
        description: -o wide/yaml/json, JSONPath, custom-columns, certification tips
5. pods
   - description: Le Pod : unité de base de Kubernetes. Créer, inspecter, comprendre le cycle de vie.
   - status: ready
   - prerequisites: kubectl-essentials
   - topics: 6
     1. what-is-a-pod
        description: Pourquoi le Pod, relation pod/container, networking intra-pod
     2. pod-structure
        description: containers, ports, env — anatomie du manifest
     3. creating-your-first-pod
        description: Impératif et déclaratif, premier déploiement
     4. pod-lifecycle-and-phases
        description: Pending, Running, Succeeded, Failed, Unknown
     5. container-restart-policies
        description: Always, OnFailure, Never — impact sur le comportement
     6. editing-pods
        description: Ce qu'on peut/ne peut pas modifier, recréation
6. namespaces
   - description: Isolation logique des ressources dans un cluster.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. what-are-namespaces
        description: Isolation logique, multi-tenancy léger
     2. default-namespaces
        description: default, kube-system, kube-public, kube-node-lease
     3. working-across-namespaces
        description: -n flag, DNS cross-namespace, context defaults
     4. when-to-use-multiple-namespaces
        description: Stratégies d'organisation, bonnes pratiques
7. labels-and-annotations
   - description: Labels, sélecteurs et annotations : organiser et filtrer les objets.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. what-are-labels
        description: Paires clé/valeur, syntaxe, contraintes
     2. label-selectors
        description: Equality-based, set-based, matchLabels vs matchExpressions
     3. annotations
        description: Métadonnées non identifiantes, cas d'usage
     4. recommended-labels
        description: Standards app.kubernetes.io/\*, bonnes pratiques
8. commands-and-args
   - description: Contrôler le point d'entrée et les arguments d'un container.
   - status: ready
   - prerequisites: pods
   - topics: 3
     1. docker-cmd-vs-entrypoint
        description: Rappel Docker, override behavior
     2. command-and-args-in-kubernetes
        description: Mapping Docker → K8s, syntaxe YAML
     3. practical-override-scenarios
        description: Exemples concrets, debugging tips
9. multi-container-pods
   - description: Patterns multi-containers : sidecar, init containers, ambassador.
   - status: ready
   - prerequisites: pods
   - topics: 5
     1. why-multiple-containers
        description: Shared network/storage, cas d'usage
     2. sidecar-pattern
        description: Logging, proxy, sync — exemples concrets
     3. ambassador-and-adapter-patterns
        description: Proxy sortant, normalisation de données
     4. init-containers
        description: Séquençage, cas d'usage, différences avec app containers
     5. native-sidecar-patterns
        description: Extension 2026: native sidecar patterns.
10. jobs

- description: Tâches one-shot et planifiées : Jobs et CronJobs.
- status: ready
- prerequisites: pods
- topics: 4
  1.  what-is-a-job
      description: Tâche à exécution unique, complétion
  2.  job-parallelism-and-completions
      description: Parallélisme, multiple completions
  3.  backoff-and-retry
      description: backoffLimit, activeDeadlineSeconds, TTL
  4.  cronjobs
      description: Syntaxe cron, concurrencyPolicy, suspend

11. configmaps

- description: Externaliser la configuration applicative.
- status: ready
- prerequisites: pods
- topics: 5
  1.  what-is-a-configmap
      description: Concept, séparation config/code
  2.  creating-configmaps
      description: --from-literal, --from-file, --from-env-file, YAML
  3.  using-via-environment-variables
      description: envFrom, valueFrom, variables individuelles
  4.  using-via-volume-mounts
      description: Montage complet, fichiers spécifiques, subPath
  5.  immutable-configmaps
      description: Pourquoi, comment, impact

12. secrets

- description: Gérer les données sensibles (mots de passe, tokens, clés).
- status: ready
- prerequisites: configmaps
- topics: 5
  1.  what-is-a-secret
      description: Différence avec ConfigMap, encoding base64
  2.  types-of-secrets
      description: Opaque, docker-registry, tls, basic-auth
  3.  creating-and-using-secrets
      description: CLI, YAML, env vars, volume mounts
  4.  encrypting-secrets-at-rest
      description: EncryptionConfiguration, etcd encryption
  5.  security-best-practices
      description: Limitations, RBAC, external secret managers

13. resource-management

- description: Contrôler CPU et mémoire : requests, limits, QoS.
- status: ready
- prerequisites: pods
- topics: 6
  1.  resource-requests-and-limits
      description: CPU (millicores), mémoire (Mi/Gi), syntaxe
  2.  how-scheduling-uses-requests
      description: Le scheduler et les requests, overcommit
  3.  what-happens-when-limits-are-exceeded
      description: OOMKilled, CPU throttling
  4.  qos-classes
      description: Guaranteed, Burstable, BestEffort — impact éviction
  5.  limitranges-and-resourcequotas
      description: Defaults namespace, limites globales
  6.  in-place-resize-operational-considerations
      description: Extension 2026: in place resize operational considerations.

14. probes

- description: Health checks : liveness, readiness, startup probes.
- status: ready
- prerequisites: pods
- topics: 6
  1.  why-probes-matter
      description: Détection de pannes, traffic routing
  2.  liveness-probes
      description: Quand le container est mort, restart automatique
  3.  readiness-probes
      description: Quand le container n'est pas prêt, retrait du Service
  4.  startup-probes
      description: Applications lentes à démarrer, protection
  5.  probe-types-and-configuration
      description: httpGet, tcpSocket, exec, timing parameters
  6.  startup-probe-for-slow-apps
      description: Extension 2026: startup probe for slow apps.

15. security-contexts

- description: Contrôler les privilèges de sécurité des containers.
- status: ready
- prerequisites: pods
- topics: 4
  1.  security-in-docker-recap
      description: Namespaces Linux, capabilities, root vs non-root
  2.  pod-vs-container-security-context
      description: Niveaux d'application, héritage
  3.  runasuser-runasgroup-runasnonroot
      description: Contrôler l'identité du process
  4.  capabilities-and-readonlyrootfilesystem
      description: Ajouter/retirer des capabilities, filesystem en lecture seule

16. replicasets

- description: Maintenir un nombre stable de répliques de Pods.
- status: ready
- prerequisites: labels-and-annotations
- topics: 4
  1.  why-replicasets
      description: Le problème : pods éphémères, besoin de réplication
  2.  creating-a-replicaset
      description: Manifest, template, label selector
  3.  scaling-and-self-healing
      description: Scaling manuel, auto-remplacement des pods crashés
  4.  limitations-of-replicasets
      description: Pourquoi on utilise des Deployments à la place

17. deployments

- description: Déployer, scaler et mettre à jour des applications de manière déclarative.
- status: ready
- prerequisites: replicasets
- topics: 5
  1.  what-is-a-deployment
      description: Deployments vs ReplicaSets, quand utiliser quoi
  2.  creating-a-deployment
      description: Manifest, scaling basique
  3.  rolling-updates
      description: Stratégie par défaut, mise à jour d'image
  4.  rollback-and-revision-history
      description: kubectl rollout undo, history, annotations
  5.  update-strategies
      description: RollingUpdate vs Recreate, maxSurge, maxUnavailable

18. deployment-strategies

- description: Stratégies de déploiement avancées : blue-green, canary.
- status: ready
- prerequisites: deployments
- topics: 4
  1.  blue-green-deployments
      description: Concept, implémentation avec labels/services
  2.  canary-deployments
      description: Concept, implémentation avec poids/répliques
  3.  pause-and-resume-rollouts
      description: kubectl rollout pause/resume, cas d'usage
  4.  choosing-a-deployment-strategy
      description: Arbre de décision, trade-offs

19. services

- description: Exposer des Pods avec un point d'accès réseau stable.
- status: ready
- prerequisites: pods, labels-and-annotations
- topics: 6
  1.  why-services
      description: IP éphémères des pods, besoin d'abstraction
  2.  service-and-endpoints
      description: Mécanisme de sélection, endpoints automatiques
  3.  clusterip
      description: Type par défaut, accès interne uniquement
  4.  nodeport
      description: Exposer sur un port de chaque node
  5.  loadbalancer
      description: Intégration cloud, IP externe
  6.  named-ports
      description: Nommage des ports, bonnes pratiques

20. dns

- description: Découverte de services via DNS interne.
- status: ready
- prerequisites: services
- topics: 4
  1.  dns-in-kubernetes
      description: CoreDNS, résolution automatique
  2.  service-dns-records
      description: `svc-name.namespace.svc.cluster.local`
  3.  pod-dns-records
      description: Pods DNS, hostname et subdomain
  4.  dns-debugging
      description: nslookup, dig depuis un pod, dépannage

21. ingress

- description: Router le trafic HTTP/HTTPS externe vers les Services.
- status: ready
- prerequisites: services
- topics: 5
  1.  what-is-ingress
      description: Concept, Ingress vs Service LoadBalancer
  2.  ingress-controllers
      description: NGINX, Traefik — déploiement nécessaire
  3.  routing-rules
      description: Host-based, path-based, default backend
  4.  tls-termination
      description: Certificats, Secrets TLS, HTTPS
  5.  annotations-and-rewrite-target
      description: Configuration spécifique au controller

22. network-policies

- description: Contrôler le trafic réseau entre Pods.
- status: ready
- prerequisites: services
- topics: 5
  1.  what-are-network-policies
      description: Concept, deny-all par défaut
  2.  networkpolicy-structure
      description: podSelector, policyTypes, rules
  3.  ingress-rules
      description: Autoriser le trafic entrant, from selectors
  4.  egress-rules
      description: Autoriser le trafic sortant, to selectors
  5.  advanced-rules
      description: CIDR blocks, ports, protocols, except

23. volumes

- description: Partager et persister des données dans un Pod.
- status: ready
- prerequisites: pods
- topics: 4
  1.  why-volumes
      description: Filesystem éphémère des containers, besoin de persistance
  2.  emptydir
      description: Partage entre containers, scratch space
  3.  hostpath
      description: Monter un chemin du node, risques
  4.  configmap-and-secret-volumes
      description: Monter ConfigMaps et Secrets comme fichiers

24. persistent-storage

- description: Persistent Volumes et Claims : stockage découplé du Pod.
- status: ready
- prerequisites: volumes
- topics: 5
  1.  pv-and-pvc-concepts
      description: Séparation admin/dev, lifecycle
  2.  creating-a-persistentvolume
      description: Manifest, capacity, accessModes
  3.  creating-a-persistentvolumeclaim
      description: Binding, request vs capacity
  4.  using-pvcs-in-pods
      description: volumeMounts, claimName
  5.  access-modes-and-reclaim-policies
      description: RWO, ROX, RWX, Retain, Delete, Recycle

25. statefulsets

- description: Applications stateful : identité stable, stockage persistant par pod.
- status: ready
- prerequisites: deployments, persistent-storage, services
- topics: 5
  1.  stateful-vs-stateless
      description: Pourquoi les Deployments ne suffisent pas
  2.  statefulset-fundamentals
      description: Identité stable, nommage ordonné
  3.  headless-services
      description: Pourquoi et comment, DNS par pod
  4.  storage-in-statefulsets
      description: volumeClaimTemplates, PVC par pod
  5.  ordering-and-updates
      description: Ordered/parallel pod management, rolling updates

26. service-accounts

- description: Identité des Pods pour accéder à l'API Kubernetes.
- status: ready
- prerequisites: pods, namespaces
- topics: 5
  1.  what-is-a-serviceaccount
      description: Identité pod, default SA, différence avec users
  2.  creating-and-assigning-sas
      description: Créer un SA, l'assigner à un pod
  3.  token-projection-and-automount
      description: Projected tokens, automountServiceAccountToken
  4.  practical-scenarios
      description: Accès API depuis un pod, debugging
  5.  projected-serviceaccount-token
      description: Extension 2026: projected serviceaccount token.

27. authentication

- description: Comment Kubernetes identifie les utilisateurs et les pods.
- status: ready
- prerequisites: kubernetes-basics
- topics: 3
  1.  security-primitives
      description: Qui peut accéder ? Que peut-il faire ?
  2.  authentication-methods
      description: Certificates, tokens, OIDC — vue d'ensemble
  3.  users-vs-serviceaccounts
      description: Humains vs machines, pas d'objet User dans K8s

28. kubeconfig

- description: Configurer l'accès au cluster : contextes, utilisateurs, clusters.
- status: ready
- prerequisites: authentication
- topics: 4
  1.  kubeconfig-basics
      description: Pourquoi kubeconfig, localisation par défaut
  2.  structure-clusters-users-contexts
      description: Les 3 sections, comment elles s'articulent
  3.  switching-contexts
      description: kubectl config use-context, current-context
  4.  creating-kubeconfig-from-scratch
      description: Construire un fichier complet manuellement

29. rbac

- description: Contrôler les permissions : Roles, RoleBindings, ClusterRoles.
- status: ready
- prerequisites: service-accounts, kubeconfig
- topics: 5
  1.  authorization-methods-overview
      description: RBAC, ABAC, webhooks — pourquoi RBAC
  2.  roles-and-rolebindings
      description: Permissions namespace-scoped, création
  3.  clusterroles-and-clusterrolebindings
      description: Permissions cluster-wide
  4.  testing-permissions
      description: kubectl auth can-i, impersonation
  5.  rbac-best-practices
      description: Least privilege, audit, agrégation

30. admission-controllers

- description: Intercepter et modifier les requêtes API avant persistence.
- status: ready
- prerequisites: rbac
- topics: 4
  1.  what-are-admission-controllers
      description: Chaîne de traitement API, built-in controllers
  2.  enabling-and-disabling
      description: kube-apiserver flags, controllers courants
  3.  validating-webhooks
      description: Rejeter les requêtes non conformes
  4.  mutating-webhooks
      description: Modifier les requêtes à la volée, injection de sidecar

31. logging-and-monitoring

- description: Logs, métriques et événements pour surveiller les applications.
- status: ready
- prerequisites: pods
- topics: 4
  1.  container-logging-basics
      description: kubectl logs, -f, --previous, multi-container
  2.  monitoring-with-metrics-server
      description: kubectl top pods/nodes, installation
  3.  kubernetes-events
      description: kubectl get events, describe, event sources
  4.  monitoring-cluster-component-logs
      description: Logs apiserver, scheduler, kubelet

32. api-and-versioning

- description: Groupes d'API, versions et politique de dépréciation.
- status: ready
- prerequisites: kubectl-essentials
- topics: 4
  1.  api-groups
      description: /api (core), /apis (named groups)
  2.  api-versions
      description: alpha, beta, stable — signification
  3.  api-deprecation-policy
      description: Durée de support, migration
  4.  field-selectors
      description: Filtrer par champs (status.phase, metadata.name)

33. custom-resources

- description: Étendre Kubernetes avec des CRDs et des controllers custom.
- status: ready
- prerequisites: api-and-versioning
- topics: 4
  1.  what-are-custom-resources
      description: Étendre l'API, CRDs
  2.  creating-a-crd
      description: Manifest, validation, schema
  3.  custom-controllers
      description: Reconciliation, watch, react
  4.  operator-pattern
      description: Operators, frameworks (Operator SDK, kubebuilder)

34. helm

- description: Gestionnaire de packages Kubernetes.
- status: ready
- prerequisites: kubectl-essentials
- topics: 5
  1.  what-is-helm
      description: Charts, releases, repositories — concepts
  2.  installing-helm
      description: Installation, configuration
  3.  working-with-charts
      description: helm install, upgrade, rollback, uninstall
  4.  values-and-configuration
      description: values.yaml, --set, override hierarchy
  5.  finding-and-using-charts
      description: helm search, artifact hub, helm repo

### Path: cka

Description: Parcours administrateur Kubernetes axe operations cluster, reseau, stockage et troubleshooting.
Modules: 49

1. onboarding
   - description: Prise en main de la plateforme et contexte des certifications.
   - status: ready
   - prerequisites: none
   - topics: 3
     1. how-to-use-this-platform
        description: Navigation, interface, terminal intégré
     2. your-practice-environment
        description: kubectl, cluster, connexion
     3. certification-overview
        description: CKAD vs CKA, format, conseils
2. kubernetes-basics
   - description: Qu'est-ce que Kubernetes, pourquoi l'utiliser, vue d'ensemble de l'architecture.
   - status: ready
   - prerequisites: none
   - topics: 5
     1. what-is-kubernetes
        description: Orchestration de conteneurs, ce que K8s fait et ne fait pas
     2. evolution-of-deployment
        description: Physique → VMs → Containers → Orchestration
     3. cluster-architecture-overview
        description: Control plane vs worker nodes, vue 10 000 pieds
     4. control-plane-components
        description: apiserver, etcd, scheduler, controller-manager
     5. node-components
        description: kubelet, kube-proxy, container runtime
3. yaml-and-objects
   - description: Comprendre la structure des objets Kubernetes et le format YAML.
   - status: ready
   - prerequisites: kubernetes-basics
   - topics: 4
     1. kubernetes-object-model
        description: Entités persistantes, spec vs status, desired state
     2. anatomy-of-a-manifest
        description: apiVersion, kind, metadata, spec — décortiqué
     3. generating-manifests-from-cli
        description: `kubectl run --dry-run=client -o yaml`
     4. object-names-uids-and-dns-rules
        description: Contraintes de nommage, identifiants uniques
4. kubectl-essentials
   - description: Maîtriser les commandes kubectl fondamentales.
   - status: ready
   - prerequisites: yaml-and-objects
   - topics: 6
     1. imperative-vs-declarative
        description: Commandes impératives, kubectl apply, quand utiliser quoi
     2. viewing-resources
        description: get, describe, explain — lire et comprendre
     3. logs-and-exec
        description: kubectl logs, kubectl exec — debugger un container
     4. creating-and-editing-resources
        description: create, apply, edit, patch, replace
     5. delete-and-cleanup
        description: delete, --grace-period, force delete
     6. formatting-output-and-tips
        description: -o wide/yaml/json, JSONPath, custom-columns, certification tips
5. pods
   - description: Le Pod : unité de base de Kubernetes. Créer, inspecter, comprendre le cycle de vie.
   - status: ready
   - prerequisites: kubectl-essentials
   - topics: 6
     1. what-is-a-pod
        description: Pourquoi le Pod, relation pod/container, networking intra-pod
     2. pod-structure
        description: containers, ports, env — anatomie du manifest
     3. creating-your-first-pod
        description: Impératif et déclaratif, premier déploiement
     4. pod-lifecycle-and-phases
        description: Pending, Running, Succeeded, Failed, Unknown
     5. container-restart-policies
        description: Always, OnFailure, Never — impact sur le comportement
     6. editing-pods
        description: Ce qu'on peut/ne peut pas modifier, recréation
6. namespaces
   - description: Isolation logique des ressources dans un cluster.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. what-are-namespaces
        description: Isolation logique, multi-tenancy léger
     2. default-namespaces
        description: default, kube-system, kube-public, kube-node-lease
     3. working-across-namespaces
        description: -n flag, DNS cross-namespace, context defaults
     4. when-to-use-multiple-namespaces
        description: Stratégies d'organisation, bonnes pratiques
7. labels-and-annotations
   - description: Labels, sélecteurs et annotations : organiser et filtrer les objets.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. what-are-labels
        description: Paires clé/valeur, syntaxe, contraintes
     2. label-selectors
        description: Equality-based, set-based, matchLabels vs matchExpressions
     3. annotations
        description: Métadonnées non identifiantes, cas d'usage
     4. recommended-labels
        description: Standards app.kubernetes.io/\*, bonnes pratiques
8. cluster-architecture-deep
   - description: Plongée dans les composants internes du cluster.
   - status: ready
   - prerequisites: kubernetes-basics
   - topics: 5
     1. etcd-deep-dive
        description: Stockage clé-valeur, consensus, HA
     2. kube-apiserver-internals
        description: Processing pipeline, admission, audit
     3. kube-scheduler-internals
        description: Filtering, scoring, extensibilité
     4. kube-controller-manager
        description: Controllers built-in, reconciliation loops
     5. container-runtime-interface
        description: CRI, containerd, CRI-O, dockershim deprecation
9. networking-fundamentals
   - description: Prérequis réseau pour le CKA : switching, routing, DNS, namespaces.
   - status: ready
   - prerequisites: kubernetes-basics
   - topics: 4
     1. switching-and-routing
        description: Interfaces, routes, gateways (rappels Linux)
     2. dns-fundamentals
        description: Résolution, /etc/hosts, /etc/resolv.conf
     3. network-namespaces
        description: Isolation réseau Linux, veth pairs
     4. docker-networking
        description: Bridge, host, none — rappel
10. kubernetes-networking

- description: Réseau interne Kubernetes : CNI, pod networking, service networking.
- status: ready
- prerequisites: networking-fundamentals, services
- topics: 6
  1.  cni-concepts
      description: Container Network Interface, plugins
  2.  pod-networking
      description: Modèle réseau K8s, communication inter-pods
  3.  service-networking
      description: kube-proxy modes (iptables, IPVS), ClusterIP internals
  4.  cluster-networking-configuration
      description: Configurer le réseau, CNI Weave/Calico/Flannel
  5.  ipam
      description: IP Address Management, pod CIDR
  6.  cni-troubleshooting-method
      description: Extension 2026: cni troubleshooting method.

11. commands-and-args

- description: Contrôler le point d'entrée et les arguments d'un container.
- status: ready
- prerequisites: pods
- topics: 3
  1.  docker-cmd-vs-entrypoint
      description: Rappel Docker, override behavior
  2.  command-and-args-in-kubernetes
      description: Mapping Docker → K8s, syntaxe YAML
  3.  practical-override-scenarios
      description: Exemples concrets, debugging tips

12. configmaps

- description: Externaliser la configuration applicative.
- status: ready
- prerequisites: pods
- topics: 5
  1.  what-is-a-configmap
      description: Concept, séparation config/code
  2.  creating-configmaps
      description: --from-literal, --from-file, --from-env-file, YAML
  3.  using-via-environment-variables
      description: envFrom, valueFrom, variables individuelles
  4.  using-via-volume-mounts
      description: Montage complet, fichiers spécifiques, subPath
  5.  immutable-configmaps
      description: Pourquoi, comment, impact

13. secrets

- description: Gérer les données sensibles (mots de passe, tokens, clés).
- status: ready
- prerequisites: configmaps
- topics: 5
  1.  what-is-a-secret
      description: Différence avec ConfigMap, encoding base64
  2.  types-of-secrets
      description: Opaque, docker-registry, tls, basic-auth
  3.  creating-and-using-secrets
      description: CLI, YAML, env vars, volume mounts
  4.  encrypting-secrets-at-rest
      description: EncryptionConfiguration, etcd encryption
  5.  security-best-practices
      description: Limitations, RBAC, external secret managers

14. resource-management

- description: Contrôler CPU et mémoire : requests, limits, QoS.
- status: ready
- prerequisites: pods
- topics: 6
  1.  resource-requests-and-limits
      description: CPU (millicores), mémoire (Mi/Gi), syntaxe
  2.  how-scheduling-uses-requests
      description: Le scheduler et les requests, overcommit
  3.  what-happens-when-limits-are-exceeded
      description: OOMKilled, CPU throttling
  4.  qos-classes
      description: Guaranteed, Burstable, BestEffort — impact éviction
  5.  limitranges-and-resourcequotas
      description: Defaults namespace, limites globales
  6.  in-place-resize-operational-considerations
      description: Extension 2026: in place resize operational considerations.

15. replicasets

- description: Maintenir un nombre stable de répliques de Pods.
- status: ready
- prerequisites: labels-and-annotations
- topics: 4
  1.  why-replicasets
      description: Le problème : pods éphémères, besoin de réplication
  2.  creating-a-replicaset
      description: Manifest, template, label selector
  3.  scaling-and-self-healing
      description: Scaling manuel, auto-remplacement des pods crashés
  4.  limitations-of-replicasets
      description: Pourquoi on utilise des Deployments à la place

16. deployments

- description: Déployer, scaler et mettre à jour des applications de manière déclarative.
- status: ready
- prerequisites: replicasets
- topics: 5
  1.  what-is-a-deployment
      description: Deployments vs ReplicaSets, quand utiliser quoi
  2.  creating-a-deployment
      description: Manifest, scaling basique
  3.  rolling-updates
      description: Stratégie par défaut, mise à jour d'image
  4.  rollback-and-revision-history
      description: kubectl rollout undo, history, annotations
  5.  update-strategies
      description: RollingUpdate vs Recreate, maxSurge, maxUnavailable

17. daemonsets

- description: Un Pod par node : logging, monitoring, networking agents.
- status: ready
- prerequisites: deployments
- topics: 4
  1.  what-is-a-daemonset
      description: Un pod par node, différence avec Deployment
  2.  typical-use-cases
      description: Logging (fluentd), monitoring (node-exporter), CNI
  3.  daemonset-scheduling
      description: Tolerations, nodeSelector, affinity
  4.  updating-daemonsets
      description: Rolling update, on delete

18. multi-container-pods

- description: Patterns multi-containers : sidecar, init containers, ambassador.
- status: ready
- prerequisites: pods
- topics: 5
  1.  why-multiple-containers
      description: Shared network/storage, cas d'usage
  2.  sidecar-pattern
      description: Logging, proxy, sync — exemples concrets
  3.  ambassador-and-adapter-patterns
      description: Proxy sortant, normalisation de données
  4.  init-containers
      description: Séquençage, cas d'usage, différences avec app containers
  5.  native-sidecar-patterns
      description: Extension 2026: native sidecar patterns.

19. scheduling-basics

- description: Contrôler où les Pods s'exécutent : taints, tolerations, affinity.
- status: ready
- prerequisites: pods, labels-and-annotations
- topics: 4
  1.  taints-and-tolerations
      description: Repousser les pods, NoSchedule, NoExecute, PreferNoSchedule
  2.  node-selectors
      description: Placer un pod sur un node spécifique (simple)
  3.  node-affinity
      description: requiredDuringScheduling, preferredDuringScheduling
  4.  taints-vs-node-affinity
      description: Quand utiliser quoi, combiner les deux

20. advanced-scheduling

- description: Scheduling avancé : static pods, priority, multi-schedulers.
- status: ready
- prerequisites: scheduling-basics
- topics: 5
  1.  manual-scheduling
      description: Assigner un pod à un node sans scheduler
  2.  static-pods
      description: Pods gérés par kubelet, manifests statiques
  3.  priority-classes
      description: PriorityClass, preemption
  4.  multiple-schedulers
      description: Déployer un scheduler custom, schedulerName
  5.  scheduler-profiles
      description: Configurer les plugins du scheduler

21. probes

- description: Health checks : liveness, readiness, startup probes.
- status: ready
- prerequisites: pods
- topics: 6
  1.  why-probes-matter
      description: Détection de pannes, traffic routing
  2.  liveness-probes
      description: Quand le container est mort, restart automatique
  3.  readiness-probes
      description: Quand le container n'est pas prêt, retrait du Service
  4.  startup-probes
      description: Applications lentes à démarrer, protection
  5.  probe-types-and-configuration
      description: httpGet, tcpSocket, exec, timing parameters
  6.  startup-probe-for-slow-apps
      description: Extension 2026: startup probe for slow apps.

22. jobs

- description: Tâches one-shot et planifiées : Jobs et CronJobs.
- status: ready
- prerequisites: pods
- topics: 4
  1.  what-is-a-job
      description: Tâche à exécution unique, complétion
  2.  job-parallelism-and-completions
      description: Parallélisme, multiple completions
  3.  backoff-and-retry
      description: backoffLimit, activeDeadlineSeconds, TTL
  4.  cronjobs
      description: Syntaxe cron, concurrencyPolicy, suspend

23. autoscaling

- description: Scaling automatique : HPA, VPA, resize in-place.
- status: ready
- prerequisites: deployments, resource-management
- topics: 6
  1.  introduction-to-autoscaling
      description: Pourquoi scaler automatiquement, approches
  2.  horizontal-pod-autoscaler
      description: HPA basé CPU/mémoire, configuration
  3.  hpa-stabilization-and-behavior
      description: Stabilization window, scaling policies
  4.  vertical-pod-autoscaler
      description: VPA concepts, modes (Off, Initial, Auto)
  5.  in-place-resize-of-pods
      description: Resize sans restart (K8s 1.27+)
  6.  event-driven-scaling-concepts
      description: Extension 2026: event driven scaling concepts.

24. services

- description: Exposer des Pods avec un point d'accès réseau stable.
- status: ready
- prerequisites: pods, labels-and-annotations
- topics: 6
  1.  why-services
      description: IP éphémères des pods, besoin d'abstraction
  2.  service-and-endpoints
      description: Mécanisme de sélection, endpoints automatiques
  3.  clusterip
      description: Type par défaut, accès interne uniquement
  4.  nodeport
      description: Exposer sur un port de chaque node
  5.  loadbalancer
      description: Intégration cloud, IP externe
  6.  named-ports
      description: Nommage des ports, bonnes pratiques

25. dns

- description: Découverte de services via DNS interne.
- status: ready
- prerequisites: services
- topics: 4
  1.  dns-in-kubernetes
      description: CoreDNS, résolution automatique
  2.  service-dns-records
      description: `svc-name.namespace.svc.cluster.local`
  3.  pod-dns-records
      description: Pods DNS, hostname et subdomain
  4.  dns-debugging
      description: nslookup, dig depuis un pod, dépannage

26. ingress

- description: Router le trafic HTTP/HTTPS externe vers les Services.
- status: ready
- prerequisites: services
- topics: 5
  1.  what-is-ingress
      description: Concept, Ingress vs Service LoadBalancer
  2.  ingress-controllers
      description: NGINX, Traefik — déploiement nécessaire
  3.  routing-rules
      description: Host-based, path-based, default backend
  4.  tls-termination
      description: Certificats, Secrets TLS, HTTPS
  5.  annotations-and-rewrite-target
      description: Configuration spécifique au controller

27. gateway-api

- description: La nouvelle API de Gateway : remplacement moderne d'Ingress.
- status: ready
- prerequisites: ingress
- topics: 8
  1.  introduction-to-gateway-api
      description: Pourquoi remplacer Ingress, avantages
  2.  gateway-api-structure
      description: Gateway, HTTPRoute, GatewayClass
  3.  practical-gateway-api
      description: Déployer et configurer
  4.  tls-with-gateway-api
      description: TLS terminate mode, passthrough
  5.  mapping-ingress-to-gateway-api
      description: Migration, équivalences
  6.  gatewayclass-and-controller-operations
      description: Extension 2026: gatewayclass and controller operations.
  7.  httproute-basics
      description: Extension 2026: httproute basics.
  8.  weighted-routing-canary
      description: Extension 2026: weighted routing canary.

28. network-policies

- description: Contrôler le trafic réseau entre Pods.
- status: ready
- prerequisites: services
- topics: 5
  1.  what-are-network-policies
      description: Concept, deny-all par défaut
  2.  networkpolicy-structure
      description: podSelector, policyTypes, rules
  3.  ingress-rules
      description: Autoriser le trafic entrant, from selectors
  4.  egress-rules
      description: Autoriser le trafic sortant, to selectors
  5.  advanced-rules
      description: CIDR blocks, ports, protocols, except

29. volumes

- description: Partager et persister des données dans un Pod.
- status: ready
- prerequisites: pods
- topics: 4
  1.  why-volumes
      description: Filesystem éphémère des containers, besoin de persistance
  2.  emptydir
      description: Partage entre containers, scratch space
  3.  hostpath
      description: Monter un chemin du node, risques
  4.  configmap-and-secret-volumes
      description: Monter ConfigMaps et Secrets comme fichiers

30. persistent-storage

- description: Persistent Volumes et Claims : stockage découplé du Pod.
- status: ready
- prerequisites: volumes
- topics: 5
  1.  pv-and-pvc-concepts
      description: Séparation admin/dev, lifecycle
  2.  creating-a-persistentvolume
      description: Manifest, capacity, accessModes
  3.  creating-a-persistentvolumeclaim
      description: Binding, request vs capacity
  4.  using-pvcs-in-pods
      description: volumeMounts, claimName
  5.  access-modes-and-reclaim-policies
      description: RWO, ROX, RWX, Retain, Delete, Recycle

31. storage-classes

- description: Provisionnement dynamique de volumes.
- status: ready
- prerequisites: persistent-storage
- topics: 4
  1.  static-vs-dynamic-provisioning
      description: Le problème du provisionnement manuel
  2.  what-is-a-storageclass
      description: Provisioner, parameters, reclaimPolicy
  3.  dynamic-provisioning-in-practice
      description: Créer une SC, l'utiliser avec un PVC
  4.  container-storage-interface
      description: CSI concept, plugins courants

32. statefulsets

- description: Applications stateful : identité stable, stockage persistant par pod.
- status: ready
- prerequisites: deployments, persistent-storage, services
- topics: 5
  1.  stateful-vs-stateless
      description: Pourquoi les Deployments ne suffisent pas
  2.  statefulset-fundamentals
      description: Identité stable, nommage ordonné
  3.  headless-services
      description: Pourquoi et comment, DNS par pod
  4.  storage-in-statefulsets
      description: volumeClaimTemplates, PVC par pod
  5.  ordering-and-updates
      description: Ordered/parallel pod management, rolling updates

33. service-accounts

- description: Identité des Pods pour accéder à l'API Kubernetes.
- status: ready
- prerequisites: pods, namespaces
- topics: 5
  1.  what-is-a-serviceaccount
      description: Identité pod, default SA, différence avec users
  2.  creating-and-assigning-sas
      description: Créer un SA, l'assigner à un pod
  3.  token-projection-and-automount
      description: Projected tokens, automountServiceAccountToken
  4.  practical-scenarios
      description: Accès API depuis un pod, debugging
  5.  projected-serviceaccount-token
      description: Extension 2026: projected serviceaccount token.

34. authentication

- description: Comment Kubernetes identifie les utilisateurs et les pods.
- status: ready
- prerequisites: kubernetes-basics
- topics: 3
  1.  security-primitives
      description: Qui peut accéder ? Que peut-il faire ?
  2.  authentication-methods
      description: Certificates, tokens, OIDC — vue d'ensemble
  3.  users-vs-serviceaccounts
      description: Humains vs machines, pas d'objet User dans K8s

35. tls-certificates

- description: PKI Kubernetes : créer, gérer et renouveler les certificats TLS.
- status: ready
- prerequisites: authentication
- topics: 5
  1.  tls-and-pki-basics
      description: Chiffrement asymétrique, CA, chaîne de confiance
  2.  tls-in-kubernetes
      description: Quels composants utilisent TLS, quels certificats
  3.  certificate-creation
      description: openssl, cfssl — générer des certs pour K8s
  4.  viewing-certificate-details
      description: Inspecter les certs existants, expiration
  5.  certificates-api
      description: CertificateSigningRequest, approbation, rotation

36. kubeconfig

- description: Configurer l'accès au cluster : contextes, utilisateurs, clusters.
- status: ready
- prerequisites: authentication
- topics: 4
  1.  kubeconfig-basics
      description: Pourquoi kubeconfig, localisation par défaut
  2.  structure-clusters-users-contexts
      description: Les 3 sections, comment elles s'articulent
  3.  switching-contexts
      description: kubectl config use-context, current-context
  4.  creating-kubeconfig-from-scratch
      description: Construire un fichier complet manuellement

37. rbac

- description: Contrôler les permissions : Roles, RoleBindings, ClusterRoles.
- status: ready
- prerequisites: service-accounts, kubeconfig
- topics: 5
  1.  authorization-methods-overview
      description: RBAC, ABAC, webhooks — pourquoi RBAC
  2.  roles-and-rolebindings
      description: Permissions namespace-scoped, création
  3.  clusterroles-and-clusterrolebindings
      description: Permissions cluster-wide
  4.  testing-permissions
      description: kubectl auth can-i, impersonation
  5.  rbac-best-practices
      description: Least privilege, audit, agrégation

38. security-contexts

- description: Contrôler les privilèges de sécurité des containers.
- status: ready
- prerequisites: pods
- topics: 4
  1.  security-in-docker-recap
      description: Namespaces Linux, capabilities, root vs non-root
  2.  pod-vs-container-security-context
      description: Niveaux d'application, héritage
  3.  runasuser-runasgroup-runasnonroot
      description: Contrôler l'identité du process
  4.  capabilities-and-readonlyrootfilesystem
      description: Ajouter/retirer des capabilities, filesystem en lecture seule

39. image-security

- description: Sécuriser l'approvisionnement des images container.
- status: ready
- prerequisites: pods
- topics: 3
  1.  image-naming-and-registries
      description: Registry privé, fully qualified image names
  2.  imagepullsecrets
      description: Créer et utiliser des secrets de registry
  3.  image-pull-policies
      description: Always, IfNotPresent, Never — impact

40. admission-controllers

- description: Intercepter et modifier les requêtes API avant persistence.
- status: ready
- prerequisites: rbac
- topics: 4
  1.  what-are-admission-controllers
      description: Chaîne de traitement API, built-in controllers
  2.  enabling-and-disabling
      description: kube-apiserver flags, controllers courants
  3.  validating-webhooks
      description: Rejeter les requêtes non conformes
  4.  mutating-webhooks
      description: Modifier les requêtes à la volée, injection de sidecar

41. pod-security

- description: Pod Security Standards et Pod Security Admission.
- status: ready
- prerequisites: security-contexts, namespaces
- topics: 3
  1.  pod-security-standards
      description: Privileged, Baseline, Restricted — les 3 niveaux
  2.  pod-security-admission
      description: Labels de namespace, enforce/audit/warn
  3.  practical-enforcement
      description: Appliquer des standards à un namespace

42. cluster-installation

- description: Installer un cluster Kubernetes avec kubeadm.
- status: ready
- prerequisites: cluster-architecture-deep
- topics: 4
  1.  installation-options-overview
      description: Managed vs self-hosted, minikube/kind/kubeadm
  2.  kubeadm-master-node-setup
      description: kubeadm init, phases, CNI
  3.  kubeadm-worker-node-join
      description: kubeadm join, token, discovery
  4.  high-availability-considerations
      description: Multi-master, etcd topology, LB

43. cluster-maintenance

- description: Maintenir un cluster en production : upgrades, drain, eviction.
- status: ready
- prerequisites: cluster-installation
- topics: 5
  1.  os-upgrades-and-drain
      description: kubectl drain, cordon, uncordon
  2.  version-skew-policy
      description: Compatibilité entre composants
  3.  cluster-upgrade-process
      description: kubeadm upgrade plan/apply, worker upgrade
  4.  taint-based-evictions
      description: Eviction automatique, tolerationSeconds
  5.  version-skew-and-safe-upgrade-flow
      description: Extension 2026: version skew and safe upgrade flow.

44. backup-and-restore

- description: Sauvegarder et restaurer l'état du cluster via etcd.
- status: ready
- prerequisites: cluster-architecture-deep
- topics: 5
  1.  backup-strategies
      description: Ressources YAML vs etcd snapshot
  2.  etcd-backup-with-etcdctl
      description: ETCDCTL_API=3, snapshot save
  3.  restore-from-snapshot
      description: snapshot restore, reconfiguration
  4.  etcdutl
      description: Nouvel outil, migration depuis ETCDCTL
  5.  etcd-restore-drill-end-to-end
      description: Extension 2026: etcd restore drill end to end.

45. logging-and-monitoring

- description: Logs, métriques et événements pour surveiller les applications.
- status: ready
- prerequisites: pods
- topics: 4
  1.  container-logging-basics
      description: kubectl logs, -f, --previous, multi-container
  2.  monitoring-with-metrics-server
      description: kubectl top pods/nodes, installation
  3.  kubernetes-events
      description: kubectl get events, describe, event sources
  4.  monitoring-cluster-component-logs
      description: Logs apiserver, scheduler, kubelet

46. troubleshooting

- description: Diagnostiquer et résoudre les pannes application et cluster.
- status: ready
- prerequisites: logging-and-monitoring, services, deployments
- topics: 6
  1.  troubleshooting-application-failures
      description: CrashLoopBackOff, ImagePullBackOff, pending pods
  2.  troubleshooting-service-connectivity
      description: Endpoints manquants, DNS, network policies
  3.  troubleshooting-control-plane
      description: apiserver, etcd, scheduler, controller-manager down
  4.  troubleshooting-worker-nodes
      description: Node NotReady, kubelet, disk pressure
  5.  systematic-debugging-methodology
      description: Approche structurée, checklist de diagnostic
  6.  debug-distroless-with-kubectl-debug
      description: Extension 2026: debug distroless with kubectl debug.

47. api-and-versioning

- description: Groupes d'API, versions et politique de dépréciation.
- status: ready
- prerequisites: kubectl-essentials
- topics: 4
  1.  api-groups
      description: /api (core), /apis (named groups)
  2.  api-versions
      description: alpha, beta, stable — signification
  3.  api-deprecation-policy
      description: Durée de support, migration
  4.  field-selectors
      description: Filtrer par champs (status.phase, metadata.name)

48. custom-resources

- description: Étendre Kubernetes avec des CRDs et des controllers custom.
- status: ready
- prerequisites: api-and-versioning
- topics: 4
  1.  what-are-custom-resources
      description: Étendre l'API, CRDs
  2.  creating-a-crd
      description: Manifest, validation, schema
  3.  custom-controllers
      description: Reconciliation, watch, react
  4.  operator-pattern
      description: Operators, frameworks (Operator SDK, kubebuilder)

49. helm

- description: Gestionnaire de packages Kubernetes.
- status: ready
- prerequisites: kubectl-essentials
- topics: 5
  1.  what-is-helm
      description: Charts, releases, repositories — concepts
  2.  installing-helm
      description: Installation, configuration
  3.  working-with-charts
      description: helm install, upgrade, rollback, uninstall
  4.  values-and-configuration
      description: values.yaml, --set, override hierarchy
  5.  finding-and-using-charts
      description: helm search, artifact hub, helm repo

### Path: kcna-to-ckad-delta

Description: Modules a etudier apres KCNA pour couvrir le delta CKAD.
Modules: 18

1. commands-and-args
   - description: Contrôler le point d'entrée et les arguments d'un container.
   - status: ready
   - prerequisites: pods
   - topics: 3
     1. docker-cmd-vs-entrypoint
        description: Rappel Docker, override behavior
     2. command-and-args-in-kubernetes
        description: Mapping Docker → K8s, syntaxe YAML
     3. practical-override-scenarios
        description: Exemples concrets, debugging tips
2. multi-container-pods
   - description: Patterns multi-containers : sidecar, init containers, ambassador.
   - status: ready
   - prerequisites: pods
   - topics: 5
     1. why-multiple-containers
        description: Shared network/storage, cas d'usage
     2. sidecar-pattern
        description: Logging, proxy, sync — exemples concrets
     3. ambassador-and-adapter-patterns
        description: Proxy sortant, normalisation de données
     4. init-containers
        description: Séquençage, cas d'usage, différences avec app containers
     5. native-sidecar-patterns
        description: Extension 2026: native sidecar patterns.
3. jobs
   - description: Tâches one-shot et planifiées : Jobs et CronJobs.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. what-is-a-job
        description: Tâche à exécution unique, complétion
     2. job-parallelism-and-completions
        description: Parallélisme, multiple completions
     3. backoff-and-retry
        description: backoffLimit, activeDeadlineSeconds, TTL
     4. cronjobs
        description: Syntaxe cron, concurrencyPolicy, suspend
4. configmaps
   - description: Externaliser la configuration applicative.
   - status: ready
   - prerequisites: pods
   - topics: 5
     1. what-is-a-configmap
        description: Concept, séparation config/code
     2. creating-configmaps
        description: --from-literal, --from-file, --from-env-file, YAML
     3. using-via-environment-variables
        description: envFrom, valueFrom, variables individuelles
     4. using-via-volume-mounts
        description: Montage complet, fichiers spécifiques, subPath
     5. immutable-configmaps
        description: Pourquoi, comment, impact
5. secrets
   - description: Gérer les données sensibles (mots de passe, tokens, clés).
   - status: ready
   - prerequisites: configmaps
   - topics: 5
     1. what-is-a-secret
        description: Différence avec ConfigMap, encoding base64
     2. types-of-secrets
        description: Opaque, docker-registry, tls, basic-auth
     3. creating-and-using-secrets
        description: CLI, YAML, env vars, volume mounts
     4. encrypting-secrets-at-rest
        description: EncryptionConfiguration, etcd encryption
     5. security-best-practices
        description: Limitations, RBAC, external secret managers
6. resource-management
   - description: Contrôler CPU et mémoire : requests, limits, QoS.
   - status: ready
   - prerequisites: pods
   - topics: 6
     1. resource-requests-and-limits
        description: CPU (millicores), mémoire (Mi/Gi), syntaxe
     2. how-scheduling-uses-requests
        description: Le scheduler et les requests, overcommit
     3. what-happens-when-limits-are-exceeded
        description: OOMKilled, CPU throttling
     4. qos-classes
        description: Guaranteed, Burstable, BestEffort — impact éviction
     5. limitranges-and-resourcequotas
        description: Defaults namespace, limites globales
     6. in-place-resize-operational-considerations
        description: Extension 2026: in place resize operational considerations.
7. probes
   - description: Health checks : liveness, readiness, startup probes.
   - status: ready
   - prerequisites: pods
   - topics: 6
     1. why-probes-matter
        description: Détection de pannes, traffic routing
     2. liveness-probes
        description: Quand le container est mort, restart automatique
     3. readiness-probes
        description: Quand le container n'est pas prêt, retrait du Service
     4. startup-probes
        description: Applications lentes à démarrer, protection
     5. probe-types-and-configuration
        description: httpGet, tcpSocket, exec, timing parameters
     6. startup-probe-for-slow-apps
        description: Extension 2026: startup probe for slow apps.
8. security-contexts
   - description: Contrôler les privilèges de sécurité des containers.
   - status: ready
   - prerequisites: pods
   - topics: 4
     1. security-in-docker-recap
        description: Namespaces Linux, capabilities, root vs non-root
     2. pod-vs-container-security-context
        description: Niveaux d'application, héritage
     3. runasuser-runasgroup-runasnonroot
        description: Contrôler l'identité du process
     4. capabilities-and-readonlyrootfilesystem
        description: Ajouter/retirer des capabilities, filesystem en lecture seule
9. deployment-strategies
   - description: Stratégies de déploiement avancées : blue-green, canary.
   - status: ready
   - prerequisites: deployments
   - topics: 4
     1. blue-green-deployments
        description: Concept, implémentation avec labels/services
     2. canary-deployments
        description: Concept, implémentation avec poids/répliques
     3. pause-and-resume-rollouts
        description: kubectl rollout pause/resume, cas d'usage
     4. choosing-a-deployment-strategy
        description: Arbre de décision, trade-offs
10. statefulsets

- description: Applications stateful : identité stable, stockage persistant par pod.
- status: ready
- prerequisites: deployments, persistent-storage, services
- topics: 5
  1.  stateful-vs-stateless
      description: Pourquoi les Deployments ne suffisent pas
  2.  statefulset-fundamentals
      description: Identité stable, nommage ordonné
  3.  headless-services
      description: Pourquoi et comment, DNS par pod
  4.  storage-in-statefulsets
      description: volumeClaimTemplates, PVC par pod
  5.  ordering-and-updates
      description: Ordered/parallel pod management, rolling updates

11. service-accounts

- description: Identité des Pods pour accéder à l'API Kubernetes.
- status: ready
- prerequisites: pods, namespaces
- topics: 5
  1.  what-is-a-serviceaccount
      description: Identité pod, default SA, différence avec users
  2.  creating-and-assigning-sas
      description: Créer un SA, l'assigner à un pod
  3.  token-projection-and-automount
      description: Projected tokens, automountServiceAccountToken
  4.  practical-scenarios
      description: Accès API depuis un pod, debugging
  5.  projected-serviceaccount-token
      description: Extension 2026: projected serviceaccount token.

12. authentication

- description: Comment Kubernetes identifie les utilisateurs et les pods.
- status: ready
- prerequisites: kubernetes-basics
- topics: 3
  1.  security-primitives
      description: Qui peut accéder ? Que peut-il faire ?
  2.  authentication-methods
      description: Certificates, tokens, OIDC — vue d'ensemble
  3.  users-vs-serviceaccounts
      description: Humains vs machines, pas d'objet User dans K8s

13. kubeconfig

- description: Configurer l'accès au cluster : contextes, utilisateurs, clusters.
- status: ready
- prerequisites: authentication
- topics: 4
  1.  kubeconfig-basics
      description: Pourquoi kubeconfig, localisation par défaut
  2.  structure-clusters-users-contexts
      description: Les 3 sections, comment elles s'articulent
  3.  switching-contexts
      description: kubectl config use-context, current-context
  4.  creating-kubeconfig-from-scratch
      description: Construire un fichier complet manuellement

14. rbac

- description: Contrôler les permissions : Roles, RoleBindings, ClusterRoles.
- status: ready
- prerequisites: service-accounts, kubeconfig
- topics: 5
  1.  authorization-methods-overview
      description: RBAC, ABAC, webhooks — pourquoi RBAC
  2.  roles-and-rolebindings
      description: Permissions namespace-scoped, création
  3.  clusterroles-and-clusterrolebindings
      description: Permissions cluster-wide
  4.  testing-permissions
      description: kubectl auth can-i, impersonation
  5.  rbac-best-practices
      description: Least privilege, audit, agrégation

15. admission-controllers

- description: Intercepter et modifier les requêtes API avant persistence.
- status: ready
- prerequisites: rbac
- topics: 4
  1.  what-are-admission-controllers
      description: Chaîne de traitement API, built-in controllers
  2.  enabling-and-disabling
      description: kube-apiserver flags, controllers courants
  3.  validating-webhooks
      description: Rejeter les requêtes non conformes
  4.  mutating-webhooks
      description: Modifier les requêtes à la volée, injection de sidecar

16. api-and-versioning

- description: Groupes d'API, versions et politique de dépréciation.
- status: ready
- prerequisites: kubectl-essentials
- topics: 4
  1.  api-groups
      description: /api (core), /apis (named groups)
  2.  api-versions
      description: alpha, beta, stable — signification
  3.  api-deprecation-policy
      description: Durée de support, migration
  4.  field-selectors
      description: Filtrer par champs (status.phase, metadata.name)

17. custom-resources

- description: Étendre Kubernetes avec des CRDs et des controllers custom.
- status: ready
- prerequisites: api-and-versioning
- topics: 4
  1.  what-are-custom-resources
      description: Étendre l'API, CRDs
  2.  creating-a-crd
      description: Manifest, validation, schema
  3.  custom-controllers
      description: Reconciliation, watch, react
  4.  operator-pattern
      description: Operators, frameworks (Operator SDK, kubebuilder)

18. helm

- description: Gestionnaire de packages Kubernetes.
- status: ready
- prerequisites: kubectl-essentials
- topics: 5
  1.  what-is-helm
      description: Charts, releases, repositories — concepts
  2.  installing-helm
      description: Installation, configuration
  3.  working-with-charts
      description: helm install, upgrade, rollback, uninstall
  4.  values-and-configuration
      description: values.yaml, --set, override hierarchy
  5.  finding-and-using-charts
      description: helm search, artifact hub, helm repo

### Path: ckad-to-cka-delta

Description: Modules a etudier apres CKAD pour couvrir le delta CKA.
Modules: 16

1. cluster-architecture-deep
   - description: Plongée dans les composants internes du cluster.
   - status: ready
   - prerequisites: kubernetes-basics
   - topics: 5
     1. etcd-deep-dive
        description: Stockage clé-valeur, consensus, HA
     2. kube-apiserver-internals
        description: Processing pipeline, admission, audit
     3. kube-scheduler-internals
        description: Filtering, scoring, extensibilité
     4. kube-controller-manager
        description: Controllers built-in, reconciliation loops
     5. container-runtime-interface
        description: CRI, containerd, CRI-O, dockershim deprecation
2. networking-fundamentals
   - description: Prérequis réseau pour le CKA : switching, routing, DNS, namespaces.
   - status: ready
   - prerequisites: kubernetes-basics
   - topics: 4
     1. switching-and-routing
        description: Interfaces, routes, gateways (rappels Linux)
     2. dns-fundamentals
        description: Résolution, /etc/hosts, /etc/resolv.conf
     3. network-namespaces
        description: Isolation réseau Linux, veth pairs
     4. docker-networking
        description: Bridge, host, none — rappel
3. kubernetes-networking
   - description: Réseau interne Kubernetes : CNI, pod networking, service networking.
   - status: ready
   - prerequisites: networking-fundamentals, services
   - topics: 6
     1. cni-concepts
        description: Container Network Interface, plugins
     2. pod-networking
        description: Modèle réseau K8s, communication inter-pods
     3. service-networking
        description: kube-proxy modes (iptables, IPVS), ClusterIP internals
     4. cluster-networking-configuration
        description: Configurer le réseau, CNI Weave/Calico/Flannel
     5. ipam
        description: IP Address Management, pod CIDR
     6. cni-troubleshooting-method
        description: Extension 2026: cni troubleshooting method.
4. daemonsets
   - description: Un Pod par node : logging, monitoring, networking agents.
   - status: ready
   - prerequisites: deployments
   - topics: 4
     1. what-is-a-daemonset
        description: Un pod par node, différence avec Deployment
     2. typical-use-cases
        description: Logging (fluentd), monitoring (node-exporter), CNI
     3. daemonset-scheduling
        description: Tolerations, nodeSelector, affinity
     4. updating-daemonsets
        description: Rolling update, on delete
5. scheduling-basics
   - description: Contrôler où les Pods s'exécutent : taints, tolerations, affinity.
   - status: ready
   - prerequisites: pods, labels-and-annotations
   - topics: 4
     1. taints-and-tolerations
        description: Repousser les pods, NoSchedule, NoExecute, PreferNoSchedule
     2. node-selectors
        description: Placer un pod sur un node spécifique (simple)
     3. node-affinity
        description: requiredDuringScheduling, preferredDuringScheduling
     4. taints-vs-node-affinity
        description: Quand utiliser quoi, combiner les deux
6. advanced-scheduling
   - description: Scheduling avancé : static pods, priority, multi-schedulers.
   - status: ready
   - prerequisites: scheduling-basics
   - topics: 5
     1. manual-scheduling
        description: Assigner un pod à un node sans scheduler
     2. static-pods
        description: Pods gérés par kubelet, manifests statiques
     3. priority-classes
        description: PriorityClass, preemption
     4. multiple-schedulers
        description: Déployer un scheduler custom, schedulerName
     5. scheduler-profiles
        description: Configurer les plugins du scheduler
7. autoscaling
   - description: Scaling automatique : HPA, VPA, resize in-place.
   - status: ready
   - prerequisites: deployments, resource-management
   - topics: 6
     1. introduction-to-autoscaling
        description: Pourquoi scaler automatiquement, approches
     2. horizontal-pod-autoscaler
        description: HPA basé CPU/mémoire, configuration
     3. hpa-stabilization-and-behavior
        description: Stabilization window, scaling policies
     4. vertical-pod-autoscaler
        description: VPA concepts, modes (Off, Initial, Auto)
     5. in-place-resize-of-pods
        description: Resize sans restart (K8s 1.27+)
     6. event-driven-scaling-concepts
        description: Extension 2026: event driven scaling concepts.
8. gateway-api
   - description: La nouvelle API de Gateway : remplacement moderne d'Ingress.
   - status: ready
   - prerequisites: ingress
   - topics: 8
     1. introduction-to-gateway-api
        description: Pourquoi remplacer Ingress, avantages
     2. gateway-api-structure
        description: Gateway, HTTPRoute, GatewayClass
     3. practical-gateway-api
        description: Déployer et configurer
     4. tls-with-gateway-api
        description: TLS terminate mode, passthrough
     5. mapping-ingress-to-gateway-api
        description: Migration, équivalences
     6. gatewayclass-and-controller-operations
        description: Extension 2026: gatewayclass and controller operations.
     7. httproute-basics
        description: Extension 2026: httproute basics.
     8. weighted-routing-canary
        description: Extension 2026: weighted routing canary.
9. storage-classes
   - description: Provisionnement dynamique de volumes.
   - status: ready
   - prerequisites: persistent-storage
   - topics: 4
     1. static-vs-dynamic-provisioning
        description: Le problème du provisionnement manuel
     2. what-is-a-storageclass
        description: Provisioner, parameters, reclaimPolicy
     3. dynamic-provisioning-in-practice
        description: Créer une SC, l'utiliser avec un PVC
     4. container-storage-interface
        description: CSI concept, plugins courants
10. tls-certificates

- description: PKI Kubernetes : créer, gérer et renouveler les certificats TLS.
- status: ready
- prerequisites: authentication
- topics: 5
  1.  tls-and-pki-basics
      description: Chiffrement asymétrique, CA, chaîne de confiance
  2.  tls-in-kubernetes
      description: Quels composants utilisent TLS, quels certificats
  3.  certificate-creation
      description: openssl, cfssl — générer des certs pour K8s
  4.  viewing-certificate-details
      description: Inspecter les certs existants, expiration
  5.  certificates-api
      description: CertificateSigningRequest, approbation, rotation

11. image-security

- description: Sécuriser l'approvisionnement des images container.
- status: ready
- prerequisites: pods
- topics: 3
  1.  image-naming-and-registries
      description: Registry privé, fully qualified image names
  2.  imagepullsecrets
      description: Créer et utiliser des secrets de registry
  3.  image-pull-policies
      description: Always, IfNotPresent, Never — impact

12. pod-security

- description: Pod Security Standards et Pod Security Admission.
- status: ready
- prerequisites: security-contexts, namespaces
- topics: 3
  1.  pod-security-standards
      description: Privileged, Baseline, Restricted — les 3 niveaux
  2.  pod-security-admission
      description: Labels de namespace, enforce/audit/warn
  3.  practical-enforcement
      description: Appliquer des standards à un namespace

13. cluster-installation

- description: Installer un cluster Kubernetes avec kubeadm.
- status: ready
- prerequisites: cluster-architecture-deep
- topics: 4
  1.  installation-options-overview
      description: Managed vs self-hosted, minikube/kind/kubeadm
  2.  kubeadm-master-node-setup
      description: kubeadm init, phases, CNI
  3.  kubeadm-worker-node-join
      description: kubeadm join, token, discovery
  4.  high-availability-considerations
      description: Multi-master, etcd topology, LB

14. cluster-maintenance

- description: Maintenir un cluster en production : upgrades, drain, eviction.
- status: ready
- prerequisites: cluster-installation
- topics: 5
  1.  os-upgrades-and-drain
      description: kubectl drain, cordon, uncordon
  2.  version-skew-policy
      description: Compatibilité entre composants
  3.  cluster-upgrade-process
      description: kubeadm upgrade plan/apply, worker upgrade
  4.  taint-based-evictions
      description: Eviction automatique, tolerationSeconds
  5.  version-skew-and-safe-upgrade-flow
      description: Extension 2026: version skew and safe upgrade flow.

15. backup-and-restore

- description: Sauvegarder et restaurer l'état du cluster via etcd.
- status: ready
- prerequisites: cluster-architecture-deep
- topics: 5
  1.  backup-strategies
      description: Ressources YAML vs etcd snapshot
  2.  etcd-backup-with-etcdctl
      description: ETCDCTL_API=3, snapshot save
  3.  restore-from-snapshot
      description: snapshot restore, reconfiguration
  4.  etcdutl
      description: Nouvel outil, migration depuis ETCDCTL
  5.  etcd-restore-drill-end-to-end
      description: Extension 2026: etcd restore drill end to end.

16. troubleshooting

- description: Diagnostiquer et résoudre les pannes application et cluster.
- status: ready
- prerequisites: logging-and-monitoring, services, deployments
- topics: 6
  1.  troubleshooting-application-failures
      description: CrashLoopBackOff, ImagePullBackOff, pending pods
  2.  troubleshooting-service-connectivity
      description: Endpoints manquants, DNS, network policies
  3.  troubleshooting-control-plane
      description: apiserver, etcd, scheduler, controller-manager down
  4.  troubleshooting-worker-nodes
      description: Node NotReady, kubelet, disk pressure
  5.  systematic-debugging-methodology
      description: Approche structurée, checklist de diagnostic
  6.  debug-distroless-with-kubectl-debug
      description: Extension 2026: debug distroless with kubectl debug.
