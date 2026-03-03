import type { ClusterStateData } from '../ClusterState'
import { addPod, deletePod, updatePod } from '../ClusterState'
import { createResourceRepository } from '../repositories/resourceRepository'
import type { ConfigMap } from '../ressources/ConfigMap'
import type { DaemonSet } from '../ressources/DaemonSet'
import type { Deployment } from '../ressources/Deployment'
import type { PersistentVolume } from '../ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../ressources/PersistentVolumeClaim'
import type { ReplicaSet } from '../ressources/ReplicaSet'
import type { Secret } from '../ressources/Secret'
import type { Service } from '../ressources/Service'
import type {
  ConfigMapAnnotatedEvent,
  ConfigMapCreatedEvent,
  ConfigMapDeletedEvent,
  ConfigMapLabeledEvent,
  ConfigMapUpdatedEvent,
  DaemonSetCreatedEvent,
  DaemonSetDeletedEvent,
  DaemonSetUpdatedEvent,
  DeploymentCreatedEvent,
  DeploymentDeletedEvent,
  DeploymentUpdatedEvent,
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
  ServiceAnnotatedEvent,
  ServiceCreatedEvent,
  ServiceDeletedEvent,
  ServiceLabeledEvent,
  ServiceUpdatedEvent
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
// Pure functions that apply events to cluster state.
// Each handler takes current state + event and returns new state.

// ─── Repositories ────────────────────────────────────────────────────────

const configMapRepo = createResourceRepository<ConfigMap>('ConfigMap')
const secretRepo = createResourceRepository<Secret>('Secret')
const replicaSetRepo = createResourceRepository<ReplicaSet>('ReplicaSet')
const deploymentRepo = createResourceRepository<Deployment>('Deployment')
const daemonSetRepo = createResourceRepository<DaemonSet>('DaemonSet')
const serviceRepo = createResourceRepository<Service>('Service')
const persistentVolumeRepo =
  createResourceRepository<PersistentVolume>('PersistentVolume')
const persistentVolumeClaimRepo =
  createResourceRepository<PersistentVolumeClaim>('PersistentVolumeClaim')

// ─── Generic Handler Factories ───────────────────────────────────────────

/**
 * Factory: Create handler for repository-based resources (ConfigMap, Secret)
 */
const createRepoHandler = <T>(
  repo: any,
  stateKey:
    | 'configMaps'
    | 'secrets'
    | 'replicaSets'
    | 'deployments'
    | 'daemonSets'
    | 'services'
    | 'persistentVolumes'
    | 'persistentVolumeClaims'
) => ({
  created: (state: ClusterStateData, resource: T) => ({
    ...state,
    [stateKey]: repo.add(state[stateKey] as any, resource)
  }),

  deleted: (state: ClusterStateData, name: string, namespace: string) => {
    const result = repo.remove(state[stateKey] as any, name, namespace)
    return result.ok && result.collection
      ? { ...state, [stateKey]: result.collection }
      : state
  },

  updated: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    resource: T
  ) => {
    const result = repo.update(
      state[stateKey] as any,
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
  created: (state: ClusterStateData, pod: any) => addPod(state, pod),

  deleted: (state: ClusterStateData, name: string, namespace: string) => {
    const result = deletePod(state, name, namespace)
    return result.ok && result.state ? result.state : state
  },

  updated: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    pod: any
  ) => {
    const result = updatePod(state, name, namespace, () => pod)
    return result.ok && result.state ? result.state : state
  }
})

// ─── Handler Instances ───────────────────────────────────────────────────

const podHandler = createPodHandler()
const configMapHandler = createRepoHandler(configMapRepo, 'configMaps')
const secretHandler = createRepoHandler(secretRepo, 'secrets')
const replicaSetHandler = createRepoHandler(replicaSetRepo, 'replicaSets')
const deploymentHandler = createRepoHandler(deploymentRepo, 'deployments')
const daemonSetHandler = createRepoHandler(daemonSetRepo, 'daemonSets')
const serviceHandler = createRepoHandler(serviceRepo, 'services')
const persistentVolumeHandler = createRepoHandler(
  persistentVolumeRepo,
  'persistentVolumes'
)
const persistentVolumeClaimHandler = createRepoHandler(
  persistentVolumeClaimRepo,
  'persistentVolumeClaims'
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
