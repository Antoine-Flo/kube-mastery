# Kubernetes Simulation Drift

Écarts entre le vrai Kubernetes et notre simulation. À améliorer progressivement.

## Init Containers

| Aspect               | Vrai K8s                                                          | Notre simulation                 |
| -------------------- | ----------------------------------------------------------------- | -------------------------------- |
| Échec init container | Pod reste `Pending` + `CrashLoopBackOff` avec retry               | Pod passe directement à `Failed` |
| Container status     | Inclut `reason`, `message`, `exitCode`, `startedAt`, `finishedAt` | Seulement `state` et `ready`     |
| Restart policy       | Respecte `restartPolicy` du pod                                   | Pas de retry                     |
| Image pull           | Étape séparée avec `ImagePullBackOff` possible                    | Validation instantanée           |

## Pod Lifecycle

| Aspect                | Vrai K8s                                                                | Notre simulation                   |
| --------------------- | ----------------------------------------------------------------------- | ---------------------------------- |
| Phases intermédiaires | `Pending` → `ContainerCreating` → `Running`                             | `Pending` → `Running` direct       |
| Scheduling            | Passe par le scheduler, peut rester `Pending` (no resources)            | Pas de scheduling                  |
| Probes                | `livenessProbe`, `readinessProbe` affectent le status                   | Probes définies mais non exécutées |
| Termination           | `Terminating` state, graceful shutdown, `terminationGracePeriodSeconds` | Suppression instantanée            |

## Events

| Aspect       | Vrai K8s                                                  | Notre simulation                |
| ------------ | --------------------------------------------------------- | ------------------------------- |
| Event object | Ressource K8s à part entière (`kubectl get events`)       | Système interne pub/sub         |
| Retention    | TTL configurable, garbage collection                      | En mémoire, max 1000            |
| Types        | `Normal`, `Warning` avec `reason` et `message` structurés | Types custom (PodCreated, etc.) |

## Filesystem

| Aspect               | Vrai K8s                                        | Notre simulation                     |
| -------------------- | ----------------------------------------------- | ------------------------------------ |
| Isolation            | Chaque container a son propre filesystem        | Filesystem partagé simplifié         |
| Volumes              | `emptyDir` partagé entre containers du même pod | Non implémenté                       |
| Commandes supportées | Shell complet                                   | `touch`, `mkdir`, `echo >` seulement |

## Secrets & ConfigMaps

| Aspect        | Vrai K8s                                          | Notre simulation   |
| ------------- | ------------------------------------------------- | ------------------ |
| Montage       | Montés comme fichiers dans `/var/run/secrets/...` | Données en mémoire |
| Env injection | `envFrom`, `valueFrom` avec référence dynamique   | Non implémenté     |
| Updates       | Propagation automatique aux pods (avec délai)     | Pas de propagation |

## Réseau

| Aspect           | Vrai K8s                                                  | Notre simulation |
| ---------------- | --------------------------------------------------------- | ---------------- |
| Services         | ClusterIP, NodePort, LoadBalancer avec routing            | Non implémenté   |
| DNS              | CoreDNS, résolution `service.namespace.svc.cluster.local` | Non implémenté   |
| Network policies | Isolation réseau configurable                             | Non implémenté   |

## Ressources

| Aspect      | Vrai K8s                                          | Notre simulation                          |
| ----------- | ------------------------------------------------- | ----------------------------------------- |
| Deployments | Ressource stockée, gère ReplicaSets et rollouts   | Simulé (message only, pas de persistence) |
| Services    | Ressource stockée avec endpoints                  | Simulé (message only)                     |
| Namespaces  | Ressource stockée, isolation logique              | Simulé (message only)                     |
| Delete      | Cascade (supprimer ns → supprime pods/cm/secrets) | Pas de cascade                            |
| Finalizers  | Bloquent la suppression jusqu'à cleanup           | Non implémenté                            |

## kubectl exec

| Aspect           | Vrai K8s                           | Notre simulation                   |
| ---------------- | ---------------------------------- | ---------------------------------- |
| Shell interactif | PTY réel avec stdin/stdout         | Mode container simplifié           |
| Commandes        | Exécution réelle dans le container | Simulation limitée (env, ls, etc.) |

## À implémenter (priorité)

1. [ ] Container status détaillé (reason, exitCode)
2. [ ] Phase `ContainerCreating` 
3. [ ] Retry sur échec init container
4. [ ] Exécution des probes (simulation)
5. [ ] Montage volumes `emptyDir`
