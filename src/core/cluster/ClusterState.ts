import type { Result } from '../../core/shared/result'
import type { EventBus } from './events/EventBus'
import { applyClusterEventToState } from './events/handlers'
import type { ClusterEvent } from './events/types'
import {
  EVENT_FACTORIES,
  type EventFactoryKind
} from './resourceEventFactories'
import {
  CLUSTER_DATA_KEYS,
  type ClusterStateCollectionsInput,
  type ClusterStateData,
  type KindToResource,
  type ResourceKind
} from './generated/clusterResourceTypes.generated'
import {
  CLUSTER_SCOPED_RESOURCE_KINDS,
  COLLECTION_KEY_BY_RESOURCE_KIND,
  RESOURCE_FACADE_NAMES_BY_KIND,
  repos,
  resourceOps
} from './generated/clusterRegistry.generated'
import type {
  KubernetesResource,
  ResourceCollection
} from './repositories/types'
import type { ResourceOperations } from './resourceStateOps'
import type { ConfigMap } from './ressources/ConfigMap'
import type { ControllerRevision } from './ressources/ControllerRevision'
import type { DaemonSet } from './ressources/DaemonSet'
import type { Deployment } from './ressources/Deployment'
import type { EndpointSlice } from './ressources/EndpointSlice'
import type { Endpoints } from './ressources/Endpoints'
import type { Event } from './ressources/Event'
import type { Ingress } from './ressources/Ingress'
import type { NetworkPolicy } from './ressources/NetworkPolicy'
import type { Lease } from './ressources/Lease'
import { type Namespace } from './ressources/Namespace'
import type { Node } from './ressources/Node'
import type { PersistentVolume } from './ressources/PersistentVolume'
import type { PersistentVolumeClaim } from './ressources/PersistentVolumeClaim'
import type { Pod } from './ressources/Pod'
import type { ReplicaSet } from './ressources/ReplicaSet'
import type { Secret } from './ressources/Secret'
import type { StorageClass } from './ressources/StorageClass'
import type { Service } from './ressources/Service'
import type { StatefulSet } from './ressources/StatefulSet'
import type { ClusterBootstrapConfig } from './systemBootstrap'
import { applyClusterBootstrap } from './systemBootstrap'
import { createSystemNamespaces } from './systemNamespaces'

export type {
  ClusterStateCollectionsInput,
  ClusterStateData,
  KindToResource,
  ResourceKind
} from './generated/clusterResourceTypes.generated'

export const createClusterStateData = (
  collections: ClusterStateCollectionsInput = {}
): ClusterStateData => {
  const out = {} as Record<keyof ClusterStateData, { items: KubernetesResource[] }>
  for (const key of CLUSTER_DATA_KEYS) {
    const raw = collections[key]
    const items = (Array.isArray(raw) ? raw : []) as KubernetesResource[]
    out[key] = { items }
  }
  return out as ClusterStateData
}

const createEmptyState = (): ClusterStateData => {
  const next = {} as Record<
    keyof ClusterStateData,
    ResourceCollection<KubernetesResource>
  >
  for (const key of CLUSTER_DATA_KEYS) {
    if (key === 'namespaces') {
      next.namespaces = {
        items: createSystemNamespaces()
      } as ResourceCollection<KubernetesResource>
    } else {
      next[key] = repos[key].createEmpty() as ResourceCollection<KubernetesResource>
    }
  }
  return next as ClusterStateData
}

export const addPod = resourceOps.pods.add
export const deletePod = resourceOps.pods.delete
export const updatePod = resourceOps.pods.update

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
  getControllerRevisions: (namespace?: string) => ControllerRevision[]
  addControllerRevision: (controllerRevision: ControllerRevision) => void
  findControllerRevision: (
    name: string,
    namespace: string
  ) => Result<ControllerRevision>
  deleteControllerRevision: (
    name: string,
    namespace: string
  ) => Result<ControllerRevision>
  updateControllerRevision: (
    name: string,
    namespace: string,
    updateFn: (controllerRevision: ControllerRevision) => ControllerRevision
  ) => Result<ControllerRevision>
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
  getEndpointSlices: (namespace?: string) => EndpointSlice[]
  addEndpointSlice: (endpointSlice: EndpointSlice) => void
  findEndpointSlice: (name: string, namespace: string) => Result<EndpointSlice>
  deleteEndpointSlice: (
    name: string,
    namespace: string
  ) => Result<EndpointSlice>
  updateEndpointSlice: (
    name: string,
    namespace: string,
    updateFn: (endpointSlice: EndpointSlice) => EndpointSlice
  ) => Result<EndpointSlice>
  getEndpoints: (namespace?: string) => Endpoints[]
  addEndpoints: (endpoints: Endpoints) => void
  findEndpoints: (name: string, namespace: string) => Result<Endpoints>
  deleteEndpoints: (name: string, namespace: string) => Result<Endpoints>
  updateEndpoints: (
    name: string,
    namespace: string,
    updateFn: (endpoints: Endpoints) => Endpoints
  ) => Result<Endpoints>
  getEvents: (namespace?: string) => Event[]
  addEvent: (event: Event) => void
  findEvent: (name: string, namespace: string) => Result<Event>
  deleteEvent: (name: string, namespace: string) => Result<Event>
  updateEvent: (
    name: string,
    namespace: string,
    updateFn: (event: Event) => Event
  ) => Result<Event>
  getIngresses: (namespace?: string) => Ingress[]
  addIngress: (ingress: Ingress) => void
  findIngress: (name: string, namespace: string) => Result<Ingress>
  deleteIngress: (name: string, namespace: string) => Result<Ingress>
  updateIngress: (
    name: string,
    namespace: string,
    updateFn: (ingress: Ingress) => Ingress
  ) => Result<Ingress>
  getNetworkPolicies: (namespace?: string) => NetworkPolicy[]
  addNetworkPolicy: (networkPolicy: NetworkPolicy) => void
  findNetworkPolicy: (name: string, namespace: string) => Result<NetworkPolicy>
  deleteNetworkPolicy: (name: string, namespace: string) => Result<NetworkPolicy>
  updateNetworkPolicy: (
    name: string,
    namespace: string,
    updateFn: (networkPolicy: NetworkPolicy) => NetworkPolicy
  ) => Result<NetworkPolicy>
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
  getLeases: (namespace?: string) => Lease[]
  addLease: (lease: Lease) => void
  findLease: (name: string, namespace: string) => Result<Lease>
  deleteLease: (name: string, namespace: string) => Result<Lease>
  updateLease: (
    name: string,
    namespace: string,
    updateFn: (lease: Lease) => Lease
  ) => Result<Lease>
  getStorageClasses: () => StorageClass[]
  addStorageClass: (storageClass: StorageClass) => void
  findStorageClass: (name: string) => Result<StorageClass>
  deleteStorageClass: (name: string) => Result<StorageClass>
  updateStorageClass: (
    name: string,
    updateFn: (storageClass: StorageClass) => StorageClass
  ) => Result<StorageClass>
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
    resource: KindToResource<TKind>
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

const createFacadeMethods = <T extends KubernetesResource>(
  ops: ResourceOperations<T>,
  getState: () => ClusterStateData,
  _setState: (newState: ClusterStateData) => void,
  eventBus: EventBus,
  resourceKind: EventFactoryKind
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
    const namespaceResult = repos.namespaces.find(
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

type NamespacedFacade<T extends KubernetesResource> = {
  getAll: (namespace?: string) => T[]
  add: (resource: T) => void
  find: (name: string, namespace: string) => Result<T>
  delete: (name: string, namespace: string) => Result<T>
  update: (
    name: string,
    namespace: string,
    updateFn: (resource: T) => T
  ) => Result<T>
}

type NodeFacadeMethods = {
  getAll: () => Node[]
  add: (node: Node) => void
  find: (name: string) => Result<Node>
  delete: (name: string) => Result<Node>
  update: (name: string, updateFn: (node: Node) => Node) => Result<Node>
}

type NamespaceFacadeMethods = {
  getAll: () => Namespace[]
  add: (namespace: Namespace) => void
  find: (name: string) => Result<Namespace>
  delete: (name: string) => Result<Namespace>
  update: (
    name: string,
    updateFn: (namespace: Namespace) => Namespace
  ) => Result<Namespace>
}

type KindHandlers = {
  find: (name: string, effectiveNs: string) => Result<KubernetesResource>
  list: (ns?: string) => KubernetesResource[]
  create: (resource: KubernetesResource) => void
  update: (
    name: string,
    resource: KubernetesResource,
    effectiveNs: string
  ) => Result<KubernetesResource>
  delete: (name: string, effectiveNs: string) => Result<KubernetesResource>
}

const buildNamespacedKindHandlers = <T extends KubernetesResource>(
  m: NamespacedFacade<T>
): KindHandlers => ({
  find: (name, ns) => m.find(name, ns) as Result<KubernetesResource>,
  list: (ns) => m.getAll(ns) as KubernetesResource[],
  create: (r) => {
    m.add(r as T)
  },
  update: (name, r, ns) =>
    m.update(name, ns, () => r as T) as Result<KubernetesResource>,
  delete: (name, ns) => m.delete(name, ns) as Result<KubernetesResource>
})

const buildClusterScopedKindHandlers = <T extends KubernetesResource>(
  m: NamespacedFacade<T>
): KindHandlers => ({
  find: (name) => m.find(name, '') as Result<KubernetesResource>,
  list: () => m.getAll(undefined) as KubernetesResource[],
  create: (r) => {
    m.add(r as T)
  },
  update: (name, r) =>
    m.update(name, '', () => r as T) as Result<KubernetesResource>,
  delete: (name) => m.delete(name, '') as Result<KubernetesResource>
})

const buildNodeKindHandlers = (m: NodeFacadeMethods): KindHandlers => ({
  find: (name) => m.find(name) as Result<KubernetesResource>,
  list: () => m.getAll() as KubernetesResource[],
  create: (r) => {
    m.add(r as Node)
  },
  update: (name, r) =>
    m.update(name, () => r as Node) as Result<KubernetesResource>,
  delete: (name, _effectiveNs) =>
    m.delete(name) as Result<KubernetesResource>
})

const buildNamespaceKindHandlers = (
  m: NamespaceFacadeMethods
): KindHandlers => ({
  find: (name) => m.find(name) as Result<KubernetesResource>,
  list: () => m.getAll() as KubernetesResource[],
  create: (r) => {
    m.add(r as Namespace)
  },
  update: (name, r) =>
    m.update(name, () => r as Namespace) as Result<KubernetesResource>,
  delete: (name, _effectiveNs) =>
    m.delete(name) as Result<KubernetesResource>
})

function bindStandardEntityMethods<T extends KubernetesResource>(
  singular: string,
  plural: string,
  m: NamespacedFacade<T>
): Record<string, unknown> {
  return {
    [`get${plural}`]: m.getAll,
    [`add${singular}`]: m.add,
    [`find${singular}`]: m.find,
    [`delete${singular}`]: m.delete,
    [`update${singular}`]: m.update
  }
}

function bindClusterScopedEntityMethods<T extends KubernetesResource>(
  singular: string,
  plural: string,
  m: NamespacedFacade<T>
): Record<string, unknown> {
  return {
    [`get${plural}`]: () => m.getAll(undefined),
    [`add${singular}`]: m.add,
    [`find${singular}`]: (name: string) => m.find(name, ''),
    [`delete${singular}`]: (name: string) => m.delete(name, ''),
    [`update${singular}`]: (
      name: string,
      updateFn: (resource: T) => T
    ) => m.update(name, '', updateFn)
  }
}

function bindNodeEntityMethods(m: NodeFacadeMethods): Record<string, unknown> {
  return {
    getNodes: m.getAll,
    addNode: m.add,
    findNode: m.find,
    deleteNode: m.delete,
    updateNode: m.update
  }
}

function bindNamespaceEntityMethods(
  m: NamespaceFacadeMethods
): Record<string, unknown> {
  return {
    getNamespaces: m.getAll,
    addNamespace: m.add,
    findNamespace: m.find,
    deleteNamespace: m.delete,
    updateNamespace: m.update
  }
}

export function createClusterState(
  eventBus: EventBus,
  options?: CreateClusterStateOptions
): ClusterState {
  let state: ClusterStateData = createEmptyState()

  const getState = () => state
  const setState = (newState: ClusterStateData) => {
    state = newState
  }

  eventBus.subscribeAll((event) => {
    state = applyClusterEventToState(state, event as ClusterEvent)
  })

  const mk = <T extends KubernetesResource>(
    ops: ResourceOperations<T>,
    kind: EventFactoryKind
  ) => createFacadeMethods(ops, getState, setState, eventBus, kind)

  const generatedFacadeMethodsByKind = Object.fromEntries(
    (Object.keys(COLLECTION_KEY_BY_RESOURCE_KIND) as ResourceKind[])
      .filter((kind) => {
        return kind !== 'Node' && kind !== 'Namespace'
      })
      .map((kind) => {
        const collectionKey = COLLECTION_KEY_BY_RESOURCE_KIND[kind]
        return [
          kind,
          mk(
            resourceOps[collectionKey] as unknown as ResourceOperations<KubernetesResource>,
            kind
          )
        ]
      })
  ) as Record<ResourceKind, NamespacedFacade<KubernetesResource>>

  const namespaceOps = resourceOps.namespaces
  const nodeOps = resourceOps.nodes

  const namespaceMethods: NamespaceFacadeMethods = {
    getAll: () => namespaceOps.getAll(getState(), undefined),
    add: (namespace: Namespace) => {
      eventBus.emit(EVENT_FACTORIES.Namespace.created(namespace, 'direct'))
    },
    find: (name: string): Result<Namespace> => {
      return namespaceOps.find(getState(), name, '')
    },
    delete: (name: string): Result<Namespace> => {
      const findResult = namespaceOps.find(getState(), name, '')
      if (!findResult.ok) {
        return findResult
      }
      eventBus.emit(
        EVENT_FACTORIES.Namespace.deleted(name, findResult.value, 'direct')
      )
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
        EVENT_FACTORIES.Namespace.updated(
          name,
          updatedNamespace,
          findResult.value,
          'direct'
        )
      )
      return { ok: true, value: updatedNamespace }
    }
  }

  const nodeMethods: NodeFacadeMethods = {
    getAll: () => nodeOps.getAll(getState(), undefined),
    add: (node: Node) => {
      eventBus.emit(EVENT_FACTORIES.Node.created(node, 'direct'))
    },
    find: (name: string): Result<Node> => {
      return nodeOps.find(getState(), name, '')
    },
    delete: (name: string): Result<Node> => {
      const findResult = nodeOps.find(getState(), name, '')
      if (!findResult.ok) {
        return findResult
      }
      eventBus.emit(
        EVENT_FACTORIES.Node.deleted(name, findResult.value, 'direct')
      )
      return { ok: true, value: findResult.value }
    },
    update: (name: string, updateFn: (node: Node) => Node): Result<Node> => {
      const findResult = nodeOps.find(getState(), name, '')
      if (!findResult.ok) {
        return findResult
      }
      const updatedNode = updateFn(findResult.value)
      eventBus.emit(
        EVENT_FACTORIES.Node.updated(
          name,
          updatedNode,
          findResult.value,
          'direct'
        )
      )
      return { ok: true, value: updatedNode }
    }
  }

  const generatedKindHandlers = Object.fromEntries(
    (Object.keys(COLLECTION_KEY_BY_RESOURCE_KIND) as ResourceKind[])
      .filter((kind) => {
        return kind !== 'Node' && kind !== 'Namespace'
      })
      .map((kind) => {
        const methods = generatedFacadeMethodsByKind[kind]
        const handler = (CLUSTER_SCOPED_RESOURCE_KINDS as readonly ResourceKind[]).includes(
          kind
        )
          ? buildClusterScopedKindHandlers(methods)
          : buildNamespacedKindHandlers(methods)
        return [kind, handler]
      })
  ) as Partial<Record<ResourceKind, KindHandlers>>

  const KIND_HANDLERS: Record<ResourceKind, KindHandlers> = {
    ...generatedKindHandlers,
    Node: buildNodeKindHandlers(nodeMethods),
    Namespace: buildNamespaceKindHandlers(namespaceMethods)
  } as Record<ResourceKind, KindHandlers>

  const findByKind = <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ): Result<KindToResource<TKind>> => {
    const effectiveNamespace = namespace ?? 'default'
    const handler = KIND_HANDLERS[kind]
    if (!handler) {
      return { ok: false, error: `Unsupported resource kind: ${kind}` }
    }
    return handler.find(
      name,
      effectiveNamespace
    ) as Result<KindToResource<TKind>>
  }

  const listByKind = <TKind extends ResourceKind>(
    kind: TKind,
    namespace?: string
  ): KindToResource<TKind>[] => {
    const handler = KIND_HANDLERS[kind]
    if (!handler) {
      return []
    }
    return handler.list(namespace) as KindToResource<TKind>[]
  }

  const createByKind = <TKind extends ResourceKind>(
    kind: TKind,
    resource: KindToResource<TKind>
  ): Result<KindToResource<TKind>> => {
    const handler = KIND_HANDLERS[kind]
    if (!handler) {
      return { ok: false, error: `Unsupported resource kind: ${kind}` }
    }
    handler.create(resource as KubernetesResource)
    return { ok: true, value: resource }
  }

  const updateByKind = <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    resource: KindToResource<TKind>,
    namespace?: string
  ): Result<KindToResource<TKind>> => {
    const handler = KIND_HANDLERS[kind]
    if (!handler) {
      return { ok: false, error: `Unsupported resource kind: ${kind}` }
    }
    const effectiveNamespace =
      namespace ?? resource.metadata.namespace ?? 'default'
    return handler.update(
      name,
      resource as KubernetesResource,
      effectiveNamespace
    ) as Result<KindToResource<TKind>>
  }

  const deleteByKind = <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ): Result<KindToResource<TKind>> => {
    const handler = KIND_HANDLERS[kind]
    if (!handler) {
      return { ok: false, error: `Unsupported resource kind: ${kind}` }
    }
    const effectiveNamespace = namespace ?? 'default'
    return handler.delete(
      name,
      effectiveNamespace
    ) as Result<KindToResource<TKind>>
  }

  const generatedFacadeBindings: Record<string, unknown> = {}
  for (const kind of Object.keys(COLLECTION_KEY_BY_RESOURCE_KIND) as ResourceKind[]) {
    if (kind === 'Node' || kind === 'Namespace') {
      continue
    }
    const methods = generatedFacadeMethodsByKind[kind]
    const singular = RESOURCE_FACADE_NAMES_BY_KIND[kind].singular
    const plural = RESOURCE_FACADE_NAMES_BY_KIND[kind].plural
    const isClusterScoped = (CLUSTER_SCOPED_RESOURCE_KINDS as readonly ResourceKind[]).includes(
      kind
    )
    const bound = isClusterScoped
      ? bindClusterScopedEntityMethods(singular, plural, methods)
      : bindStandardEntityMethods(singular, plural, methods)
    Object.assign(generatedFacadeBindings, bound)
  }

  const clusterStateFacade = Object.assign(
    {},
    generatedFacadeBindings,
    bindNodeEntityMethods(nodeMethods),
    bindNamespaceEntityMethods(namespaceMethods),
    {
      findByKind,
      listByKind,
      createByKind,
      updateByKind,
      deleteByKind,
      toJSON: (): ClusterStateData => {
        const snapshot = {} as Record<
          keyof ClusterStateData,
          ResourceCollection<KubernetesResource>
        >
        for (const key of CLUSTER_DATA_KEYS) {
          const col = state[key]
          snapshot[key] = {
            items: [...col.items]
          } as ResourceCollection<KubernetesResource>
        }
        return snapshot as ClusterStateData
      },
      loadState: (newState: ClusterStateData) => {
        const next = {} as Record<
          keyof ClusterStateData,
          ResourceCollection<KubernetesResource>
        >
        for (const key of CLUSTER_DATA_KEYS) {
          next[key] = (newState[key] ?? {
            items: []
          }) as ResourceCollection<KubernetesResource>
        }
        state = next as ClusterStateData
      }
    }
  ) as ClusterState

  if (options?.bootstrap) {
    applyClusterBootstrap(clusterStateFacade, options.bootstrap)
  }

  return clusterStateFacade
}
