# Roadmap - Kube Mastery

**Stack** : Astro 5, Cloudflare. Détails : `architecture.md`.

## Current Status

**Phase 1 MVP Complete** ✅ — Tests à migrer (Vitest, objectif ~94% coverage).

> Pour les détails de ce qui est implémenté, voir `spec.md` et `architecture.md`

## Business Model

- **Bêta** : Tout gratuit
- **Après bêta** : Quelques leçons gratuites pour découvrir, reste payant
- **Revenus** : Accès payant one-time via Paddle, voir `marketing.md`

## 🔥 À faire maintenant

### Sécurité & Nettoyage

- [ ] **Nettoyer le code** : Supprimer dead code, commentaires obsolètes

### Améliorations Nodes (Post-MVP)

**État actuel** : MVP complète (modèle, CRUD, `kubectl get nodes`, tests conformance). Score de complétude : ~60%.

**Recommandations prioritaires** :
- [ ] **Événements Node** (Priorité 1 - 2-3h) : Créer `NodeCreatedEvent`, `NodeUpdatedEvent`, `NodeDeletedEvent` + handlers pour cohérence architecturale. Actuellement : placeholders (`createSecretCreatedEvent`)
- [ ] **kubectl describe node** (Priorité 2 - 1-2h) : Implémenter la commande `kubectl describe node <name>` - **Note** : Mentionné dans Sprint 10
- [ ] **Conditions dynamiques** (Priorité 3 - 3-4h) : Système de heartbeat simulé pour mettre à jour les conditions (Ready, MemoryPressure, etc.). Actuellement : conditions statiques dans le seed
- [ ] **kubectl label/annotate/taint node** (Priorité 4 - 2-3h) : Commandes de gestion des nodes - **Note** : `label` et `annotate` existent pour pods/configmaps/secrets, extension nécessaire pour nodes
- [ ] **kubectl cordon/uncordon/drain** (Priorité 4) : Commandes pour gérer la schedulabilité des nodes

**Notes** :
- Les nodes sont actuellement créés statiquement depuis YAML (vs kubelet qui s'enregistre dans Kubernetes réel)
- Pas de node controller pour gérer le lifecycle
- Pas de logique de scheduling basée sur les nodes (taints, tolerations, node conditions)

### Scheduler (Post-MVP)

- ✅ **Scheduler basique** : Assigner automatiquement `spec.nodeName` aux pods créés sans node. Algorithme round-robin sur les worker nodes disponibles (Ready, pas unschedulable). Écoute les événements PodCreated et assigne les pods automatiquement.
- [ ] **Pods système sur control-plane** : CoreDNS, kube-proxy → control-plane automatiquement (basé sur namespace kube-system ou labels)
- [ ] **Taints & Tolerations** (Phase 4) : Respecter les taints des nodes et tolerations des pods (note : vérification simplifiée actuellement)
- [ ] **Node Affinity** (Phase 4) : Respecter les règles d'affinité/anti-affinité

## 🚀 Phase 2: Advanced Kubernetes (Sprints 7-14)

### ✅ Sprint 7: Multi-Container Pods & Init Containers (COMPLETED)
- ⏳ Shared volumes (emptyDir) - DEFERRED to Sprint 8

### Sprint 8: Storage (PV/PVC) & StatefulSets
- PersistentVolume and PersistentVolumeClaim
- Binding logic (match PV to PVC)
- StorageClasses and dynamic volume provisioning
- Volume types, access modes (ReadWriteOnce, ReadOnlyMany, ReadWriteMany)
- Reclaim policies (Retain, Recycle, Delete)
- StatefulSets with ordered pods
- Stable network identities

### Sprint 9: Workloads - Jobs, CronJobs, DaemonSets
- Jobs with completions tracking
- CronJobs with schedule parsing
- DaemonSets (one pod per node)

### Sprint 10: kubectl Advanced Commands & Troubleshooting
- [ ] kubectl rollout (status, history, undo, pause/resume)
- [ ] kubectl port-forward (simulation)
- [ ] kubectl top (CPU/memory metrics)
- [ ] kubectl config (contexts, kubeconfig)
- [ ] kubectl get events (CRITIQUE pour CKA - 30% troubleshooting)
- [ ] Multi-resource support (e.g., `kubectl get pods,services`)
- [ ] Rolling updates and rollbacks fonctionnels (Deployments)
- [ ] **kubectl describe node** (amélioration Nodes - voir "À faire maintenant")

### Sprint 11: Security & Networking (CKA Critical - 20%)
- [ ] RBAC (Roles, ClusterRoles, Bindings)
- [ ] kubectl auth can-i
- [x] Services fonctionnels (ClusterIP, NodePort, LoadBalancer, ExternalName) - **✅ Implémenté** : Modèle, ClusterState, kubectl get, apply/create, événements, parsing YAML
- [ ] Service Endpoints (gestion automatique, `kubectl get endpoints`)
- [ ] Ingress with routing rules
- [ ] NetworkPolicies
- [ ] CoreDNS (compréhension et simulation de base)

### Sprint 12: Autoscaling & Resource Quotas
- HorizontalPodAutoscaler (HPA)
- ResourceQuotas per namespace
- LimitRanges with defaults

### Sprint 13: Terminal Enhancements & Documentation
- Syntax highlighting (real-time)
- Enhanced prompt (contextual)
- **Page Documentation utilisateur**
  - Chapitres : Terminal, kubectl, Filesystem, Cluster, etc.
  - Tooltips avec "?" dans l'app
  - Liens "En savoir plus" vers la doc (ancres)
  - Accessible depuis le menu

### Sprint 13b: CKA Cluster Architecture Lessons (CRITIQUE - 25%)
- **Leçons théoriques détaillées** :
  - Installation avec kubeadm (théorie + commandes)
  - Préparation infrastructure pour cluster Kubernetes
  - Création et gestion de clusters avec kubeadm
  - Gestion du cycle de vie des clusters (upgrade, maintenance)
  - Configuration d'un control plane hautement disponible (HA)
  - Sauvegarde et restauration d'etcd (théorie + commandes)
  - Helm et Kustomize pour installer composants du cluster
  - Interfaces d'extension (CNI, CSI, CRI) - compréhension théorique
  - CRDs et opérateurs (installation et configuration)
- **Exercices pratiques** : Commandes kubeadm, etcd backup/restore
- **Note** : Focus sur la théorie et les commandes dans le simulateur

### Sprint 14: Real Registry + Chaos Hooks
- Fetch from Docker Hub API
- Fallback to hardcoded registry
- Chaos infrastructure in models

## Phase 3: Learning Platform

### Sprint 15: Chaos Engineering & Troubleshooting Scenarios (CKA Critical - 30%)
- Chaos GUI panel
- **Scénarios de troubleshooting CKA** :
  - Pods en CrashLoopBackOff (diagnostic et résolution)
  - ImagePullBackOff (diagnostic et résolution)
  - NetworkFailure (connectivité inter-pods)
  - OOM (Out of Memory) errors
  - Pods en Pending (ressources insuffisantes, node affinity)
  - Services non accessibles (endpoints, selectors)
- Custom scenario builder
- Scheduler (immediate or delayed)
- **Leçons sur troubleshooting** :
  - Troubleshooting des composants du cluster (kubelet, kube-proxy, etcd, API server)
  - Troubleshooting des nœuds (node status, node conditions)
  - Analyse des logs du cluster (journalctl, logs des composants)
  - Surveillance avancée des applications (metrics, probes détaillées)
  - Troubleshooting réseau avancé (CoreDNS, CNI plugins)
- **Note** : Conditions dynamiques des nodes (voir "À faire maintenant") amélioreront le réalisme des scénarios de troubleshooting

### Sprint 16: Challenges System
- Pre-configured challenge scenarios
- Automatic validation
- Progressive hints (3-5 per challenge)
- Challenge UI with objectives panel

### Sprint 17: Lessons System & CKA Preparation
- [ ] Lessons: Storage, Troubleshooting
- **Leçons CKA spécifiques** :
  - [ ] Troubleshooting approfondi (composants cluster, nœuds, réseau)
  - [ ] Cluster Architecture (kubeadm, etcd, HA) - théorie détaillée
  - [ ] Networking avancé (CoreDNS, Ingress, NetworkPolicies)
  - [ ] Storage (PV/PVC, StorageClasses, access modes)
- [ ] Progress tracking (stockage Supabase déféré)
- [ ] **Exercices pratiques de debugging CKA** : Scénarios similaires à l'examen

### ✅ Sprint 17b: Courses System (COMPLETED)
- ⏳ **Cours en MDX** : (Déféré - approche déclarative actuelle suffit pour MVP)
- ⏳ **Stockage Supabase** : (Déféré - pas nécessaire pour MVP, localStorage suffit)

### Sprint 17c: Spaced Repetition System (Cartes de révisions)
- **Algorithme** : FSRS via [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
- **Source des cartes** : Hybride (deck Kubernetes de base + génération auto depuis quiz)
- **Stockage** : Supabase (tables flashcards, flashcard_reviews)
- **Affichage** :
  - Dashboard : Section "Révisions du jour" avec stats
  - Avant leçon : Rappel contextuel (3-5 cartes du chapitre)
- **UI** : Page dédiée `/flashcards` pour sessions de révision
- **Priorités** :
  1. MVP : Deck K8s de base + révision manuelle
  2. V2 : Génération auto depuis quiz complétés
  3. V3 : Stats avancées, rappels, gamification
- Voir `doc/spaced-repetition-cards.md` pour l'architecture détaillée

### Sprint 19: Layout Manager & Integration
- Mode switcher: Terminal Only, Learning, Challenge
- Responsive layouts
- Gamification (optional): Achievements, XP, badges

### Sprint 20: Polish & Documentation
- UI polish (animations, loading, empty states)
- User guide and onboarding
- Coverage >85%
- E2E tests

## Phase 4: B2B & Monetization

### Sprint 21: Certification Badge (optionnel)
- Examen chronométré dans le simulateur
- Badge vérifiable (lien unique)
- Intégration LinkedIn
- Prix : 10-20€

### Sprint 22: Dashboard Centres de Formation
- Gestion des classes/groupes
- Suivi progression étudiants
- Export des résultats
- Exercices assignables

### Sprint 23: Abonnements B2B
- Plans Starter/Pro/Enterprise
- SSO pour entreprises
- Facturation récurrente
- Support dédié

### Sprint 24: Advanced Features
- Multi-node simulation (3-5 nodes)
- Taints & tolerations
- Node affinity/anti-affinity
- kubectl drain/cordon
- **Note** : Certaines fonctionnalités nodes (kubectl label/annotate/taint, cordon/uncordon) peuvent être implémentées plus tôt (voir "À faire maintenant")

### Sprint 25: CoreDNS & Service Discovery (CKA - 20%)
- DNS resolver simulation
- nslookup/dig in kubectl exec
- Service discovery patterns
- CoreDNS configuration et troubleshooting
- Résolution DNS inter-pods (`service.namespace.svc.cluster.local`)

### Sprint 26: Advanced Differentiators
- Scenario recording/replay
- Time-travel debugging (undo/redo)
- YAML diff viewer
- Collaborative mode (share via URL)

## CKA Preparation Coverage

**Objectif** : Préparer efficacement à la certification CKA (Certified Kubernetes Administrator)

### Couverture par domaine CKA

| Domaine                    | Poids | Sprints concernés | Statut     |
| -------------------------- | ----- | ----------------- | ---------- |
| **Troubleshooting**        | 30%   | 10, 15, 17        | 🔴 CRITIQUE |
| **Cluster Architecture**   | 25%   | 13b, 17           | 🔴 CRITIQUE |
| **Servicing & Networking** | 20%   | 11, 17, 25        | 🟠 Haute    |
| **Workloads & Scheduling** | 15%   | 8, 9, 10, 12      | 🟡 Moyenne  |
| **Storage**                | 10%   | 8                 | 🟡 Moyenne  |

### Éléments critiques ajoutés

1. **Sprint 10** : `kubectl get events` (troubleshooting)
2. **Sprint 11** : Services fonctionnels, Endpoints, CoreDNS
3. **Sprint 13b** : Leçons Cluster Architecture (kubeadm, etcd, HA)
4. **Sprint 15** : Scénarios de troubleshooting CKA
5. **Sprint 17** : Leçons CKA spécifiques
6. **Sprint 25** : CoreDNS avancé

### Focus immédiat pour CKA

- **55% de l'examen** = Troubleshooting (30%) + Cluster Architecture (25%)
- **Priorité** : Sprints 10, 13b, 15, 17

Voir `doc/cka-coverage.md` pour le détail complet de la couverture CKA.

## Summary

| Phase             | Sprints        | Focus                                      | Priority |
| ----------------- | -------------- | ------------------------------------------ | -------- |
| **MVP (Phase 1)** | 1-6            | Core features (Terminal, kubectl, Storage) | ⭐⭐⭐      |
| **Phase 2**       | 7-14           | Advanced K8s resources + CKA prep          | ⭐⭐⭐      |
| **Phase 3**       | 15-20          | Learning platform + CKA prep               | ⭐⭐⭐      |
| **Phase 4**       | 21-26          | B2B & Monetization                         | ⭐        |
| **TOTAL**         | **26 sprints** | Full K8s learning platform + CKA ready     | -        |

## Must-Have Features

Pour rivaliser avec KodeKloud/Killer.sh:
- ✅ Phase 1: Terminal complet, kubectl core, Filesystem, Persistence
- 🎯 Phase 2 (Sprint 7-14): Multi-container, Init containers, Nodes, ReplicaSets, Deployments, kubectl scale, [ ] PV/PVC, [ ] Jobs, [ ] kubectl avancé (rollout, events, port-forward), **CKA prep**
- 🎯 Phase 3 (Sprint 15-20): [ ] Chaos engineering, [ ] Challenges, Lessons (partiel), [ ] **CKA scenarios**

### CKA Preparation Features

- ✅ Terminal complet (comme l'examen CKA)
- [ ] Troubleshooting scenarios (Sprint 15)
- [ ] Cluster Architecture lessons (Sprint 13b)
- [ ] Scénarios d'examen similaires (Sprint 17)

## Unique Differentiators

- **Prix abordables** (vs concurrence plus chère)
- Chaos Engineering GUI avec scenarios configurables
- Simulateur local ultra-rapide (pas de latence réseau)

## References

- See `spec.md` for feature details
- See `architecture.md` for technical structure
- See `conventions.md` for coding standards
- See `marketing.md` for business model
