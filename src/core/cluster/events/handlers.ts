import type { ClusterStateData } from '../ClusterState'
import { addPod, deletePod, updatePod } from '../ClusterState'
import { createResourceRepository } from '../repositories/resourceRepository'
import type { ResourceCollection } from '../repositories/types'
import type { ConfigMap } from '../ressources/ConfigMap'
import type { ControllerRevision } from '../ressources/ControllerRevision'
import type { DaemonSet } from '../ressources/DaemonSet'
import type { Deployment } from '../ressources/Deployment'
import type { EndpointSlice } from '../ressources/EndpointSlice'
import type { Endpoints } from '../ressources/Endpoints'
import type { Ingress } from '../ressources/Ingress'
import type { Lease } from '../ressources/Lease'
import type { Namespace } from '../ressources/Namespace'
import type { Node } from '../ressources/Node'
import type { PersistentVolume } from '../ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../ressources/PersistentVolumeClaim'
import type { Pod } from '../ressources/Pod'
import type { ReplicaSet } from '../ressources/ReplicaSet'
import type { Secret } from '../ressources/Secret'
import type { StorageClass } from '../ressources/StorageClass'
import type { Service } from '../ressources/Service'
import type { StatefulSet } from '../ressources/StatefulSet'
import type {
  ClusterEvent,
  ConfigMapAnnotatedEvent,
  ConfigMapCreatedEvent,
  ConfigMapDeletedEvent,
  ConfigMapLabeledEvent,
  ConfigMapUpdatedEvent,
  ControllerRevisionCreatedEvent,
  ControllerRevisionDeletedEvent,
  ControllerRevisionUpdatedEvent,
  DaemonSetCreatedEvent,
  DaemonSetDeletedEvent,
  DaemonSetUpdatedEvent,
  DeploymentCreatedEvent,
  DeploymentDeletedEvent,
  DeploymentUpdatedEvent,
  EndpointSliceCreatedEvent,
  EndpointSliceDeletedEvent,
  EndpointSliceUpdatedEvent,
  EndpointsCreatedEvent,
  EndpointsDeletedEvent,
  EndpointsUpdatedEvent,
  IngressCreatedEvent,
  IngressDeletedEvent,
  IngressUpdatedEvent,
  LeaseCreatedEvent,
  LeaseDeletedEvent,
  LeaseUpdatedEvent,
  NamespaceCreatedEvent,
  NamespaceDeletedEvent,
  NamespaceUpdatedEvent,
  NodeCreatedEvent,
  NodeDeletedEvent,
  NodeUpdatedEvent,
  PodAnnotatedEvent,
  PodCreatedEvent,
  PodDeletedEvent,
  PodLabeledEvent,
  PodUpdatedEvent,
  PersistentVolumeClaimCreatedEvent,
  PersistentVolumeClaimDeletedEvent,
  PersistentVolumeClaimUpdatedEvent,
  PersistentVolumeCreatedEvent,
  PersistentVolumeDeletedEvent,
  PersistentVolumeUpdatedEvent,
  ReplicaSetCreatedEvent,
  ReplicaSetDeletedEvent,
  ReplicaSetUpdatedEvent,
  SecretAnnotatedEvent,
  SecretCreatedEvent,
  SecretDeletedEvent,
  SecretLabeledEvent,
  SecretUpdatedEvent,
  StorageClassCreatedEvent,
  StorageClassDeletedEvent,
  StorageClassUpdatedEvent,
  ServiceAnnotatedEvent,
  ServiceCreatedEvent,
  ServiceDeletedEvent,
  ServiceLabeledEvent,
  ServiceUpdatedEvent,
  StatefulSetCreatedEvent,
  StatefulSetDeletedEvent,
  StatefulSetUpdatedEvent
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
// Pure functions that apply events to cluster state.
// Each handler takes current state + event and returns new state.

// ─── Repositories ────────────────────────────────────────────────────────

const configMapRepo = createResourceRepository<ConfigMap>('ConfigMap')
const controllerRevisionRepo =
  createResourceRepository<ControllerRevision>('ControllerRevision')
const secretRepo = createResourceRepository<Secret>('Secret')
const replicaSetRepo = createResourceRepository<ReplicaSet>('ReplicaSet')
const deploymentRepo = createResourceRepository<Deployment>('Deployment')
const endpointSliceRepo =
  createResourceRepository<EndpointSlice>('EndpointSlice')
const endpointsRepo = createResourceRepository<Endpoints>('Endpoints')
const daemonSetRepo = createResourceRepository<DaemonSet>('DaemonSet')
const statefulSetRepo = createResourceRepository<StatefulSet>('StatefulSet')
const serviceRepo = createResourceRepository<Service>('Service')
const ingressRepo = createResourceRepository<Ingress>('Ingress')
const leaseRepo = createResourceRepository<Lease>('Lease')
const namespaceRepo = createResourceRepository<Namespace>('Namespace')
const nodeRepo = createResourceRepository<Node>('Node')
const persistentVolumeRepo =
  createResourceRepository<PersistentVolume>('PersistentVolume')
const persistentVolumeClaimRepo =
  createResourceRepository<PersistentVolumeClaim>('PersistentVolumeClaim')

// ─── Generic Handler Factories ───────────────────────────────────────────

/**
 * Factory: Create handler for repository-based resources (ConfigMap, Secret)
 */
type RepoStateKey =
  | 'configMaps'
  | 'controllerRevisions'
  | 'secrets'
  | 'replicaSets'
  | 'deployments'
  | 'daemonSets'
  | 'statefulSets'
  | 'services'
  | 'endpointSlices'
  | 'endpoints'
  | 'ingresses'
  | 'leases'
  | 'namespaces'
  | 'nodes'
  | 'persistentVolumes'
  | 'persistentVolumeClaims'
  | 'storageClasses'

type RepoResourceByStateKey = {
  configMaps: ConfigMap
  controllerRevisions: ControllerRevision
  secrets: Secret
  replicaSets: ReplicaSet
  deployments: Deployment
  daemonSets: DaemonSet
  statefulSets: StatefulSet
  services: Service
  endpointSlices: EndpointSlice
  endpoints: Endpoints
  ingresses: Ingress
  leases: Lease
  namespaces: Namespace
  nodes: Node
  persistentVolumes: PersistentVolume
  persistentVolumeClaims: PersistentVolumeClaim
  storageClasses: StorageClass
}

type RepoCollectionByStateKey = {
  [TKey in RepoStateKey]: ResourceCollection<RepoResourceByStateKey[TKey]>
}

const createRepoHandler = <TKey extends RepoStateKey>(
  repo: ReturnType<
    typeof createResourceRepository<RepoResourceByStateKey[TKey]>
  >,
  stateKey: TKey
) => ({
  created: (
    state: ClusterStateData,
    resource: RepoResourceByStateKey[TKey]
  ) => {
    const collection = repo.add(
      state[stateKey] as RepoCollectionByStateKey[TKey],
      resource
    )
    return { ...state, [stateKey]: collection }
  },

  deleted: (state: ClusterStateData, name: string, namespace: string) => {
    const result = repo.remove(
      state[stateKey] as RepoCollectionByStateKey[TKey],
      name,
      namespace
    )
    return result.ok && result.collection
      ? { ...state, [stateKey]: result.collection }
      : state
  },

  updated: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    resource: RepoResourceByStateKey[TKey]
  ) => {
    const result = repo.update(
      state[stateKey] as RepoCollectionByStateKey[TKey],
      name,
      namespace,
      () => resource
    )
    return result.ok && result.collection
      ? { ...state, [stateKey]: result.collection }
      : state
  }
})

/**
 * Factory: Create handler for Pod operations
 */
const createPodHandler = () => ({
  created: (state: ClusterStateData, pod: Pod) => addPod(state, pod),

  deleted: (state: ClusterStateData, name: string, namespace: string) => {
    const result = deletePod(state, name, namespace)
    return result.ok && result.state ? result.state : state
  },

  updated: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    pod: Pod
  ) => {
    const result = updatePod(state, name, namespace, () => pod)
    return result.ok && result.state ? result.state : state
  }
})

// ─── Handler Instances ───────────────────────────────────────────────────

const podHandler = createPodHandler()
const configMapHandler = createRepoHandler(configMapRepo, 'configMaps')
const controllerRevisionHandler = createRepoHandler(
  controllerRevisionRepo,
  'controllerRevisions'
)
const secretHandler = createRepoHandler(secretRepo, 'secrets')
const replicaSetHandler = createRepoHandler(replicaSetRepo, 'replicaSets')
const deploymentHandler = createRepoHandler(deploymentRepo, 'deployments')
const daemonSetHandler = createRepoHandler(daemonSetRepo, 'daemonSets')
const statefulSetHandler = createRepoHandler(statefulSetRepo, 'statefulSets')
const serviceHandler = createRepoHandler(serviceRepo, 'services')
const endpointSliceHandler = createRepoHandler(
  endpointSliceRepo,
  'endpointSlices'
)
const endpointsHandler = createRepoHandler(endpointsRepo, 'endpoints')
const ingressHandler = createRepoHandler(ingressRepo, 'ingresses')
const leaseHandler = createRepoHandler(leaseRepo, 'leases')
const namespaceHandler = createRepoHandler(namespaceRepo, 'namespaces')
const nodeHandler = createRepoHandler(nodeRepo, 'nodes')
const persistentVolumeHandler = createRepoHandler(
  persistentVolumeRepo,
  'persistentVolumes'
)
const persistentVolumeClaimHandler = createRepoHandler(
  persistentVolumeClaimRepo,
  'persistentVolumeClaims'
)
const storageClassRepo = createResourceRepository<StorageClass>('StorageClass')
const storageClassHandler = createRepoHandler(
  storageClassRepo,
  'storageClasses'
)

// ─── Pod Handlers ────────────────────────────────────────────────────────

export const handlePodCreated = (
  state: ClusterStateData,
  event: PodCreatedEvent
) => {
  return podHandler.created(state, event.payload.pod)
}

export const handlePodDeleted = (
  state: ClusterStateData,
  event: PodDeletedEvent
) => podHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handlePodUpdated = (
  state: ClusterStateData,
  event: PodUpdatedEvent
) =>
  podHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.pod
  )

export const handlePodLabeled = (
  state: ClusterStateData,
  event: PodLabeledEvent
) =>
  podHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.pod
  )

export const handlePodAnnotated = (
  state: ClusterStateData,
  event: PodAnnotatedEvent
) =>
  podHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.pod
  )

// ─── ConfigMap Handlers ──────────────────────────────────────────────────

export const handleConfigMapCreated = (
  state: ClusterStateData,
  event: ConfigMapCreatedEvent
) => configMapHandler.created(state, event.payload.configMap)

export const handleConfigMapDeleted = (
  state: ClusterStateData,
  event: ConfigMapDeletedEvent
) =>
  configMapHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleConfigMapUpdated = (
  state: ClusterStateData,
  event: ConfigMapUpdatedEvent
) =>
  configMapHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.configMap
  )

export const handleConfigMapLabeled = (
  state: ClusterStateData,
  event: ConfigMapLabeledEvent
) =>
  configMapHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.configMap
  )

export const handleConfigMapAnnotated = (
  state: ClusterStateData,
  event: ConfigMapAnnotatedEvent
) =>
  configMapHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.configMap
  )

export const handleControllerRevisionCreated = (
  state: ClusterStateData,
  event: ControllerRevisionCreatedEvent
) => controllerRevisionHandler.created(state, event.payload.controllerRevision)

export const handleControllerRevisionDeleted = (
  state: ClusterStateData,
  event: ControllerRevisionDeletedEvent
) =>
  controllerRevisionHandler.deleted(
    state,
    event.payload.name,
    event.payload.namespace
  )

export const handleControllerRevisionUpdated = (
  state: ClusterStateData,
  event: ControllerRevisionUpdatedEvent
) =>
  controllerRevisionHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.controllerRevision
  )

// ─── Secret Handlers ─────────────────────────────────────────────────────

export const handleSecretCreated = (
  state: ClusterStateData,
  event: SecretCreatedEvent
) => secretHandler.created(state, event.payload.secret)

export const handleSecretDeleted = (
  state: ClusterStateData,
  event: SecretDeletedEvent
) => secretHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleSecretUpdated = (
  state: ClusterStateData,
  event: SecretUpdatedEvent
) =>
  secretHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.secret
  )

export const handleSecretLabeled = (
  state: ClusterStateData,
  event: SecretLabeledEvent
) =>
  secretHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.secret
  )

export const handleSecretAnnotated = (
  state: ClusterStateData,
  event: SecretAnnotatedEvent
) =>
  secretHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.secret
  )

// ─── ReplicaSet Handlers ──────────────────────────────────────────────────

export const handleReplicaSetCreated = (
  state: ClusterStateData,
  event: ReplicaSetCreatedEvent
) => replicaSetHandler.created(state, event.payload.replicaSet)

export const handleReplicaSetDeleted = (
  state: ClusterStateData,
  event: ReplicaSetDeletedEvent
) =>
  replicaSetHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleReplicaSetUpdated = (
  state: ClusterStateData,
  event: ReplicaSetUpdatedEvent
) =>
  replicaSetHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.replicaSet
  )

// ─── Deployment Handlers ──────────────────────────────────────────────────

export const handleDeploymentCreated = (
  state: ClusterStateData,
  event: DeploymentCreatedEvent
) => deploymentHandler.created(state, event.payload.deployment)

export const handleDeploymentDeleted = (
  state: ClusterStateData,
  event: DeploymentDeletedEvent
) =>
  deploymentHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleDeploymentUpdated = (
  state: ClusterStateData,
  event: DeploymentUpdatedEvent
) =>
  deploymentHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.deployment
  )

export const handleDaemonSetCreated = (
  state: ClusterStateData,
  event: DaemonSetCreatedEvent
) => daemonSetHandler.created(state, event.payload.daemonSet)

export const handleDaemonSetDeleted = (
  state: ClusterStateData,
  event: DaemonSetDeletedEvent
) =>
  daemonSetHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleDaemonSetUpdated = (
  state: ClusterStateData,
  event: DaemonSetUpdatedEvent
) =>
  daemonSetHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.daemonSet
  )

export const handleStatefulSetCreated = (
  state: ClusterStateData,
  event: StatefulSetCreatedEvent
) => statefulSetHandler.created(state, event.payload.statefulSet)

export const handleStatefulSetDeleted = (
  state: ClusterStateData,
  event: StatefulSetDeletedEvent
) =>
  statefulSetHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleStatefulSetUpdated = (
  state: ClusterStateData,
  event: StatefulSetUpdatedEvent
) =>
  statefulSetHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.statefulSet
  )

// ─── Service Handlers ──────────────────────────────────────────────────────

export const handleServiceCreated = (
  state: ClusterStateData,
  event: ServiceCreatedEvent
) => serviceHandler.created(state, event.payload.service)

export const handleServiceDeleted = (
  state: ClusterStateData,
  event: ServiceDeletedEvent
) => serviceHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleServiceUpdated = (
  state: ClusterStateData,
  event: ServiceUpdatedEvent
) =>
  serviceHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.service
  )

export const handleServiceLabeled = (
  state: ClusterStateData,
  event: ServiceLabeledEvent
) =>
  serviceHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.service
  )

export const handleServiceAnnotated = (
  state: ClusterStateData,
  event: ServiceAnnotatedEvent
) =>
  serviceHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.service
  )

export const handleEndpointsCreated = (
  state: ClusterStateData,
  event: EndpointsCreatedEvent
) => endpointsHandler.created(state, event.payload.endpoints)

export const handleEndpointsDeleted = (
  state: ClusterStateData,
  event: EndpointsDeletedEvent
) =>
  endpointsHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleEndpointsUpdated = (
  state: ClusterStateData,
  event: EndpointsUpdatedEvent
) =>
  endpointsHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.endpoints
  )

export const handleEndpointSliceCreated = (
  state: ClusterStateData,
  event: EndpointSliceCreatedEvent
) => endpointSliceHandler.created(state, event.payload.endpointSlice)

export const handleEndpointSliceDeleted = (
  state: ClusterStateData,
  event: EndpointSliceDeletedEvent
) =>
  endpointSliceHandler.deleted(
    state,
    event.payload.name,
    event.payload.namespace
  )

export const handleEndpointSliceUpdated = (
  state: ClusterStateData,
  event: EndpointSliceUpdatedEvent
) =>
  endpointSliceHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.endpointSlice
  )

export const handleIngressCreated = (
  state: ClusterStateData,
  event: IngressCreatedEvent
) => ingressHandler.created(state, event.payload.ingress)

export const handleIngressDeleted = (
  state: ClusterStateData,
  event: IngressDeletedEvent
) => ingressHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleIngressUpdated = (
  state: ClusterStateData,
  event: IngressUpdatedEvent
) =>
  ingressHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.ingress
  )

export const handleLeaseCreated = (
  state: ClusterStateData,
  event: LeaseCreatedEvent
) => leaseHandler.created(state, event.payload.lease)

export const handleLeaseDeleted = (
  state: ClusterStateData,
  event: LeaseDeletedEvent
) => leaseHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handleLeaseUpdated = (
  state: ClusterStateData,
  event: LeaseUpdatedEvent
) =>
  leaseHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.lease
  )

export const handleNamespaceCreated = (
  state: ClusterStateData,
  event: NamespaceCreatedEvent
) => namespaceHandler.created(state, event.payload.namespace)

export const handleNamespaceDeleted = (
  state: ClusterStateData,
  event: NamespaceDeletedEvent
) => namespaceHandler.deleted(state, event.payload.name, '')

export const handleNamespaceUpdated = (
  state: ClusterStateData,
  event: NamespaceUpdatedEvent
) =>
  namespaceHandler.updated(
    state,
    event.payload.name,
    '',
    event.payload.namespace
  )

export const handleNodeCreated = (
  state: ClusterStateData,
  event: NodeCreatedEvent
) => nodeHandler.created(state, event.payload.node)

export const handleNodeDeleted = (
  state: ClusterStateData,
  event: NodeDeletedEvent
) => nodeHandler.deleted(state, event.payload.name, '')

export const handleNodeUpdated = (
  state: ClusterStateData,
  event: NodeUpdatedEvent
) => nodeHandler.updated(state, event.payload.name, '', event.payload.node)

export const handlePersistentVolumeCreated = (
  state: ClusterStateData,
  event: PersistentVolumeCreatedEvent
) => persistentVolumeHandler.created(state, event.payload.persistentVolume)

export const handlePersistentVolumeDeleted = (
  state: ClusterStateData,
  event: PersistentVolumeDeletedEvent
) => persistentVolumeHandler.deleted(state, event.payload.name, '')

export const handlePersistentVolumeUpdated = (
  state: ClusterStateData,
  event: PersistentVolumeUpdatedEvent
) =>
  persistentVolumeHandler.updated(
    state,
    event.payload.name,
    '',
    event.payload.persistentVolume
  )

export const handlePersistentVolumeClaimCreated = (
  state: ClusterStateData,
  event: PersistentVolumeClaimCreatedEvent
) =>
  persistentVolumeClaimHandler.created(
    state,
    event.payload.persistentVolumeClaim
  )

export const handlePersistentVolumeClaimDeleted = (
  state: ClusterStateData,
  event: PersistentVolumeClaimDeletedEvent
) =>
  persistentVolumeClaimHandler.deleted(
    state,
    event.payload.name,
    event.payload.namespace
  )

export const handlePersistentVolumeClaimUpdated = (
  state: ClusterStateData,
  event: PersistentVolumeClaimUpdatedEvent
) =>
  persistentVolumeClaimHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.persistentVolumeClaim
  )

export const handleStorageClassCreated = (
  state: ClusterStateData,
  event: StorageClassCreatedEvent
) => storageClassHandler.created(state, event.payload.storageClass)

export const handleStorageClassDeleted = (
  state: ClusterStateData,
  event: StorageClassDeletedEvent
) => storageClassHandler.deleted(state, event.payload.name, '')

export const handleStorageClassUpdated = (
  state: ClusterStateData,
  event: StorageClassUpdatedEvent
) =>
  storageClassHandler.updated(
    state,
    event.payload.name,
    '',
    event.payload.storageClass
  )

type ClusterEventType = ClusterEvent['type']
type ClusterEventByType = {
  [TType in ClusterEventType]: Extract<ClusterEvent, { type: TType }>
}
type ClusterEventHandler<TType extends ClusterEventType> = (
  state: ClusterStateData,
  event: ClusterEventByType[TType]
) => ClusterStateData

/**
 * Event handler map for dispatching events to handlers
 * Using object lookup pattern instead of switch
 */
export const CLUSTER_EVENT_HANDLERS: {
  [TType in ClusterEventType]?: ClusterEventHandler<TType>
} = {
  PodCreated: handlePodCreated,
  PodDeleted: handlePodDeleted,
  PodUpdated: handlePodUpdated,
  ConfigMapCreated: handleConfigMapCreated,
  ConfigMapDeleted: handleConfigMapDeleted,
  ConfigMapUpdated: handleConfigMapUpdated,
  ControllerRevisionCreated: handleControllerRevisionCreated,
  ControllerRevisionDeleted: handleControllerRevisionDeleted,
  ControllerRevisionUpdated: handleControllerRevisionUpdated,
  SecretCreated: handleSecretCreated,
  SecretDeleted: handleSecretDeleted,
  SecretUpdated: handleSecretUpdated,
  ReplicaSetCreated: handleReplicaSetCreated,
  ReplicaSetDeleted: handleReplicaSetDeleted,
  ReplicaSetUpdated: handleReplicaSetUpdated,
  DeploymentCreated: handleDeploymentCreated,
  DeploymentDeleted: handleDeploymentDeleted,
  DeploymentUpdated: handleDeploymentUpdated,
  DaemonSetCreated: handleDaemonSetCreated,
  DaemonSetDeleted: handleDaemonSetDeleted,
  DaemonSetUpdated: handleDaemonSetUpdated,
  StatefulSetCreated: handleStatefulSetCreated,
  StatefulSetDeleted: handleStatefulSetDeleted,
  StatefulSetUpdated: handleStatefulSetUpdated,
  PodLabeled: handlePodLabeled,
  ConfigMapLabeled: handleConfigMapLabeled,
  SecretLabeled: handleSecretLabeled,
  PodAnnotated: handlePodAnnotated,
  ConfigMapAnnotated: handleConfigMapAnnotated,
  SecretAnnotated: handleSecretAnnotated,
  ServiceCreated: handleServiceCreated,
  ServiceDeleted: handleServiceDeleted,
  ServiceUpdated: handleServiceUpdated,
  EndpointsCreated: handleEndpointsCreated,
  EndpointsDeleted: handleEndpointsDeleted,
  EndpointsUpdated: handleEndpointsUpdated,
  EndpointSliceCreated: handleEndpointSliceCreated,
  EndpointSliceDeleted: handleEndpointSliceDeleted,
  EndpointSliceUpdated: handleEndpointSliceUpdated,
  ServiceLabeled: handleServiceLabeled,
  ServiceAnnotated: handleServiceAnnotated,
  IngressCreated: handleIngressCreated,
  IngressDeleted: handleIngressDeleted,
  IngressUpdated: handleIngressUpdated,
  NamespaceCreated: handleNamespaceCreated,
  NamespaceDeleted: handleNamespaceDeleted,
  NamespaceUpdated: handleNamespaceUpdated,
  NodeCreated: handleNodeCreated,
  NodeDeleted: handleNodeDeleted,
  NodeUpdated: handleNodeUpdated,
  PersistentVolumeCreated: handlePersistentVolumeCreated,
  PersistentVolumeDeleted: handlePersistentVolumeDeleted,
  PersistentVolumeUpdated: handlePersistentVolumeUpdated,
  PersistentVolumeClaimCreated: handlePersistentVolumeClaimCreated,
  PersistentVolumeClaimDeleted: handlePersistentVolumeClaimDeleted,
  PersistentVolumeClaimUpdated: handlePersistentVolumeClaimUpdated,
  StorageClassCreated: handleStorageClassCreated,
  StorageClassDeleted: handleStorageClassDeleted,
  StorageClassUpdated: handleStorageClassUpdated,
  LeaseCreated: handleLeaseCreated,
  LeaseDeleted: handleLeaseDeleted,
  LeaseUpdated: handleLeaseUpdated
}

/**
 * Apply event to cluster state
 * Dispatches to appropriate handler based on event type
 */
export const applyClusterEventToState = (
  state: ClusterStateData,
  event: ClusterEvent
): ClusterStateData => {
  const handler = CLUSTER_EVENT_HANDLERS[event.type] as
    | ClusterEventHandler<ClusterEventType>
    | undefined
  if (!handler) {
    return state
  }
  return handler(state, event)
}
