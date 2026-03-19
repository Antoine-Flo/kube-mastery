import type { Result } from '../../core/shared/result'
import type { EventBus } from './events/EventBus'
import {
  applyClusterEventToState
} from './events/handlers'
import type { ClusterEvent } from './events/types'
import {
  createConfigMapCreatedEvent,
  createConfigMapDeletedEvent,
  createConfigMapUpdatedEvent,
  createDaemonSetCreatedEvent,
  createDaemonSetDeletedEvent,
  createDaemonSetUpdatedEvent,
  createDeploymentCreatedEvent,
  createDeploymentDeletedEvent,
  createDeploymentUpdatedEvent,
  createIngressCreatedEvent,
  createIngressDeletedEvent,
  createIngressUpdatedEvent,
  createNamespaceCreatedEvent,
  createNamespaceDeletedEvent,
  createNamespaceUpdatedEvent,
  createNodeCreatedEvent,
  createNodeDeletedEvent,
  createNodeUpdatedEvent,
  createPodCreatedEvent,
  createPodDeletedEvent,
  createPodUpdatedEvent,
  createPersistentVolumeClaimCreatedEvent,
  createPersistentVolumeClaimDeletedEvent,
  createPersistentVolumeClaimUpdatedEvent,
  createPersistentVolumeCreatedEvent,
  createPersistentVolumeDeletedEvent,
  createPersistentVolumeUpdatedEvent,
  createReplicaSetCreatedEvent,
  createReplicaSetDeletedEvent,
  createReplicaSetUpdatedEvent,
  createStatefulSetCreatedEvent,
  createStatefulSetDeletedEvent,
  createStatefulSetUpdatedEvent,
  createSecretCreatedEvent,
  createSecretDeletedEvent,
  createSecretUpdatedEvent,
  createServiceCreatedEvent,
  createServiceDeletedEvent,
  createServiceUpdatedEvent
} from './events/types'
import { createResourceRepository } from './repositories/resourceRepository'
import type {
  KubernetesResource,
  ResourceCollection
} from './repositories/types'
import type { ConfigMap } from './ressources/ConfigMap'
import type { DaemonSet } from './ressources/DaemonSet'
import type { Deployment } from './ressources/Deployment'
import type { Ingress } from './ressources/Ingress'
import { type Namespace } from './ressources/Namespace'
import type { Node } from './ressources/Node'
import type { PersistentVolume } from './ressources/PersistentVolume'
import type { PersistentVolumeClaim } from './ressources/PersistentVolumeClaim'
import type { Pod } from './ressources/Pod'
import type { ReplicaSet } from './ressources/ReplicaSet'
import type { Secret } from './ressources/Secret'
import type { Service } from './ressources/Service'
import type { StatefulSet } from './ressources/StatefulSet'
import type { ClusterBootstrapConfig } from './systemBootstrap'
import { applyClusterBootstrap } from './systemBootstrap'
import { createSystemNamespaces } from './systemNamespaces'

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║                    KUBERNETES CLUSTER STATE                           ║
// ╚═══════════════════════════════════════════════════════════════════════╝
// Manages virtual K8s cluster with pods, configmaps, secrets, and more.
// Uses Generic Repository Pattern for DRY CRUD operations.
// Now supports event-driven architecture via EventBus subscription.

export interface ClusterStateData {
  pods: ResourceCollection<Pod>
  configMaps: ResourceCollection<ConfigMap>
  secrets: ResourceCollection<Secret>
  nodes: ResourceCollection<Node>
  replicaSets: ResourceCollection<ReplicaSet>
  deployments: ResourceCollection<Deployment>
  daemonSets: ResourceCollection<DaemonSet>
  statefulSets: ResourceCollection<StatefulSet>
  services: ResourceCollection<Service>
  ingresses: ResourceCollection<Ingress>
  persistentVolumes: ResourceCollection<PersistentVolume>
  persistentVolumeClaims: ResourceCollection<PersistentVolumeClaim>
  namespaces: ResourceCollection<Namespace>
}

type ResourceByKind = {
  Pod: Pod
  ConfigMap: ConfigMap
  Secret: Secret
  Node: Node
  ReplicaSet: ReplicaSet
  Deployment: Deployment
  DaemonSet: DaemonSet
  StatefulSet: StatefulSet
  Service: Service
  Ingress: Ingress
  PersistentVolume: PersistentVolume
  PersistentVolumeClaim: PersistentVolumeClaim
  Namespace: Namespace
}

export type ResourceKind = keyof ResourceByKind

export type KindToResource<TKind extends ResourceKind> = ResourceByKind[TKind]

/**
 * Create a ClusterStateData with optional partial collections
 */
export const createClusterStateData = (
  collections: Partial<{
    pods: Pod[]
    configMaps: ConfigMap[]
    secrets: Secret[]
    nodes: Node[]
    replicaSets: ReplicaSet[]
    deployments: Deployment[]
    daemonSets: DaemonSet[]
    statefulSets: StatefulSet[]
    services: Service[]
    ingresses: Ingress[]
    persistentVolumes: PersistentVolume[]
    persistentVolumeClaims: PersistentVolumeClaim[]
    namespaces: Namespace[]
  }> = {}
): ClusterStateData => ({
  pods: { items: collections.pods ?? [] },
  configMaps: { items: collections.configMaps ?? [] },
  secrets: { items: collections.secrets ?? [] },
  nodes: { items: collections.nodes ?? [] },
  replicaSets: { items: collections.replicaSets ?? [] },
  deployments: { items: collections.deployments ?? [] },
  daemonSets: { items: collections.daemonSets ?? [] },
  statefulSets: { items: collections.statefulSets ?? [] },
  services: { items: collections.services ?? [] },
  ingresses: { items: collections.ingresses ?? [] },
  persistentVolumes: { items: collections.persistentVolumes ?? [] },
  persistentVolumeClaims: { items: collections.persistentVolumeClaims ?? [] },
  namespaces: { items: collections.namespaces ?? [] }
})

// ─── Resource Repositories ───────────────────────────────────────────

// Create resource-specific repositories (singletons)
const podRepo = createResourceRepository<Pod>('Pod')
const configMapRepo = createResourceRepository<ConfigMap>('ConfigMap')
const secretRepo = createResourceRepository<Secret>('Secret')
const nodeRepo = createResourceRepository<Node>('Node')
const replicaSetRepo = createResourceRepository<ReplicaSet>('ReplicaSet')
const deploymentRepo = createResourceRepository<Deployment>('Deployment')
const daemonSetRepo = createResourceRepository<DaemonSet>('DaemonSet')
const statefulSetRepo = createResourceRepository<StatefulSet>('StatefulSet')
const serviceRepo = createResourceRepository<Service>('Service')
const ingressRepo = createResourceRepository<Ingress>('Ingress')
const persistentVolumeRepo =
  createResourceRepository<PersistentVolume>('PersistentVolume')
const persistentVolumeClaimRepo =
  createResourceRepository<PersistentVolumeClaim>('PersistentVolumeClaim')
const namespaceRepo = createResourceRepository<Namespace>('Namespace')

// ─── Generic Resource Operations Helper ─────────────────────────────

type ResourceRepository<T extends KubernetesResource> = ReturnType<
  typeof createResourceRepository<T>
>

interface ResourceOperations<T extends KubernetesResource> {
  add: (state: ClusterStateData, resource: T) => ClusterStateData
  getAll: (state: ClusterStateData, namespace?: string) => T[]
  find: (state: ClusterStateData, name: string, namespace: string) => Result<T>
  delete: (
    state: ClusterStateData,
    name: string,
    namespace: string
  ) => Result<T> & { state?: ClusterStateData }
  update: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    updateFn: (resource: T) => T
  ) => Result<T> & { state?: ClusterStateData }
}

const createResourceOperations = <T extends KubernetesResource>(
  repo: ResourceRepository<T>,
  collectionKey: keyof ClusterStateData
): ResourceOperations<T> => ({
  add: (state: ClusterStateData, resource: T): ClusterStateData => ({
    ...state,
    [collectionKey]: repo.add(
      state[collectionKey] as unknown as ResourceCollection<T>,
      resource
    )
  }),

  getAll: (state: ClusterStateData, namespace?: string): T[] =>
    repo.getAll(
      state[collectionKey] as unknown as ResourceCollection<T>,
      namespace
    ),

  find: (state: ClusterStateData, name: string, namespace: string): Result<T> =>
    repo.find(
      state[collectionKey] as unknown as ResourceCollection<T>,
      name,
      namespace
    ),

  delete: (
    state: ClusterStateData,
    name: string,
    namespace: string
  ): Result<T> & { state?: ClusterStateData } => {
    const result = repo.remove(
      state[collectionKey] as unknown as ResourceCollection<T>,
      name,
      namespace
    )
    if (result.ok && result.collection) {
      return {
        ok: true,
        value: result.value,
        state: { ...state, [collectionKey]: result.collection }
      }
    }
    return result
  },

  update: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    updateFn: (resource: T) => T
  ): Result<T> & { state?: ClusterStateData } => {
    const result = repo.update(
      state[collectionKey] as unknown as ResourceCollection<T>,
      name,
      namespace,
      updateFn
    )
    if (result.ok && result.collection) {
      return {
        ok: true,
        value: result.value,
        state: { ...state, [collectionKey]: result.collection }
      }
    }
    return result
  }
})

// ─── State Operations ────────────────────────────────────────────────

const createEmptyState = (): ClusterStateData => ({
  pods: podRepo.createEmpty(),
  configMaps: configMapRepo.createEmpty(),
  secrets: secretRepo.createEmpty(),
  nodes: nodeRepo.createEmpty(),
  replicaSets: replicaSetRepo.createEmpty(),
  deployments: deploymentRepo.createEmpty(),
  daemonSets: daemonSetRepo.createEmpty(),
  statefulSets: statefulSetRepo.createEmpty(),
  services: serviceRepo.createEmpty(),
  ingresses: ingressRepo.createEmpty(),
  persistentVolumes: persistentVolumeRepo.createEmpty(),
  persistentVolumeClaims: persistentVolumeClaimRepo.createEmpty(),
  namespaces: {
    items: createSystemNamespaces()
  }
})

// ─── Resource Operations (Generated) ─────────────────────────────────

const podOps = createResourceOperations<Pod>(podRepo, 'pods')
const configMapOps = createResourceOperations<ConfigMap>(
  configMapRepo,
  'configMaps'
)
const secretOps = createResourceOperations<Secret>(secretRepo, 'secrets')
const nodeOps = createResourceOperations<Node>(nodeRepo, 'nodes')
const replicaSetOps = createResourceOperations<ReplicaSet>(
  replicaSetRepo,
  'replicaSets'
)
const deploymentOps = createResourceOperations<Deployment>(
  deploymentRepo,
  'deployments'
)
const daemonSetOps = createResourceOperations<DaemonSet>(
  daemonSetRepo,
  'daemonSets'
)
const statefulSetOps = createResourceOperations<StatefulSet>(
  statefulSetRepo,
  'statefulSets'
)
const serviceOps = createResourceOperations<Service>(serviceRepo, 'services')
const ingressOps = createResourceOperations<Ingress>(ingressRepo, 'ingresses')
const persistentVolumeOps = createResourceOperations<PersistentVolume>(
  persistentVolumeRepo,
  'persistentVolumes'
)
const persistentVolumeClaimOps =
  createResourceOperations<PersistentVolumeClaim>(
    persistentVolumeClaimRepo,
    'persistentVolumeClaims'
  )
const namespaceOps = createResourceOperations<Namespace>(
  namespaceRepo,
  'namespaces'
)

// Export Pod operations for test use only
export const addPod = podOps.add
export const deletePod = podOps.delete
export const updatePod = podOps.update

// Facade interface
export interface ClusterState {
  getPods: (namespace?: string) => Pod[]
  addPod: (pod: Pod) => void
  findPod: (name: string, namespace: string) => Result<Pod>
  deletePod: (name: string, namespace: string) => Result<Pod>
  updatePod: (
    name: string,
    namespace: string,
    updateFn: (pod: Pod) => Pod
  ) => Result<Pod>
  getConfigMaps: (namespace?: string) => ConfigMap[]
  addConfigMap: (configMap: ConfigMap) => void
  findConfigMap: (name: string, namespace: string) => Result<ConfigMap>
  deleteConfigMap: (name: string, namespace: string) => Result<ConfigMap>
  updateConfigMap: (
    name: string,
    namespace: string,
    updateFn: (configMap: ConfigMap) => ConfigMap
  ) => Result<ConfigMap>
  getSecrets: (namespace?: string) => Secret[]
  addSecret: (secret: Secret) => void
  findSecret: (name: string, namespace: string) => Result<Secret>
  deleteSecret: (name: string, namespace: string) => Result<Secret>
  updateSecret: (
    name: string,
    namespace: string,
    updateFn: (secret: Secret) => Secret
  ) => Result<Secret>
  getNodes: () => Node[]
  addNode: (node: Node) => void
  findNode: (name: string) => Result<Node>
  deleteNode: (name: string) => Result<Node>
  updateNode: (name: string, updateFn: (node: Node) => Node) => Result<Node>
  getReplicaSets: (namespace?: string) => ReplicaSet[]
  addReplicaSet: (replicaSet: ReplicaSet) => void
  findReplicaSet: (name: string, namespace: string) => Result<ReplicaSet>
  deleteReplicaSet: (name: string, namespace: string) => Result<ReplicaSet>
  updateReplicaSet: (
    name: string,
    namespace: string,
    updateFn: (replicaSet: ReplicaSet) => ReplicaSet
  ) => Result<ReplicaSet>
  getDeployments: (namespace?: string) => Deployment[]
  addDeployment: (deployment: Deployment) => void
  findDeployment: (name: string, namespace: string) => Result<Deployment>
  deleteDeployment: (name: string, namespace: string) => Result<Deployment>
  updateDeployment: (
    name: string,
    namespace: string,
    updateFn: (deployment: Deployment) => Deployment
  ) => Result<Deployment>
  getDaemonSets: (namespace?: string) => DaemonSet[]
  addDaemonSet: (daemonSet: DaemonSet) => void
  findDaemonSet: (name: string, namespace: string) => Result<DaemonSet>
  deleteDaemonSet: (name: string, namespace: string) => Result<DaemonSet>
  updateDaemonSet: (
    name: string,
    namespace: string,
    updateFn: (daemonSet: DaemonSet) => DaemonSet
  ) => Result<DaemonSet>
  getStatefulSets: (namespace?: string) => StatefulSet[]
  addStatefulSet: (statefulSet: StatefulSet) => void
  findStatefulSet: (name: string, namespace: string) => Result<StatefulSet>
  deleteStatefulSet: (name: string, namespace: string) => Result<StatefulSet>
  updateStatefulSet: (
    name: string,
    namespace: string,
    updateFn: (statefulSet: StatefulSet) => StatefulSet
  ) => Result<StatefulSet>
  getServices: (namespace?: string) => Service[]
  addService: (service: Service) => void
  findService: (name: string, namespace: string) => Result<Service>
  deleteService: (name: string, namespace: string) => Result<Service>
  updateService: (
    name: string,
    namespace: string,
    updateFn: (service: Service) => Service
  ) => Result<Service>
  getIngresses: (namespace?: string) => Ingress[]
  addIngress: (ingress: Ingress) => void
  findIngress: (name: string, namespace: string) => Result<Ingress>
  deleteIngress: (name: string, namespace: string) => Result<Ingress>
  updateIngress: (
    name: string,
    namespace: string,
    updateFn: (ingress: Ingress) => Ingress
  ) => Result<Ingress>
  getPersistentVolumes: () => PersistentVolume[]
  addPersistentVolume: (persistentVolume: PersistentVolume) => void
  findPersistentVolume: (name: string) => Result<PersistentVolume>
  deletePersistentVolume: (name: string) => Result<PersistentVolume>
  updatePersistentVolume: (
    name: string,
    updateFn: (persistentVolume: PersistentVolume) => PersistentVolume
  ) => Result<PersistentVolume>
  getPersistentVolumeClaims: (namespace?: string) => PersistentVolumeClaim[]
  addPersistentVolumeClaim: (
    persistentVolumeClaim: PersistentVolumeClaim
  ) => void
  findPersistentVolumeClaim: (
    name: string,
    namespace: string
  ) => Result<PersistentVolumeClaim>
  deletePersistentVolumeClaim: (
    name: string,
    namespace: string
  ) => Result<PersistentVolumeClaim>
  updatePersistentVolumeClaim: (
    name: string,
    namespace: string,
    updateFn: (
      persistentVolumeClaim: PersistentVolumeClaim
    ) => PersistentVolumeClaim
  ) => Result<PersistentVolumeClaim>
  getNamespaces: () => Namespace[]
  addNamespace: (namespace: Namespace) => void
  findNamespace: (name: string) => Result<Namespace>
  deleteNamespace: (name: string) => Result<Namespace>
  updateNamespace: (
    name: string,
    updateFn: (namespace: Namespace) => Namespace
  ) => Result<Namespace>
  findByKind: <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ) => Result<KindToResource<TKind>>
  listByKind: <TKind extends ResourceKind>(
    kind: TKind,
    namespace?: string
  ) => KindToResource<TKind>[]
  createByKind: <TKind extends ResourceKind>(
    kind: TKind,
    resource: KindToResource<TKind>,
  ) => Result<KindToResource<TKind>>
  updateByKind: <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    resource: KindToResource<TKind>,
    namespace?: string
  ) => Result<KindToResource<TKind>>
  deleteByKind: <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ) => Result<KindToResource<TKind>>
  toJSON: () => ClusterStateData
  loadState: (state: ClusterStateData) => void
}

export interface CreateClusterStateOptions {
  bootstrap?: ClusterBootstrapConfig
}

// ─── Event Factory Map ────────────────────────────────────────────────

const EVENT_FACTORIES = {
  Pod: {
    created: createPodCreatedEvent,
    deleted: createPodDeletedEvent,
    updated: createPodUpdatedEvent
  },
  ConfigMap: {
    created: createConfigMapCreatedEvent,
    deleted: createConfigMapDeletedEvent,
    updated: createConfigMapUpdatedEvent
  },
  Secret: {
    created: createSecretCreatedEvent,
    deleted: createSecretDeletedEvent,
    updated: createSecretUpdatedEvent
  },
  Node: {
    created: createNodeCreatedEvent,
    deleted: createNodeDeletedEvent,
    updated: createNodeUpdatedEvent
  },
  ReplicaSet: {
    created: createReplicaSetCreatedEvent,
    deleted: createReplicaSetDeletedEvent,
    updated: createReplicaSetUpdatedEvent
  },
  Deployment: {
    created: createDeploymentCreatedEvent,
    deleted: createDeploymentDeletedEvent,
    updated: createDeploymentUpdatedEvent
  },
  DaemonSet: {
    created: createDaemonSetCreatedEvent,
    deleted: createDaemonSetDeletedEvent,
    updated: createDaemonSetUpdatedEvent
  },
  StatefulSet: {
    created: createStatefulSetCreatedEvent,
    deleted: createStatefulSetDeletedEvent,
    updated: createStatefulSetUpdatedEvent
  },
  Service: {
    created: createServiceCreatedEvent,
    deleted: createServiceDeletedEvent,
    updated: createServiceUpdatedEvent
  },
  Ingress: {
    created: createIngressCreatedEvent,
    deleted: createIngressDeletedEvent,
    updated: createIngressUpdatedEvent
  },
  Namespace: {
    created: createNamespaceCreatedEvent,
    deleted: createNamespaceDeletedEvent,
    updated: createNamespaceUpdatedEvent
  },
  PersistentVolume: {
    created: createPersistentVolumeCreatedEvent,
    deleted: createPersistentVolumeDeletedEvent,
    updated: createPersistentVolumeUpdatedEvent
  },
  PersistentVolumeClaim: {
    created: createPersistentVolumeClaimCreatedEvent,
    deleted: createPersistentVolumeClaimDeletedEvent,
    updated: createPersistentVolumeClaimUpdatedEvent
  }
} as const

// ─── Facade Helper ───────────────────────────────────────────────────

const createFacadeMethods = <T extends KubernetesResource>(
  ops: ResourceOperations<T>,
  getState: () => ClusterStateData,
  _setState: (newState: ClusterStateData) => void,
  eventBus: EventBus,
  resourceKind: keyof typeof EVENT_FACTORIES
) => {
  const eventFactory = EVENT_FACTORIES[resourceKind]
  const emitCreated = eventFactory.created as (
    resource: KubernetesResource,
    source: string
  ) => ClusterEvent
  const emitDeleted = eventFactory.deleted as (
    name: string,
    namespace: string,
    deletedResource: KubernetesResource,
    source: string
  ) => ClusterEvent
  const emitUpdated = eventFactory.updated as (
    name: string,
    namespace: string,
    updatedResource: KubernetesResource,
    previousResource: KubernetesResource,
    source: string
  ) => ClusterEvent
  const assertNamespaceExists = (
    currentState: ClusterStateData,
    namespace: string
  ): void => {
    if (namespace.length === 0) {
      return
    }
    const namespaceResult = namespaceRepo.find(
      currentState.namespaces,
      namespace,
      ''
    )
    if (!namespaceResult.ok) {
      throw new Error(
        `Namespace invariant violation: "${namespace}" does not exist`
      )
    }
  }

  return {
    getAll: (namespace?: string) => ops.getAll(getState(), namespace),

    add: (resource: T) => {
      const currentState = getState()
      assertNamespaceExists(currentState, resource.metadata.namespace)
      eventBus.emit(emitCreated(resource as KubernetesResource, 'direct'))
    },

    find: (name: string, namespace: string) =>
      ops.find(getState(), name, namespace),

    delete: (name: string, namespace: string): Result<T> => {
      const findResult = ops.find(getState(), name, namespace)
      if (!findResult.ok) {
        return findResult
      }
      eventBus.emit(
        emitDeleted(
          name,
          namespace,
          findResult.value as KubernetesResource,
          'direct'
        )
      )
      return { ok: true, value: findResult.value }
    },

    update: (
      name: string,
      namespace: string,
      updateFn: (resource: T) => T
    ): Result<T> => {
      const currentState = getState()
      assertNamespaceExists(currentState, namespace)
      const findResult = ops.find(getState(), name, namespace)
      if (!findResult.ok) {
        return findResult
      }
      const updatedResource = updateFn(findResult.value)
      eventBus.emit(
        emitUpdated(
          name,
          namespace,
          updatedResource as KubernetesResource,
          findResult.value as KubernetesResource,
          'direct'
        )
      )
      return { ok: true, value: updatedResource }
    }
  }
}

// Facade factory function
export function createClusterState(
  eventBus: EventBus,
  options?: CreateClusterStateOptions
): ClusterState {
  let state: ClusterStateData = createEmptyState()

  const getState = () => state
  const setState = (newState: ClusterStateData) => {
    state = newState
  }

  // Subscribe to all events for state updates
  // Cast is safe: applyClusterEventToState ignores unknown event types
  eventBus.subscribeAll((event) => {
    state = applyClusterEventToState(state, event as ClusterEvent)
  })

  const podMethods = createFacadeMethods(
    podOps,
    getState,
    setState,
    eventBus,
    'Pod'
  )
  const configMapMethods = createFacadeMethods(
    configMapOps,
    getState,
    setState,
    eventBus,
    'ConfigMap'
  )
  const secretMethods = createFacadeMethods(
    secretOps,
    getState,
    setState,
    eventBus,
    'Secret'
  )
  const replicaSetMethods = createFacadeMethods(
    replicaSetOps,
    getState,
    setState,
    eventBus,
    'ReplicaSet'
  )
  const deploymentMethods = createFacadeMethods(
    deploymentOps,
    getState,
    setState,
    eventBus,
    'Deployment'
  )
  const daemonSetMethods = createFacadeMethods(
    daemonSetOps,
    getState,
    setState,
    eventBus,
    'DaemonSet'
  )
  const statefulSetMethods = createFacadeMethods(
    statefulSetOps,
    getState,
    setState,
    eventBus,
    'StatefulSet'
  )
  const serviceMethods = createFacadeMethods(
    serviceOps,
    getState,
    setState,
    eventBus,
    'Service'
  )
  const ingressMethods = {
    getAll: (namespace?: string) => ingressOps.getAll(getState(), namespace),
    add: (ingress: Ingress) => {
      const currentState = getState()
      const namespaceResult = namespaceRepo.find(
        currentState.namespaces,
        ingress.metadata.namespace,
        ''
      )
      if (!namespaceResult.ok) {
        throw new Error(
          `Namespace invariant violation: "${ingress.metadata.namespace}" does not exist`
        )
      }
      eventBus.emit(createIngressCreatedEvent(ingress, 'direct'))
    },
    find: (name: string, namespace: string): Result<Ingress> => {
      return ingressOps.find(getState(), name, namespace)
    },
    delete: (name: string, namespace: string): Result<Ingress> => {
      const findResult = ingressOps.find(getState(), name, namespace)
      if (!findResult.ok) {
        return findResult
      }
      eventBus.emit(
        createIngressDeletedEvent(name, namespace, findResult.value, 'direct')
      )
      return { ok: true, value: findResult.value }
    },
    update: (
      name: string,
      namespace: string,
      updateFn: (ingress: Ingress) => Ingress
    ): Result<Ingress> => {
      const findResult = ingressOps.find(getState(), name, namespace)
      if (!findResult.ok) {
        return findResult
      }
      const updatedIngress = updateFn(findResult.value)
      eventBus.emit(
        createIngressUpdatedEvent(
          name,
          namespace,
          updatedIngress,
          findResult.value,
          'direct'
        )
      )
      return { ok: true, value: updatedIngress }
    }
  }
  const persistentVolumeMethods = createFacadeMethods(
    persistentVolumeOps,
    getState,
    setState,
    eventBus,
    'PersistentVolume'
  )
  const persistentVolumeClaimMethods = createFacadeMethods(
    persistentVolumeClaimOps,
    getState,
    setState,
    eventBus,
    'PersistentVolumeClaim'
  )
  const namespaceMethods = {
    getAll: () => namespaceOps.getAll(getState(), undefined),
    add: (namespace: Namespace) => {
      eventBus.emit(createNamespaceCreatedEvent(namespace, 'direct'))
    },
    find: (name: string): Result<Namespace> => {
      return namespaceOps.find(getState(), name, '')
    },
    delete: (name: string): Result<Namespace> => {
      const findResult = namespaceOps.find(getState(), name, '')
      if (!findResult.ok) {
        return findResult
      }
      eventBus.emit(createNamespaceDeletedEvent(name, findResult.value, 'direct'))
      return { ok: true, value: findResult.value }
    },
    update: (
      name: string,
      updateFn: (namespace: Namespace) => Namespace
    ): Result<Namespace> => {
      const findResult = namespaceOps.find(getState(), name, '')
      if (!findResult.ok) {
        return findResult
      }
      const updatedNamespace = updateFn(findResult.value)
      eventBus.emit(
        createNamespaceUpdatedEvent(
          name,
          updatedNamespace,
          findResult.value,
          'direct'
        )
      )
      return { ok: true, value: updatedNamespace }
    }
  }

  const nodeMethods = {
    getAll: () => nodeOps.getAll(getState(), undefined), // Ignore namespace for nodes
    add: (node: Node) => {
      eventBus.emit(createNodeCreatedEvent(node, 'direct'))
    },
    find: (name: string): Result<Node> => {
      // Nodes are cluster-scoped, use empty namespace
      return nodeOps.find(getState(), name, '')
    },
    delete: (name: string): Result<Node> => {
      const findResult = nodeOps.find(getState(), name, '')
      if (!findResult.ok) {
        return findResult
      }
      eventBus.emit(createNodeDeletedEvent(name, findResult.value, 'direct'))
      return { ok: true, value: findResult.value }
    },
    update: (name: string, updateFn: (node: Node) => Node): Result<Node> => {
      const findResult = nodeOps.find(getState(), name, '')
      if (!findResult.ok) {
        return findResult
      }
      const updatedNode = updateFn(findResult.value)
      eventBus.emit(
        createNodeUpdatedEvent(name, updatedNode, findResult.value, 'direct')
      )
      return { ok: true, value: updatedNode }
    }
  }

  const findByKind = <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ): Result<KindToResource<TKind>> => {
    const effectiveNamespace = namespace ?? 'default'
    const finders: Record<
      ResourceKind,
      (
        resourceName: string,
        resourceNamespace: string
      ) => Result<KubernetesResource>
    > = {
      Pod: (resourceName, resourceNamespace) =>
        podMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      ConfigMap: (resourceName, resourceNamespace) =>
        configMapMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      Secret: (resourceName, resourceNamespace) =>
        secretMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      Node: (resourceName, _resourceNamespace) =>
        nodeMethods.find(resourceName) as Result<KubernetesResource>,
      ReplicaSet: (resourceName, resourceNamespace) =>
        replicaSetMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      Deployment: (resourceName, resourceNamespace) =>
        deploymentMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      DaemonSet: (resourceName, resourceNamespace) =>
        daemonSetMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      StatefulSet: (resourceName, resourceNamespace) =>
        statefulSetMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      Service: (resourceName, resourceNamespace) =>
        serviceMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      Ingress: (resourceName, resourceNamespace) =>
        ingressMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      PersistentVolume: (resourceName, _resourceNamespace) =>
        persistentVolumeMethods.find(
          resourceName,
          ''
        ) as Result<KubernetesResource>,
      PersistentVolumeClaim: (resourceName, resourceNamespace) =>
        persistentVolumeClaimMethods.find(
          resourceName,
          resourceNamespace
        ) as Result<KubernetesResource>,
      Namespace: (resourceName, _resourceNamespace) =>
        namespaceMethods.find(resourceName) as Result<KubernetesResource>
    }

    const finder = finders[kind]
    if (!finder) {
      return { ok: false, error: `Unsupported resource kind: ${kind}` }
    }

    return finder(name, effectiveNamespace) as Result<KindToResource<TKind>>
  }

  const listByKind = <TKind extends ResourceKind>(
    kind: TKind,
    namespace?: string
  ): KindToResource<TKind>[] => {
    const listers: Record<
      ResourceKind,
      (resourceNamespace?: string) => KubernetesResource[]
    > = {
      Pod: (resourceNamespace) =>
        podMethods.getAll(resourceNamespace) as KubernetesResource[],
      ConfigMap: (resourceNamespace) =>
        configMapMethods.getAll(resourceNamespace) as KubernetesResource[],
      Secret: (resourceNamespace) =>
        secretMethods.getAll(resourceNamespace) as KubernetesResource[],
      Node: (_resourceNamespace) =>
        nodeMethods.getAll() as KubernetesResource[],
      ReplicaSet: (resourceNamespace) =>
        replicaSetMethods.getAll(resourceNamespace) as KubernetesResource[],
      Deployment: (resourceNamespace) =>
        deploymentMethods.getAll(resourceNamespace) as KubernetesResource[],
      DaemonSet: (resourceNamespace) =>
        daemonSetMethods.getAll(resourceNamespace) as KubernetesResource[],
      StatefulSet: (resourceNamespace) =>
        statefulSetMethods.getAll(resourceNamespace) as KubernetesResource[],
      Service: (resourceNamespace) =>
        serviceMethods.getAll(resourceNamespace) as KubernetesResource[],
      Ingress: (resourceNamespace) =>
        ingressMethods.getAll(resourceNamespace) as KubernetesResource[],
      PersistentVolume: (_resourceNamespace) =>
        persistentVolumeMethods.getAll(undefined) as KubernetesResource[],
      PersistentVolumeClaim: (resourceNamespace) =>
        persistentVolumeClaimMethods.getAll(
          resourceNamespace
        ) as KubernetesResource[],
      Namespace: (_resourceNamespace) =>
        namespaceMethods.getAll() as KubernetesResource[]
    }

    const lister = listers[kind]
    if (!lister) {
      return []
    }

    return lister(namespace) as KindToResource<TKind>[]
  }

  const createByKind = <TKind extends ResourceKind>(
    kind: TKind,
    resource: KindToResource<TKind>,
  ): Result<KindToResource<TKind>> => {
    if (kind === 'Node') {
      nodeMethods.add(resource as Node)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'Namespace') {
      namespaceMethods.add(resource as Namespace)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'PersistentVolume') {
      persistentVolumeMethods.add(resource as PersistentVolume)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'Ingress') {
      ingressMethods.add(resource as Ingress)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'Pod') {
      podMethods.add(resource as Pod)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'ConfigMap') {
      configMapMethods.add(resource as ConfigMap)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'Secret') {
      secretMethods.add(resource as Secret)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'ReplicaSet') {
      replicaSetMethods.add(resource as ReplicaSet)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'Deployment') {
      deploymentMethods.add(resource as Deployment)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'DaemonSet') {
      daemonSetMethods.add(resource as DaemonSet)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'StatefulSet') {
      statefulSetMethods.add(resource as StatefulSet)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'Service') {
      serviceMethods.add(resource as Service)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    if (kind === 'PersistentVolumeClaim') {
      persistentVolumeClaimMethods.add(resource as PersistentVolumeClaim)
      return { ok: true, value: resource as KindToResource<TKind> }
    }
    return { ok: false, error: `Unsupported resource kind: ${kind}` }
  }

  const updateByKind = <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    resource: KindToResource<TKind>,
    namespace?: string
  ): Result<KindToResource<TKind>> => {
    const effectiveNamespace = namespace ?? resource.metadata.namespace ?? 'default'
    if (kind === 'Node') {
      return nodeMethods.update(name, () => resource as Node) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'Namespace') {
      return namespaceMethods.update(name, () => resource as Namespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'PersistentVolume') {
      return persistentVolumeMethods.update(
        name,
        '',
        () => resource as PersistentVolume
      ) as Result<KindToResource<TKind>>
    }
    if (kind === 'Ingress') {
      return ingressMethods.update(
        name,
        effectiveNamespace,
        () => resource as Ingress
      ) as Result<KindToResource<TKind>>
    }
    if (kind === 'Pod') {
      return podMethods.update(name, effectiveNamespace, () => resource as Pod) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'ConfigMap') {
      return configMapMethods.update(
        name,
        effectiveNamespace,
        () => resource as ConfigMap
      ) as Result<KindToResource<TKind>>
    }
    if (kind === 'Secret') {
      return secretMethods.update(
        name,
        effectiveNamespace,
        () => resource as Secret
      ) as Result<KindToResource<TKind>>
    }
    if (kind === 'ReplicaSet') {
      return replicaSetMethods.update(
        name,
        effectiveNamespace,
        () => resource as ReplicaSet
      ) as Result<KindToResource<TKind>>
    }
    if (kind === 'Deployment') {
      return deploymentMethods.update(
        name,
        effectiveNamespace,
        () => resource as Deployment
      ) as Result<KindToResource<TKind>>
    }
    if (kind === 'DaemonSet') {
      return daemonSetMethods.update(
        name,
        effectiveNamespace,
        () => resource as DaemonSet
      ) as Result<KindToResource<TKind>>
    }
    if (kind === 'StatefulSet') {
      return statefulSetMethods.update(
        name,
        effectiveNamespace,
        () => resource as StatefulSet
      ) as Result<KindToResource<TKind>>
    }
    if (kind === 'Service') {
      return serviceMethods.update(
        name,
        effectiveNamespace,
        () => resource as Service
      ) as Result<KindToResource<TKind>>
    }
    if (kind === 'PersistentVolumeClaim') {
      return persistentVolumeClaimMethods.update(
        name,
        effectiveNamespace,
        () => resource as PersistentVolumeClaim
      ) as Result<KindToResource<TKind>>
    }
    return { ok: false, error: `Unsupported resource kind: ${kind}` }
  }

  const deleteByKind = <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ): Result<KindToResource<TKind>> => {
    const effectiveNamespace = namespace ?? 'default'
    if (kind === 'Node') {
      return nodeMethods.delete(name) as Result<KindToResource<TKind>>
    }
    if (kind === 'Namespace') {
      return namespaceMethods.delete(name) as Result<KindToResource<TKind>>
    }
    if (kind === 'PersistentVolume') {
      return persistentVolumeMethods.delete(name, '') as Result<KindToResource<TKind>>
    }
    if (kind === 'Ingress') {
      return ingressMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'Pod') {
      return podMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'ConfigMap') {
      return configMapMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'Secret') {
      return secretMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'ReplicaSet') {
      return replicaSetMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'Deployment') {
      return deploymentMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'DaemonSet') {
      return daemonSetMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'StatefulSet') {
      return statefulSetMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'Service') {
      return serviceMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    if (kind === 'PersistentVolumeClaim') {
      return persistentVolumeClaimMethods.delete(name, effectiveNamespace) as Result<
        KindToResource<TKind>
      >
    }
    return { ok: false, error: `Unsupported resource kind: ${kind}` }
  }

  const clusterStateFacade: ClusterState = {
    getPods: podMethods.getAll,
    addPod: podMethods.add,
    findPod: podMethods.find,
    deletePod: podMethods.delete,
    updatePod: podMethods.update,

    getConfigMaps: configMapMethods.getAll,
    addConfigMap: configMapMethods.add,
    findConfigMap: configMapMethods.find,
    deleteConfigMap: configMapMethods.delete,
    updateConfigMap: configMapMethods.update,

    getSecrets: secretMethods.getAll,
    addSecret: secretMethods.add,
    findSecret: secretMethods.find,
    deleteSecret: secretMethods.delete,
    updateSecret: secretMethods.update,

    getNodes: nodeMethods.getAll,
    addNode: nodeMethods.add,
    findNode: nodeMethods.find,
    deleteNode: nodeMethods.delete,
    updateNode: nodeMethods.update,

    getReplicaSets: replicaSetMethods.getAll,
    addReplicaSet: replicaSetMethods.add,
    findReplicaSet: replicaSetMethods.find,
    deleteReplicaSet: replicaSetMethods.delete,
    updateReplicaSet: replicaSetMethods.update,

    getDeployments: deploymentMethods.getAll,
    addDeployment: deploymentMethods.add,
    findDeployment: deploymentMethods.find,
    deleteDeployment: deploymentMethods.delete,
    updateDeployment: deploymentMethods.update,

    getDaemonSets: daemonSetMethods.getAll,
    addDaemonSet: daemonSetMethods.add,
    findDaemonSet: daemonSetMethods.find,
    deleteDaemonSet: daemonSetMethods.delete,
    updateDaemonSet: daemonSetMethods.update,
    getStatefulSets: statefulSetMethods.getAll,
    addStatefulSet: statefulSetMethods.add,
    findStatefulSet: statefulSetMethods.find,
    deleteStatefulSet: statefulSetMethods.delete,
    updateStatefulSet: statefulSetMethods.update,

    getServices: serviceMethods.getAll,
    addService: serviceMethods.add,
    findService: serviceMethods.find,
    deleteService: serviceMethods.delete,
    updateService: serviceMethods.update,
    getIngresses: ingressMethods.getAll,
    addIngress: ingressMethods.add,
    findIngress: ingressMethods.find,
    deleteIngress: ingressMethods.delete,
    updateIngress: ingressMethods.update,

    getPersistentVolumes: () => persistentVolumeMethods.getAll(undefined),
    addPersistentVolume: persistentVolumeMethods.add,
    findPersistentVolume: (name) => persistentVolumeMethods.find(name, ''),
    deletePersistentVolume: (name) => persistentVolumeMethods.delete(name, ''),
    updatePersistentVolume: (name, updateFn) =>
      persistentVolumeMethods.update(name, '', updateFn),

    getPersistentVolumeClaims: persistentVolumeClaimMethods.getAll,
    addPersistentVolumeClaim: persistentVolumeClaimMethods.add,
    findPersistentVolumeClaim: persistentVolumeClaimMethods.find,
    deletePersistentVolumeClaim: persistentVolumeClaimMethods.delete,
    updatePersistentVolumeClaim: persistentVolumeClaimMethods.update,

    getNamespaces: namespaceMethods.getAll,
    addNamespace: namespaceMethods.add,
    findNamespace: namespaceMethods.find,
    deleteNamespace: namespaceMethods.delete,
    updateNamespace: namespaceMethods.update,

    findByKind,
    listByKind,
    createByKind,
    updateByKind,
    deleteByKind,

    toJSON: () => ({
      pods: { items: [...state.pods.items] },
      configMaps: { items: [...state.configMaps.items] },
      secrets: { items: [...state.secrets.items] },
      nodes: { items: [...state.nodes.items] },
      replicaSets: { items: [...state.replicaSets.items] },
      deployments: { items: [...state.deployments.items] },
      daemonSets: { items: [...state.daemonSets.items] },
      statefulSets: { items: [...state.statefulSets.items] },
      services: { items: [...state.services.items] },
      ingresses: { items: [...state.ingresses.items] },
      persistentVolumes: { items: [...state.persistentVolumes.items] },
      persistentVolumeClaims: {
        items: [...state.persistentVolumeClaims.items]
      },
      namespaces: { items: [...state.namespaces.items] }
    }),

    loadState: (newState: ClusterStateData) => {
      state = {
        pods: newState.pods || { items: [] },
        configMaps: newState.configMaps || { items: [] },
        secrets: newState.secrets || { items: [] },
        nodes: newState.nodes || { items: [] },
        replicaSets: newState.replicaSets || { items: [] },
        deployments: newState.deployments || { items: [] },
        daemonSets: newState.daemonSets || { items: [] },
        statefulSets: newState.statefulSets || { items: [] },
        services: newState.services || { items: [] },
        ingresses: newState.ingresses || { items: [] },
        persistentVolumes: newState.persistentVolumes || { items: [] },
        persistentVolumeClaims: newState.persistentVolumeClaims || {
          items: []
        },
        namespaces: newState.namespaces || { items: [] }
      }
    }
  }

  if (options?.bootstrap) {
    applyClusterBootstrap(clusterStateFacade, options.bootstrap)
  }

  return clusterStateFacade
}
