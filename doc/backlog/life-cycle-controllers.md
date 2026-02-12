# Lifecycle controllers — architecture et mise en place

Document de conception pour les contrôleurs de cycle de vie dans le simulateur, alignés sur le modèle Kubernetes (controllers, kubelet, events, status) et ouverts à un usage pédagogique avancé.

---

## 1. Objectifs

- **Cycle de vie réaliste** : remplacer createPodStartupSimulator, les ressources (Pods en premier) passent par Pending, puis après un délai et des vérifications → Running ou un état d’erreur (ImagePullBackOff, CrashLoopBackOff, Unschedulable, etc.).
- **Architecture proche de Kubernetes** : un composant par “responsabilité” (Scheduler, KubeletSimulator, puis éventuellement d’autres controllers de lifecycle), chacun met à jour le **status** via des **events**, sans moteur state-machine générique unique.
- **Pédagogie** : permettre plus tard d’expliquer les controllers, d’afficher des outputs réalistes (`kubectl get/describe/events`), et à terme d’envisager des exercices “comprendre / écrire un controller”.

---

## 2. Rappel : comment Kubernetes gère le cycle de vie

- **Controllers** : boucle watch → reconcile → update **status**. Chaque type de ressource a un ou plusieurs controllers (Deployment, ReplicaSet, Scheduler, Kubelet, etc.).
- **Pods** :
  - **Scheduler** : assigne `spec.nodeName` (pod reste Pending).
  - **Kubelet** (sur le nœud) : pull image, start containers, met à jour `status.phase`, `status.containerStatuses`, `status.conditions` ; en cas d’échec → ImagePullBackOff, CrashLoopBackOff, etc.
- **Events** : les composants émettent des Events (Scheduled, Pulling, Started, Failed) visibles via `kubectl get events` et dans `describe`.
- Pas de “moteur de lifecycle” unique : chaque controller a sa logique et écrit le status de ses ressources.

---

## 3. Mapping Kubernetes → simulateur

| Kubernetes           | Simulateur actuel / cible                                      |
|----------------------|-----------------------------------------------------------------|
| DeploymentController | `DeploymentController` (exist.) → ReplicaSets                  |
| ReplicaSetController | `ReplicaSetController` (exist.) → Pods (Pending)                |
| Scheduler            | `Scheduler` (exist.) → assigne `nodeName`, ne touche pas phase |
| Kubelet              | **KubeletSimulator** (à formaliser) → Pending → Running / Error |
| Events API           | Events cluster (PodUpdated, etc.) + **EventList** pour `get events` |
| status.conditions    | À renforcer sur Pod (et autres si besoin)                      |

Le **KubeletSimulator** est le “controller” qui gère le cycle de vie des Pods après la pose de `nodeName` : délai (pull/start), évaluation des conditions d’erreur, mise à jour du status.

---

## 4. Architecture proposée

### 4.1 Principe

- **Un “controller” de lifecycle par type de ressource** concerné (Pod aujourd’hui, éventuellement Job, PVC, etc.).
- Chaque controller :
  - **Watch** : s’abonne aux events pertinents (ex. PodCreated, PodUpdated).
  - **Reconcile** : pour chaque ressource “à traiter” (ex. Pod Pending avec `nodeName`), planifie une transition (délai), puis à l’échéance évalue les conditions d’erreur et met à jour le status (Running ou Failed/raison).
- **Pas de state machine générique** : la logique “phases possibles” et “conditions d’erreur” vit dans le controller (ou un descriptor dédié) de ce type de ressource.
- **Injection du délai** : configurable (ex. `startupDelayMs`) pour l’app (délai réel) et la conformance (0 = immédiat ou désactivé).

### 4.2 KubeletSimulator (controller Pod lifecycle)

Responsabilités :

1. **Entrée** : Pod avec `status.phase === 'Pending'` (créé par ReplicaSet ou chargé en seed), avec ou sans `spec.nodeName`.
2. **Comportement** :
   - Si pas de `nodeName` : ne rien faire (le Scheduler s’en charge).
   - Si `nodeName` présent : planifier une “réconciliation” après un délai (aléatoire ou 0).
3. **À l’échéance** :
   - **Évaluer les conditions d’erreur** (voir 4.3) :
     - nodeSelector ne matche aucun nœud → rester Pending ou Failed avec raison.
     - Image absente / non pullable → ImagePullBackOff (containerStatuses).
     - Container qui crash (exit != 0) → CrashLoopBackOff, etc.
   - Si erreur : mettre à jour le Pod (phase / containerStatuses / conditions) et émettre PodUpdated (+ Event si on introduit EventList).
   - Sinon : transition vers Running (phase + containerStatuses ready).
4. **Sortie** : émission de **PodUpdated** avec le nouveau Pod (état cohérent pour `kubectl get/describe`).

Le composant actuel `PodStartupSimulator` peut être renommé et étendu en **KubeletSimulator** : même pattern (subscribe, schedule, emit PodUpdated), avec en plus l’évaluation des conditions d’erreur et, si on l’ajoute, l’émission d’events “Scheduled”, “Pulling”, “Started”, “Failed”.

### 4.3 Conditions d’erreur Pod (KubeletSimulator)

À implémenter de façon centralisée dans le KubeletSimulator (ou un `PodLifecycleDescriptor` utilisé par lui) :

- **Unschedulable** : `spec.nodeName` absent et aucun nœud ne matche (nodeSelector, taints). Le Scheduler ne pose pas `nodeName` → le pod reste Pending ; on peut exposer une condition ou un event.
- **NodeSelector / affinity** : si `nodeName` est posé mais le nœud ne matche plus (ou pour les pods sans nodeName) → Pending avec raison ou event.
- **ImagePullBackOff** : image inconnue ou marquée “pull error” (ex. via registry simulé ou liste d’images connues) → `containerStatuses[].state.waiting.reason: ImagePullBackOff`, phase peut rester Pending.
- **CrashLoopBackOff** : container avec `restartPolicy` et exit code != 0 (déjà partiellement modélisé dans les seeds) → `containerStatuses[].state.waiting.reason: CrashLoopBackOff`, phase Running avec container non ready.
- **Running** : aucune condition d’erreur → phase Running, containerStatuses ready.

Les détails (champs exacts, conditions dans `status.conditions`) peuvent suivre la doc K8s pour rester alignés avec `kubectl describe` et les cours.

### 4.4 Events (optionnel mais utile pour la pédagogie)

- **Aujourd’hui** : seuls les events “métier” (PodCreated, PodUpdated, …) existent ; ils ne sont pas exposés comme `kubectl get events`.
- **Évolution** : introduire un **EventList** (objet K8s-like) alimenté par les controllers :
  - Scheduler : “Scheduled” (pod, node).
  - KubeletSimulator : “Pulling”, “Pulled”, “Started”, “Failed” (avec reason/message).
- **kubectl get events** : afficher les entrées de cet EventList (tri, format table).
- **kubectl describe pod** : section “Events” remplie à partir du même EventList.

Cela permet des scénarios “voir ce que le Scheduler et le Kubelet ont fait” sans changer le cœur des controllers.

### 4.5 Interface commune (optionnelle)

Pour garder un pattern homogène et préparer d’autres types (Job, PVC) :

- **LifecycleController** : `start()`, `stop()`, et soit une boucle interne (subscribe + schedule), soit une méthode `reconcile(key)` si on veut partager une WorkQueue plus tard.
- Chaque implémentation (KubeletSimulator, puis éventuellement JobController, PVCController) :
  - lit le state via `ControllerState` (ou équivalent),
  - émet des updates via les events existants (PodUpdated, etc.),
  - respecte le même schéma : watch → délai/config → évaluation erreur → update status.

On peut rester léger : pas obligatoire d’introduire une interface formelle tout de suite ; l’important est que le **comportement** soit “un controller par type de ressource avec lifecycle”.

### 4.6 Intégration dans l’existant

- **EmulatedEnvironmentManager** : après `initializeScheduler`, créer et démarrer le **KubeletSimulator** (comme aujourd’hui PodStartupSimulator), avec `startupDelayMs` configurable.
- **Conformance** : pas d’appel “forcer tous les Pending → Running”. Soit le KubeletSimulator est lancé avec `startupDelayMs: 0` et traite les pods immédiatement, soit les scénarios de conformance acceptent des pods Pending (normalizer ou critères de succès adaptés).
- **Seeds (loader)** : continuer à créer des Pods en Pending ; le KubeletSimulator les fera évoluer en Running ou erreur selon les règles ci-dessus.
- **Seeds statiques (demo, minimal, intro)** : selon la pédagogie, soit on les laisse en Running pour des démos “tout de suite prêt”, soit on les passe en Pending et on laisse le KubeletSimulator les faire passer en Running après délai.

---

## 5. Structure de fichiers proposée

```
src/core/cluster/
├── controllers/
│   ├── DeploymentController.ts   # existant
│   ├── ReplicaSetController.ts  # existant
│   ├── initializers.ts          # ajouter init KubeletSimulator
│   └── types.ts                 # existant (ControllerState, Controller)
├── scheduler/
│   └── Scheduler.ts             # existant (pose nodeName uniquement)
├── lifecycle/
│   ├── KubeletSimulator.ts      # nouveau (ex-PodStartupSimulator étendu)
│   ├── podLifecycle.ts          # optionnel : conditions d’erreur Pod (eval)
│   └── types.ts                 # optionnel : LifecycleController, etc.
├── events/
│   ├── EventBus.ts
│   ├── types.ts
│   └── eventList.ts             # optionnel : EventList pour get events
└── podStartupSimulator.ts       # à migrer / renommer vers lifecycle/KubeletSimulator
```

- **lifecycle/** : regrouper les composants “cycle de vie” (KubeletSimulator + éventuels descriptors ou helpers).
- **eventList.ts** : seulement si on introduit `kubectl get events` et la section Events de `describe`.

---

## 6. Phases d’implémentation

### Phase 1 — KubeletSimulator (cycle de vie Pod)

- Renommer / déplacer `PodStartupSimulator` en **KubeletSimulator** dans `lifecycle/`.
- Garder le comportement actuel : Pending + `nodeName` → après délai → Running.
- Ajouter l’**évaluation des conditions d’erreur** Pod :
  - Image inconnue / pull error → ImagePullBackOff.
  - nodeSelector sans nœud correspondant → laisser Pending (ou Unschedulable) ; le Scheduler ne pose pas `nodeName`, donc le Kubelet ne “reçoit” que les pods déjà schedulés.
  - Container en crash (déjà présent dans les seeds) → s’assurer que le status affiche CrashLoopBackOff.
- Documenter la source des events (ex. `metadata.source: 'kubelet-simulator'`) pour `describe` / debug.
- Tester en app (délai visible) et en conformance (délai 0 ou scénarios adaptés).

### Phase 2 — Events et kubectl

- Introduire un **EventList** (objet en mémoire) alimenté par Scheduler et KubeletSimulator (Scheduled, Pulling, Started, Failed).
- Implémenter **kubectl get events** (et optionnellement **kubectl get events -w**) à partir de cet EventList.
- Remplir la section **Events** de **kubectl describe pod** à partir du même EventList.
- Vérifier que les messages et reasons sont cohérents avec Kubernetes (docs K8s).

### Phase 3 — Pédagogie et robustesse

- Leçons “Troubleshooting” : pods Pending, ImagePullBackOff, CrashLoopBackOff ; utiliser `get`, `describe`, `events`.
- Option “debug” ou “vue controllers” : afficher les dernières actions du Scheduler / KubeletSimulator (ex. liste d’events ou log simplifié).
- Ajuster les seeds (YAML et statiques) pour couvrir les cas d’erreur et les scénarios de cours.

### Phase 4 (future) — Autres ressources et custom controllers

- Si besoin : **Job** (Pending → Running → Succeeded/Failed) avec un petit JobController de lifecycle.
- **PVC** : Pending → Bound (ou Failed) via un VolumeController simplifié.
- **Pédagogie avancée** : interface “custom controller” (watch une ressource, exécuter une fonction reconcile) pour des exercices “écrire un controller” sans modifier le cœur du sim.

---

## 7. Intérêt pédagogique (résumé)

- **Comportement réaliste** : STATUS et describe cohérents avec un vrai cluster (Pending, Running, ImagePullBackOff, CrashLoopBackOff, Unschedulable).
- **Comprendre les controllers** : Scheduler vs Kubelet, qui fait quoi ; events pour “voir” les actions.
- **Troubleshooting** : scénarios guidés avec `get`, `describe`, `events`.
- **Évolutivité** : même pattern pour d’autres types de ressources et, plus tard, pour des exercices “custom controller”.

---

## 8. Références

- Architecture projet : `doc/context/architecture.md`
- Controllers existants : `src/core/cluster/controllers/` (DeploymentController, ReplicaSetController, types Controller / ControllerState)
- Scheduler : `src/core/cluster/scheduler/Scheduler.ts`
- Pod lifecycle actuel : `src/core/cluster/podStartupSimulator.ts`
- Events cluster : `src/core/cluster/events/types.ts`
- Kubernetes : [Pod lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/), [Events](https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/event-v1/), [Container states](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-states)
