# Migration Kubernetes-like, état actuel

Date: 2026-03-13

## Résumé exécutif

La migration vers la nouvelle architecture est bien engagée, mais elle n est pas terminée à 100%.
La base est désormais clairement orientée Kubernetes-like, avec une séparation par couches et une meilleure fidélité sur les états Pod, le runtime, le kubelet simulé, et le rendu `kubectl`.

## Ce qui est déjà migré

- Architecture posée par domaines:
  - `src/core/api`
  - `src/core/etcd`
  - `src/core/control-plane`
  - `src/core/kubelet`
  - `src/core/runtime`
- Façade API unifiée:
  - `ApiServerFacade` centralise l accès à l état cluster, au bus d events, au watch hub, et au `resourceVersion`
  - émission d événements centralisée via `apiServer.emitEvent(...)` pour les contrôleurs API-first
  - exposition API stabilisée via `findResource`, `listResources`, `createResource`, `updateResource`, `deleteResource`, `snapshotState`, `emitEvent`
  - `PodLifecycleEventStore` lit le journal d événements etcd-like (cache par révision) au lieu de s abonner directement au bus
  - ajout d opérations CRUD façade explicites, `findResource(kind,...)`, `listResources(kind,...)`, `deleteResource(kind,...)`
  - extension CRUD façade avec `createResource(kind,...)` et `updateResource(kind,...)`
  - ajout `snapshotState()` pour la lecture snapshot via façade, sans accès direct à l ancien champ public d état
  - suppression finale de `getClusterState()` de `ApiServerFacade`, plus de lecture legacy exposée
- Store etcd-like versionné:
  - révision incrémentale, exposition `getResourceVersion()`, snapshots versionnés
  - écriture d événements via `appendEvent(...)`
  - journal d événements enrichi (`revision`, `resourceVersion`, `eventType`, `timestamp`, `source`, `event`)
- Runtime et kubelet simulés:
  - `ContainerRuntimeSimulator` fonctionnel
  - `KubeletNodeManager` fonctionnel
  - sync du `containerRuntimeVersion` côté Node
  - `PodLifecycleController` construit désormais sur `ApiServerFacade` (plus de signature `eventBus + getState`)
- Statut conteneur aligné:
  - passage à `stateDetails` et `lastStateDetails`
  - meilleure fidélité des champs `State`, `Last State`, `Reason`, `Exit Code`, timestamps
- `kubectl` amélioré:
  - `get -o json|yaml` avec `resourceVersion` branché
  - `describe pod` alimenté par events lifecycle persistés côté API
  - events supportés: `Scheduled`, `Pulled`, `Created`, `Started`, `Killing`, `Failed`, `BackOff`, `FailedMount`, `Completed`
  - cutover API-first déjà effectué pour `get`, `describe`, `delete`, `scale`, `apply`, `create`, `run`, `expose`, `label`, `annotate`, `config`, `diff`, `cluster-info`, `logs`, `exec`
  - `metadataHelpers` (noyau `label`/`annotate`) passe aussi en entrée `ApiServerFacade` directe, suppression du retour `state` legacy
  - `resourceHelpers` (noyau `apply/create`) passe en entrée `ApiServerFacade` directe, utilisé aussi par `apply`, `create`, `run`, `expose`, `diff` dry-run merge, et le loader de seeds
  - `delete`, `scale` et `config set-context` n utilisent plus de signatures internes basées sur `ClusterState/EventBus`, les helpers passent désormais par `ApiServerFacade`
  - cutover écriture kubectl vers API events, `resourceHelpers`, `delete`, `scale`, `metadataHelpers` n émettent plus directement via `eventBus`, utilisent `apiServer.emitEvent(...)`
  - dans ces handlers, lecture state via `apiServer.findResource(...)`, `apiServer.listResources(...)` et `apiServer.snapshotState()`
  - `delete` et `scale` utilisent désormais les opérations façade `findResource/deleteResource/listResources` pour réduire les appels directs `clusterState`
  - `resourceHelpers` (`apply/create`) délègue maintenant les écritures à `apiServer.createResource(...)` et `apiServer.updateResource(...)`
  - `diff` dry-run n injecte plus de snapshot par `loadState`, le seed passe désormais par API CRUD sur un `ApiServerFacade` isolé
  - `metadataHelpers` lit la ressource cible via `apiServer.findResource(...)`, plus de scan manuel du snapshot
  - `expose` lit le `Deployment` via `apiServer.findResource(...)` au lieu d un accès direct `ClusterState`
  - suppression des casts `as any` dans `resourceHelpers` et `diff` côté handlers kubectl
  - `cluster-viewer-mount` lit désormais `Pod`, `ReplicaSet`, `Node`, `Namespace` via `apiServer.listResources(...)`
  - `configKubeconfig` écrit via `apiServer.findResource(...)` + `apiServer.updateResource(...)`, suppression de la mutation directe `updateConfigMap(...)`
  - suppression des accès directs au champ public legacy d état dans `src/core`, usage API uniquement (`find/list/snapshot`)
  - simplification `resourceHelpers`, suppression du mapping legacy `emit/direct` par kind, résolution via opérations CRUD façade
  - alignement tests handlers, suppression des wrappers legacy dans `delete.test.ts`, `scale.test.ts`, `clusterInfoDump.test.ts`, appels directs `apiServer`
  - nettoyage supplémentaire des tests handlers, suppression des alias de wrappers `WithApi`, appels directs `handleDelete(apiServer, ...)` et `handleScale(apiServer, ...)`
- Dispatch cluster events rationalisé:
  - le reducer `ClusterEvent -> ClusterStateData` est centralisé dans `src/core/cluster/events/handlers.ts`
  - `ClusterState` délègue ce dispatch au module `events/handlers` au lieu de dupliquer sa table locale
  - suppression du `any` sur le paramètre `event` de dispatch, remplacement par un mapping typé discriminé `ClusterEvent['type'] -> handler`
- Initialisation runtime/control-plane en API-first:
  - `initializeSimNetworkRuntime`, `initializeSimVolumeRuntime`, `initializeSimPodIpAllocation` prennent `ApiServerFacade` en entrée
  - `initializeControlPlane` et `startControlPlaneRuntime` prennent aussi `ApiServerFacade` en entrée
  - `initializeControlPlane` branche le `PodLifecycleController` via `ApiServerFacade` directement
  - `SchedulerController` migre vers une construction `ApiServerFacade` directe, et l initializer control-plane ne passe plus de couple `eventBus/getState`
  - `DeploymentController`, `ReplicaSetController`, `DaemonSetController` migrent sur des factories API-first `create*Controller(apiServer, ...)`
  - `initializeControlPlane` appelle désormais toutes les factories control-plane en `apiServer` direct, suppression du montage local `eventBus/getState` dans l initializer
  - suppression des constructeurs legacy control-plane `new XController(eventBus, getState, ...)`, les classes utilisent maintenant `new XController(apiServer, ...)`
  - suppression des `this.eventBus.emit(...)` directs dans les contrôleurs control-plane et kubelet migrés, remplacement par `apiServer.emitEvent(...)`
  - lot suivant, les contrôleurs `DeploymentController`, `ReplicaSetController`, `DaemonSetController` et `SchedulerController` utilisent maintenant CRUD façade (`createResource/updateResource/deleteResource`) pour les mutations de ressources
  - `ControllerManager`, `NetworkController`, `VolumeBindingController` et `SimPodIpAllocationService` écrivent aussi via façade API, plus de mutation directe `clusterState` ou `eventBus.emit(...)` dans ces flux
  - `ControllerManager` lit la liste des nodes via `apiServer.listResources('Node')` pour initialiser kubelet
  - `NetworkController` lit `Pod` et `Service` via `apiServer.listResources(...)`
  - `VolumeBindingController` lit `PersistentVolume` et `PersistentVolumeClaim` via `listResources/findResource`
  - `PodVolumeController` lit `Pod`, `PersistentVolumeClaim` et `PersistentVolume` via façade API
  - auto-save environnement lit l état via `apiServer.snapshotState()`
  - `DeploymentController`, `ReplicaSetController`, `DaemonSetController` et `SchedulerController` lisent désormais via un adaptateur `ControllerState` construit depuis `ApiServerFacade`
  - `PodLifecycleController` lit aussi via cet adaptateur `ControllerState` API-first
  - `TerminalManager` autocomplete est alimenté via `apiServer.listResources(...)`
  - `ClusterState` expose désormais un CRUD générique `createByKind/updateByKind/deleteByKind`, utilisé pour réduire les chemins de mutation spécifiques
  - contrôleurs control-plane et kubelet migrés pour ne plus lire directement les champs publics legacy, usage des méthodes façade
  - `runner-executor` branché sur cette signature, sans variable intermédiaire legacy `eventBus`
- Bootstrap cluster simplifié:
  - `systemBootstrap` utilise des helpers génériques d upsert (cluster-scoped et namespaced)
  - suppression de duplication sur les flux namespace, node, configmap, service, deployment, daemonset
  - `systemBootstrap` passe par `findByKind/createByKind/updateByKind/deleteByKind` au lieu d appels CRUD spécifiques par ressource
  - nettoyage de l adaptateur bootstrap `ClusterState`, suppression des casts `any` restants
  - `seeds/loader` retourne désormais un `ApiServerFacade` seedé, plus un `ClusterState` direct
- Nettoyage de structure:
  - suppression des barrels `index.ts`, imports explicites

## Écart restant avant migration complète

- Les mutations directes historiques de ressources ont été coupées au profit du CRUD façade et du CRUD générique `createByKind/updateByKind/deleteByKind`
- API-only est désormais imposé sur `src` et `tests/unit`, sans usage de `getClusterState()` ni `etcd.clusterState`
- Certaines fonctions restent orientées snapshot `ClusterStateData` pour le rendu pur interne, ce qui est acceptable tant que l entrée reste API-first
- La fidélité `kubectl describe events` est en progression continue:
  - `Count` et `Last Seen` sont désormais présents
  - `First Seen` est ajouté pour rendre la consolidation plus lisible
  - un affinage reste possible pour coller encore plus au rendu natif Kubernetes

## Backlog priorisé

- `restore` est explicitement reporté:
  - besoin surtout lors de reprise d état après restart, import de scénario, ou time-travel/debug
  - non bloquant pour la phase actuelle orientée bootstrap + API-first runtime
  - à traiter quand la persistance durable deviendra prioritaire

## Proximité avec Kubernetes, état factuel

- Oui, le simulateur est significativement plus proche de Kubernetes qu avant, surtout sur la séparation control-plane/kubelet/runtime et sur les états Pod
- Non, ce n est pas encore un équivalent complet d un vrai cluster Kubernetes, ce qui est attendu pour un simulateur

## Non-régression, état de confiance

- Exécution de la suite complète de tests
- Résultat:
  - 132 fichiers de tests passés
  - 1788 tests passés
- Conclusion:
  - aucune régression détectée par la couverture actuelle
  - le niveau de confiance est élevé, avec la limite standard qu une suite verte ne couvre jamais 100% des cas réels
  - validation ciblée du lot API-first le 2026-03-13: 39 fichiers, 607 tests verts

## Stratégie de tests (nouvelle architecture)

- Tests unitaires par composant:
  - `etcd` et gestion de révision: `tests/unit/etcd/EtcdLikeStore.test.ts`
  - façade API: `tests/unit/api/ApiServerFacade.test.ts`
- Tests de chaîne architecture:
  - `tests/unit/architecture/KubernetesLikeArchitectureChain.test.ts`
  - couvre le flux `kubectl -> api facade -> etcd-like revision` et le flux `event bus -> lifecycle store -> kubectl describe`
- Règle appliquée:
  - les tests utilisent directement `apiServer` dans les appels des handlers migrés
  - pas de wrapper de conversion local `state -> apiServer`
  - migration des tests runtime kubelet `PodLifecycleController.runtimeFields.test.ts` vers `apiServer` direct, sans `createEventBus` ni `ControllerState` mock local
  - migration des tests unitaires des contrôleurs control-plane (Deployment, ReplicaSet, DaemonSet, observability) vers le constructeur API-first

## Décision recommandée

La migration peut continuer sans rollback, en priorisant le cutover API-only des derniers chemins legacy, puis l alignement fin des events `kubectl describe`.
