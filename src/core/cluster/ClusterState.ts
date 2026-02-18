import type { Result } from '../../core/shared/result'
import type { EventBus } from './events/EventBus'
import {
  handleConfigMapAnnotated,
  handleConfigMapCreated,
  handleConfigMapDeleted,
  handleConfigMapLabeled,
  handleConfigMapUpdated,
  handleDeploymentCreated,
  handleDeploymentDeleted,
  handleDeploymentUpdated,
  handlePodAnnotated,
  handlePodCreated,
  handlePodDeleted,
  handlePodLabeled,
  handlePodUpdated,
  handleReplicaSetCreated,
  handleReplicaSetDeleted,
  handleReplicaSetUpdated,
  handleSecretAnnotated,
  handleSecretCreated,
  handleSecretDeleted,
  handleSecretLabeled,
  handleSecretUpdated,
  handleServiceAnnotated,
  handleServiceCreated,
  handleServiceDeleted,
  handleServiceLabeled,
  handleServiceUpdated
} from './events/handlers'
import type { ClusterEvent } from './events/types'
import {
  createConfigMapCreatedEvent,
  createConfigMapDeletedEvent,
  createConfigMapUpdatedEvent,
  createDeploymentCreatedEvent,
  createDeploymentDeletedEvent,
  createDeploymentUpdatedEvent,
  createPodCreatedEvent,
  createPodDeletedEvent,
  createPodUpdatedEvent,
  createReplicaSetCreatedEvent,
  createReplicaSetDeletedEvent,
  createReplicaSetUpdatedEvent,
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
import type { Deployment } from './ressources/Deployment'
import type { Node } from './ressources/Node'
import type { Pod } from './ressources/Pod'
import type { ReplicaSet } from './ressources/ReplicaSet'
import type { Secret } from './ressources/Secret'
import type { Service } from './ressources/Service'
import type { ClusterBootstrapConfig } from './systemBootstrap'
import { applyClusterBootstrap } from './systemBootstrap'

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
  services: ResourceCollection<Service>
}

type ResourceByKind = {
  Pod: Pod
  ConfigMap: ConfigMap
  Secret: Secret
  Node: Node
  ReplicaSet: ReplicaSet
  Deployment: Deployment
  Service: Service
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
    services: Service[]
  }> = {}
): ClusterStateData => ({
  pods: { items: collections.pods ?? [] },
  configMaps: { items: collections.configMaps ?? [] },
  secrets: { items: collections.secrets ?? [] },
  nodes: { items: collections.nodes ?? [] },
  replicaSets: { items: collections.replicaSets ?? [] },
  deployments: { items: collections.deployments ?? [] },
  services: { items: collections.services ?? [] }
})

// ─── Resource Repositories ───────────────────────────────────────────

// Create resource-specific repositories (singletons)
const podRepo = createResourceRepository<Pod>('Pod')
const configMapRepo = createResourceRepository<ConfigMap>('ConfigMap')
const secretRepo = createResourceRepository<Secret>('Secret')
const nodeRepo = createResourceRepository<Node>('Node')
const replicaSetRepo = createResourceRepository<ReplicaSet>('ReplicaSet')
const deploymentRepo = createResourceRepository<Deployment>('Deployment')
const serviceRepo = createResourceRepository<Service>('Service')

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
  services: serviceRepo.createEmpty()
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
const serviceOps = createResourceOperations<Service>(serviceRepo, 'services')

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
  getServices: (namespace?: string) => Service[]
  addService: (service: Service) => void
  findService: (name: string, namespace: string) => Result<Service>
  deleteService: (name: string, namespace: string) => Result<Service>
  updateService: (
    name: string,
    namespace: string,
    updateFn: (service: Service) => Service
  ) => Result<Service>
  findByKind: <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ) => Result<KindToResource<TKind>>
  listByKind: <TKind extends ResourceKind>(
    kind: TKind,
    namespace?: string
  ) => KindToResource<TKind>[]
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
    created: createSecretCreatedEvent, // Placeholder - will need Node events later
    deleted: createSecretDeletedEvent,
    updated: createSecretUpdatedEvent
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
  Service: {
    created: createServiceCreatedEvent,
    deleted: createServiceDeletedEvent,
    updated: createServiceUpdatedEvent
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

  return {
    getAll: (namespace?: string) => ops.getAll(getState(), namespace),

    add: (resource: T) => {
      eventBus.emit(eventFactory.created(resource as any, 'direct'))
    },

    find: (name: string, namespace: string) =>
      ops.find(getState(), name, namespace),

    delete: (name: string, namespace: string): Result<T> => {
      const findResult = ops.find(getState(), name, namespace)
      if (!findResult.ok) {
        return findResult
      }
      eventBus.emit(
        eventFactory.deleted(name, namespace, findResult.value as any, 'direct')
      )
      return { ok: true, value: findResult.value }
    },

    update: (
      name: string,
      namespace: string,
      updateFn: (resource: T) => T
    ): Result<T> => {
      const findResult = ops.find(getState(), name, namespace)
      if (!findResult.ok) {
        return findResult
      }
      const updatedResource = updateFn(findResult.value)
      eventBus.emit(
        eventFactory.updated(
          name,
          namespace,
          updatedResource as any,
          findResult.value as any,
          'direct'
        )
      )
      return { ok: true, value: updatedResource }
    }
  }
}

// ─── Event Handling ──────────────────────────────────────────────────────

/**
 * Event handler map for dispatching events to handlers
 * Using object lookup pattern instead of switch
 */
const EVENT_HANDLERS: Record<
  string,
  (state: ClusterStateData, event: any) => ClusterStateData
> = {
  PodCreated: handlePodCreated,
  PodDeleted: handlePodDeleted,
  PodUpdated: handlePodUpdated,
  ConfigMapCreated: handleConfigMapCreated,
  ConfigMapDeleted: handleConfigMapDeleted,
  ConfigMapUpdated: handleConfigMapUpdated,
  SecretCreated: handleSecretCreated,
  SecretDeleted: handleSecretDeleted,
  SecretUpdated: handleSecretUpdated,
  ReplicaSetCreated: handleReplicaSetCreated,
  ReplicaSetDeleted: handleReplicaSetDeleted,
  ReplicaSetUpdated: handleReplicaSetUpdated,
  DeploymentCreated: handleDeploymentCreated,
  DeploymentDeleted: handleDeploymentDeleted,
  DeploymentUpdated: handleDeploymentUpdated,
  PodLabeled: handlePodLabeled,
  ConfigMapLabeled: handleConfigMapLabeled,
  SecretLabeled: handleSecretLabeled,
  PodAnnotated: handlePodAnnotated,
  ConfigMapAnnotated: handleConfigMapAnnotated,
  SecretAnnotated: handleSecretAnnotated,
  ServiceCreated: handleServiceCreated,
  ServiceDeleted: handleServiceDeleted,
  ServiceUpdated: handleServiceUpdated,
  ServiceLabeled: handleServiceLabeled,
  ServiceAnnotated: handleServiceAnnotated
}

/**
 * Apply event to cluster state
 * Dispatches to appropriate handler based on event type
 */
const applyEventToState = (
  state: ClusterStateData,
  event: ClusterEvent
): ClusterStateData => {
  const handler = EVENT_HANDLERS[event.type]
  if (!handler) {
    return state
  }
  return handler(state, event)
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
  // Cast is safe: applyEventToState ignores unknown event types
  eventBus.subscribeAll((event) => {
    state = applyEventToState(state, event as ClusterEvent)
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
  const serviceMethods = createFacadeMethods(
    serviceOps,
    getState,
    setState,
    eventBus,
    'Service'
  )

  // Nodes are cluster-scoped (no namespace), so we need custom methods
  // For now, we add nodes directly to state since Node events are not yet implemented
  const nodeMethods = {
    getAll: () => nodeOps.getAll(getState(), undefined), // Ignore namespace for nodes
    add: (node: Node) => {
      // Add node directly to state (bypass events for now)
      const currentState = getState()
      const updatedNodes = nodeRepo.add(currentState.nodes, node)
      setState({ ...currentState, nodes: updatedNodes })
      // Emit placeholder event for logging (but state is already updated)
      eventBus.emit(createSecretCreatedEvent(node as any, 'direct')) // Placeholder until Node events are created
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
      // Delete node directly from state using repository
      const currentState = getState()
      const deleteResult = nodeRepo.remove(currentState.nodes, name, '')
      if (deleteResult.ok && deleteResult.collection) {
        setState({ ...currentState, nodes: deleteResult.collection })
      }
      eventBus.emit(
        createSecretDeletedEvent(name, '', findResult.value as any, 'direct')
      ) // Placeholder
      return { ok: true, value: findResult.value }
    },
    update: (name: string, updateFn: (node: Node) => Node): Result<Node> => {
      const findResult = nodeOps.find(getState(), name, '')
      if (!findResult.ok) {
        return findResult
      }
      const updatedNode = updateFn(findResult.value)
      // Update node directly in state using repository
      const currentState = getState()
      const updateResult = nodeRepo.update(
        currentState.nodes,
        name,
        '',
        updateFn
      )
      if (updateResult.ok && updateResult.collection) {
        setState({ ...currentState, nodes: updateResult.collection })
      }
      eventBus.emit(
        createSecretUpdatedEvent(
          name,
          '',
          updatedNode as any,
          findResult.value as any,
          'direct'
        )
      ) // Placeholder
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
      (resourceName: string, resourceNamespace: string) => Result<KubernetesResource>
    > = {
      Pod: (resourceName, resourceNamespace) =>
        podMethods.find(resourceName, resourceNamespace) as Result<KubernetesResource>,
      ConfigMap: (resourceName, resourceNamespace) =>
        configMapMethods.find(resourceName, resourceNamespace) as Result<KubernetesResource>,
      Secret: (resourceName, resourceNamespace) =>
        secretMethods.find(resourceName, resourceNamespace) as Result<KubernetesResource>,
      Node: (resourceName, _resourceNamespace) =>
        nodeMethods.find(resourceName) as Result<KubernetesResource>,
      ReplicaSet: (resourceName, resourceNamespace) =>
        replicaSetMethods.find(resourceName, resourceNamespace) as Result<KubernetesResource>,
      Deployment: (resourceName, resourceNamespace) =>
        deploymentMethods.find(resourceName, resourceNamespace) as Result<KubernetesResource>,
      Service: (resourceName, resourceNamespace) =>
        serviceMethods.find(resourceName, resourceNamespace) as Result<KubernetesResource>
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
      Node: (_resourceNamespace) => nodeMethods.getAll() as KubernetesResource[],
      ReplicaSet: (resourceNamespace) =>
        replicaSetMethods.getAll(resourceNamespace) as KubernetesResource[],
      Deployment: (resourceNamespace) =>
        deploymentMethods.getAll(resourceNamespace) as KubernetesResource[],
      Service: (resourceNamespace) =>
        serviceMethods.getAll(resourceNamespace) as KubernetesResource[]
    }

    const lister = listers[kind]
    if (!lister) {
      return []
    }

    return lister(namespace) as KindToResource<TKind>[]
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

    getServices: serviceMethods.getAll,
    addService: serviceMethods.add,
    findService: serviceMethods.find,
    deleteService: serviceMethods.delete,
    updateService: serviceMethods.update,

    findByKind,
    listByKind,

    toJSON: () => ({
      pods: { items: [...state.pods.items] },
      configMaps: { items: [...state.configMaps.items] },
      secrets: { items: [...state.secrets.items] },
      nodes: { items: [...state.nodes.items] },
      replicaSets: { items: [...state.replicaSets.items] },
      deployments: { items: [...state.deployments.items] },
      services: { items: [...state.services.items] }
    }),

    loadState: (newState: ClusterStateData) => {
      state = {
        pods: newState.pods || { items: [] },
        configMaps: newState.configMaps || { items: [] },
        secrets: newState.secrets || { items: [] },
        nodes: newState.nodes || { items: [] },
        replicaSets: newState.replicaSets || { items: [] },
        deployments: newState.deployments || { items: [] },
        services: newState.services || { items: [] }
      }
    }
  }

  if (options?.bootstrap) {
    applyClusterBootstrap(clusterStateFacade, options.bootstrap)
  }

  return clusterStateFacade
}
