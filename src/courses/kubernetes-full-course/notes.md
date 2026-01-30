# Notes - Cours Kubernetes Complet

## Vue d'ensemble

**Cours complet Kubernetes** : 95 chapitres organisés en 11 parties progressives.

**Objectif** : Maîtriser Kubernetes de A à Z, des concepts de base aux fonctionnalités avancées.

**Profil cible** : Développeurs et opérateurs qui veulent une compréhension approfondie de Kubernetes pur (pas de Docker, Helm, etc.).

**Prérequis** : Avoir suivi le Cours 1 (Fondamentaux) ou avoir des bases solides.

## Structure du cours (95 chapitres)

### Partie 1 : Fondations et Architecture (10 chapitres)
Concepts de base, overview, namespaces, labels, annotations, opérations kubectl.

### Partie 2 : Architecture Interne (6 chapitres)
Control plane, nodes, API, controllers pattern, fonctionnement interne.

### Partie 3 : Containers et Pods (10 chapitres)
Images, environnement, lifecycle, multi-containers, init/sidecar, QoS.

### Partie 4 : Controllers de Workloads (12 chapitres)
ReplicaSets, Deployments, StatefulSets, DaemonSets, Jobs, CronJobs, PDBs.

### Partie 5 : Autoscaling (3 chapitres)
HPA (intro et avancé), VPA.

### Partie 6 : Networking et Services (12 chapitres)
Services, DNS, Ingress, Gateway API, Network Policies.

### Partie 7 : Storage (10 chapitres)
Volumes, PV/PVC, StorageClasses, CSI, snapshots.

### Partie 8 : Configuration (8 chapitres)
ConfigMaps, Secrets, resource management, probes.

### Partie 9 : Sécurité (10 chapitres)
RBAC, ServiceAccounts, Pod Security Standards, Linux security.

### Partie 10 : Policies et Administration (8 chapitres)
ResourceQuotas, LimitRanges, logging, observability, certificates.

### Partie 11 : Avancé - Extensions (6 chapitres)
CRDs, Operators, Admission Webhooks, API aggregation, kubectl plugins.

## Règles de conception

### Structure des leçons
- **Longueur** : 25-30 lignes maximum par leçon
- **Durée** : 3-5 minutes de lecture par leçon
- **Focus** : Un seul concept par leçon
- **Format** : Markdown simple, clair et direct
- **Progression** : Du plus simple au plus complexe
- **Estimation totale** : ~300-400 leçons = 20-30h de contenu

### Contenu pédagogique
- **Introduction** : 2-3 lignes maximum pour contextualiser
- **Concept principal** : Explication concise avec 1-2 exemples visuels si nécessaire
- **Points clés** : 3-5 points maximum en liste à puces
- **Pratique** : Environnements interactifs pour chaque chapitre
- **Quiz** : Optionnel, pour valider la compréhension

## Notes d'implémentation

- Format de nommage des fichiers : `XX-titre-court` (ex: `01-onboarding`)
- Ordre logique : Fondations → Architecture → Workloads → Networking → Storage → Config → Security → Ops → Extensions
- Chaque chapitre doit être autonome mais s'appuyer sur les précédentes
- Contenu en français et anglais
- Référence au master-plan.md pour la cohérence des chapitres

## Sujets exclus

- Docker/containers en détail (hors scope Kubernetes pur)
- Helm, Kustomize (outils externes)
- CNI/CSI development (trop avancé, parcours séparé possible)
- Windows-specific details (trop niche)
- API reference details (documentation de référence, pas cours)

