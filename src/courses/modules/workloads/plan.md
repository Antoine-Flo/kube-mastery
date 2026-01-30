# Plan du Module Workloads

## Chapitres

### 01-pods-intro
Introduction aux Pods : qu'est-ce qu'un Pod, anatomie de base, premier Pod, networking intra-pod.

### 02-pods-avance
Pods avancés : multi-containers, hostname/subdomain, resource sharing, patterns de communication.

### 03-pod-lifecycle
Cycle de vie des Pods : phases (Pending, Running, Succeeded, Failed), conditions, container states, restart policies, terminaison gracieuse.

### 04-init-containers
Containers d'initialisation : cas d'usage, ordre d'exécution, différences avec les containers applicatifs, patterns courants.

### 05-sidecar-containers
Pattern sidecar natif : sidecar containers restartables, différences avec init containers, cas d'usage (logging, proxy, etc.).

### 06-ephemeral-containers
Debugging avec containers éphémères : kubectl debug, inspection de pods en production, limitations.

### 07-pod-qos
Classes de qualité de service : Guaranteed, Burstable, BestEffort, impact sur le scheduling et l'éviction.

### 08-disruptions
Gestion des interruptions : disruptions volontaires vs involontaires, PodDisruptionBudgets, évictions.

### 09-downward-api
Exposition des métadonnées : injection d'informations du Pod/container via variables d'environnement et volumes.

### 10-replicasets
Maintien du nombre de réplicas : fonctionnement, relation avec Deployments, selectors, scaling.

### 11-deployments-intro
Introduction aux Deployments : concept, création d'un Deployment, relation avec ReplicaSets, scaling basique.

### 12-deployments-updates
Mises à jour de Deployments : rolling updates, modification d'image, kubectl rollout status.

### 13-deployments-avance
Deployments avancés : stratégies (RollingUpdate, Recreate), rollback, historique, pause/resume, maxSurge/maxUnavailable.

### 14-statefulsets-intro
Introduction aux StatefulSets : concept, identité stable des pods, nommage ordonné, cas d'usage.

### 15-statefulsets-avance
StatefulSets avancés : stockage persistant par pod, headless services, ordre de déploiement/suppression, updates.

### 16-daemonsets
Un pod par node : cas d'usage (logging, monitoring, networking), scheduling, tolerations, updates.

### 17-jobs-intro
Introduction aux Jobs : concept, job one-shot, complétion, gestion des échecs basique.

### 18-jobs-avance
Jobs avancés : parallélisme, completions multiples, backoff policy, indexed jobs, TTL.

### 19-cronjobs
Tâches planifiées : syntaxe cron, concurrency policy, historique, suspension.

### 20-autoscaling-hpa-intro
Introduction au HPA : concept, scaling basé sur CPU/mémoire, création d'un HPA basique.

### 21-autoscaling-hpa-avance
HPA avancé : métriques custom et external, multiple metrics, algorithme de scaling, behavior configuration.

### 22-autoscaling-vpa
Scaling vertical automatique : VerticalPodAutoscaler, recommandations, modes (Off, Initial, Auto).

### 23-workload-management
Gestion avancée : TTL after finished, workload placement, pod topology spread constraints.
