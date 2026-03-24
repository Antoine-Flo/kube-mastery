// ═══════════════════════════════════════════════════════════════════════════
// CLUSTER EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Type definitions for cluster events following Kubernetes event-driven model.
// Events represent state changes (CRUD operations) on cluster resources.

import type { BaseEvent } from '../../events/types'
import type { ConfigMap } from '../ressources/ConfigMap'
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
import type { Service } from '../ressources/Service'
import type { StatefulSet } from '../ressources/StatefulSet'

// ─── Pod Events ──────────────────────────────────────────────────────────

export interface PodCreatedEvent extends BaseEvent {
  type: 'PodCreated'
  payload: {
    pod: Pod
  }
}

export interface PodDeletedEvent extends BaseEvent {
  type: 'PodDeleted'
  payload: {
    name: string
    namespace: string
    deletedPod: Pod
  }
}

export interface PodUpdatedEvent extends BaseEvent {
  type: 'PodUpdated'
  payload: {
    name: string
    namespace: string
    pod: Pod
    previousPod: Pod
  }
}

export interface PodBoundEvent extends BaseEvent {
  type: 'PodBound'
  payload: {
    name: string
    namespace: string
    nodeName: string
    pod: Pod
    previousPod: Pod
  }
}

// ─── ConfigMap Events ────────────────────────────────────────────────────

export interface ConfigMapCreatedEvent extends BaseEvent {
  type: 'ConfigMapCreated'
  payload: {
    configMap: ConfigMap
  }
}

export interface ConfigMapDeletedEvent extends BaseEvent {
  type: 'ConfigMapDeleted'
  payload: {
    name: string
    namespace: string
    deletedConfigMap: ConfigMap
  }
}

export interface ConfigMapUpdatedEvent extends BaseEvent {
  type: 'ConfigMapUpdated'
  payload: {
    name: string
    namespace: string
    configMap: ConfigMap
    previousConfigMap: ConfigMap
  }
}

// ─── Secret Events ───────────────────────────────────────────────────────

export interface SecretCreatedEvent extends BaseEvent {
  type: 'SecretCreated'
  payload: {
    secret: Secret
  }
}

export interface SecretDeletedEvent extends BaseEvent {
  type: 'SecretDeleted'
  payload: {
    name: string
    namespace: string
    deletedSecret: Secret
  }
}

export interface SecretUpdatedEvent extends BaseEvent {
  type: 'SecretUpdated'
  payload: {
    name: string
    namespace: string
    secret: Secret
    previousSecret: Secret
  }
}

// ─── ReplicaSet Events ────────────────────────────────────────────────

export interface ReplicaSetCreatedEvent extends BaseEvent {
  type: 'ReplicaSetCreated'
  payload: {
    replicaSet: ReplicaSet
  }
}

export interface ReplicaSetDeletedEvent extends BaseEvent {
  type: 'ReplicaSetDeleted'
  payload: {
    name: string
    namespace: string
    deletedReplicaSet: ReplicaSet
  }
}

export interface ReplicaSetUpdatedEvent extends BaseEvent {
  type: 'ReplicaSetUpdated'
  payload: {
    name: string
    namespace: string
    replicaSet: ReplicaSet
    previousReplicaSet: ReplicaSet
  }
}

// ─── Deployment Events ────────────────────────────────────────────────

export interface DeploymentCreatedEvent extends BaseEvent {
  type: 'DeploymentCreated'
  payload: {
    deployment: Deployment
  }
}

export interface DeploymentDeletedEvent extends BaseEvent {
  type: 'DeploymentDeleted'
  payload: {
    name: string
    namespace: string
    deletedDeployment: Deployment
  }
}

export interface DeploymentUpdatedEvent extends BaseEvent {
  type: 'DeploymentUpdated'
  payload: {
    name: string
    namespace: string
    deployment: Deployment
    previousDeployment: Deployment
  }
}

export interface DaemonSetCreatedEvent extends BaseEvent {
  type: 'DaemonSetCreated'
  payload: {
    daemonSet: DaemonSet
  }
}

export interface DaemonSetDeletedEvent extends BaseEvent {
  type: 'DaemonSetDeleted'
  payload: {
    name: string
    namespace: string
    deletedDaemonSet: DaemonSet
  }
}

export interface DaemonSetUpdatedEvent extends BaseEvent {
  type: 'DaemonSetUpdated'
  payload: {
    name: string
    namespace: string
    daemonSet: DaemonSet
    previousDaemonSet: DaemonSet
  }
}

export interface StatefulSetCreatedEvent extends BaseEvent {
  type: 'StatefulSetCreated'
  payload: {
    statefulSet: StatefulSet
  }
}

export interface StatefulSetDeletedEvent extends BaseEvent {
  type: 'StatefulSetDeleted'
  payload: {
    name: string
    namespace: string
    deletedStatefulSet: StatefulSet
  }
}

export interface StatefulSetUpdatedEvent extends BaseEvent {
  type: 'StatefulSetUpdated'
  payload: {
    name: string
    namespace: string
    statefulSet: StatefulSet
    previousStatefulSet: StatefulSet
  }
}

// ─── Service Events ────────────────────────────────────────────────────

export interface ServiceCreatedEvent extends BaseEvent {
  type: 'ServiceCreated'
  payload: {
    service: Service
  }
}

export interface ServiceDeletedEvent extends BaseEvent {
  type: 'ServiceDeleted'
  payload: {
    name: string
    namespace: string
    deletedService: Service
  }
}

export interface ServiceUpdatedEvent extends BaseEvent {
  type: 'ServiceUpdated'
  payload: {
    name: string
    namespace: string
    service: Service
    previousService: Service
  }
}

export interface EndpointsCreatedEvent extends BaseEvent {
  type: 'EndpointsCreated'
  payload: {
    endpoints: Endpoints
  }
}

export interface EndpointsDeletedEvent extends BaseEvent {
  type: 'EndpointsDeleted'
  payload: {
    name: string
    namespace: string
    deletedEndpoints: Endpoints
  }
}

export interface EndpointsUpdatedEvent extends BaseEvent {
  type: 'EndpointsUpdated'
  payload: {
    name: string
    namespace: string
    endpoints: Endpoints
    previousEndpoints: Endpoints
  }
}

export interface EndpointSliceCreatedEvent extends BaseEvent {
  type: 'EndpointSliceCreated'
  payload: {
    endpointSlice: EndpointSlice
  }
}

export interface EndpointSliceDeletedEvent extends BaseEvent {
  type: 'EndpointSliceDeleted'
  payload: {
    name: string
    namespace: string
    deletedEndpointSlice: EndpointSlice
  }
}

export interface EndpointSliceUpdatedEvent extends BaseEvent {
  type: 'EndpointSliceUpdated'
  payload: {
    name: string
    namespace: string
    endpointSlice: EndpointSlice
    previousEndpointSlice: EndpointSlice
  }
}

// ─── PersistentVolume Events ───────────────────────────────────────────────

export interface PersistentVolumeCreatedEvent extends BaseEvent {
  type: 'PersistentVolumeCreated'
  payload: {
    persistentVolume: PersistentVolume
  }
}

export interface PersistentVolumeDeletedEvent extends BaseEvent {
  type: 'PersistentVolumeDeleted'
  payload: {
    name: string
    deletedPersistentVolume: PersistentVolume
  }
}

export interface PersistentVolumeUpdatedEvent extends BaseEvent {
  type: 'PersistentVolumeUpdated'
  payload: {
    name: string
    persistentVolume: PersistentVolume
    previousPersistentVolume: PersistentVolume
  }
}

// ─── PersistentVolumeClaim Events ──────────────────────────────────────────

export interface PersistentVolumeClaimCreatedEvent extends BaseEvent {
  type: 'PersistentVolumeClaimCreated'
  payload: {
    persistentVolumeClaim: PersistentVolumeClaim
  }
}

export interface PersistentVolumeClaimDeletedEvent extends BaseEvent {
  type: 'PersistentVolumeClaimDeleted'
  payload: {
    name: string
    namespace: string
    deletedPersistentVolumeClaim: PersistentVolumeClaim
  }
}

export interface PersistentVolumeClaimUpdatedEvent extends BaseEvent {
  type: 'PersistentVolumeClaimUpdated'
  payload: {
    name: string
    namespace: string
    persistentVolumeClaim: PersistentVolumeClaim
    previousPersistentVolumeClaim: PersistentVolumeClaim
  }
}

// ─── Label Events ────────────────────────────────────────────────────

export interface PodLabeledEvent extends BaseEvent {
  type: 'PodLabeled'
  payload: {
    name: string
    namespace: string
    labels: Record<string, string>
    pod: Pod
    previousPod: Pod
  }
}

export interface ConfigMapLabeledEvent extends BaseEvent {
  type: 'ConfigMapLabeled'
  payload: {
    name: string
    namespace: string
    labels: Record<string, string>
    configMap: ConfigMap
    previousConfigMap: ConfigMap
  }
}

export interface SecretLabeledEvent extends BaseEvent {
  type: 'SecretLabeled'
  payload: {
    name: string
    namespace: string
    labels: Record<string, string>
    secret: Secret
    previousSecret: Secret
  }
}

// ─── Annotation Events ───────────────────────────────────────────────

export interface PodAnnotatedEvent extends BaseEvent {
  type: 'PodAnnotated'
  payload: {
    name: string
    namespace: string
    annotations: Record<string, string>
    pod: Pod
    previousPod: Pod
  }
}

export interface ConfigMapAnnotatedEvent extends BaseEvent {
  type: 'ConfigMapAnnotated'
  payload: {
    name: string
    namespace: string
    annotations: Record<string, string>
    configMap: ConfigMap
    previousConfigMap: ConfigMap
  }
}

export interface SecretAnnotatedEvent extends BaseEvent {
  type: 'SecretAnnotated'
  payload: {
    name: string
    namespace: string
    annotations: Record<string, string>
    secret: Secret
    previousSecret: Secret
  }
}

export interface ServiceLabeledEvent extends BaseEvent {
  type: 'ServiceLabeled'
  payload: {
    name: string
    namespace: string
    labels: Record<string, string>
    service: Service
    previousService: Service
  }
}

export interface ServiceAnnotatedEvent extends BaseEvent {
  type: 'ServiceAnnotated'
  payload: {
    name: string
    namespace: string
    annotations: Record<string, string>
    service: Service
    previousService: Service
  }
}

// ─── Node Events ─────────────────────────────────────────────────────────

export interface NodeCreatedEvent extends BaseEvent {
  type: 'NodeCreated'
  payload: {
    node: Node
  }
}

export interface NodeDeletedEvent extends BaseEvent {
  type: 'NodeDeleted'
  payload: {
    name: string
    deletedNode: Node
  }
}

export interface NodeUpdatedEvent extends BaseEvent {
  type: 'NodeUpdated'
  payload: {
    name: string
    node: Node
    previousNode: Node
  }
}

// ─── Namespace Events ────────────────────────────────────────────────────

export interface NamespaceCreatedEvent extends BaseEvent {
  type: 'NamespaceCreated'
  payload: {
    namespace: Namespace
  }
}

export interface NamespaceDeletedEvent extends BaseEvent {
  type: 'NamespaceDeleted'
  payload: {
    name: string
    deletedNamespace: Namespace
  }
}

export interface NamespaceUpdatedEvent extends BaseEvent {
  type: 'NamespaceUpdated'
  payload: {
    name: string
    namespace: Namespace
    previousNamespace: Namespace
  }
}

// ─── Ingress Events ──────────────────────────────────────────────────────

export interface IngressCreatedEvent extends BaseEvent {
  type: 'IngressCreated'
  payload: {
    ingress: Ingress
  }
}

export interface IngressDeletedEvent extends BaseEvent {
  type: 'IngressDeleted'
  payload: {
    name: string
    namespace: string
    deletedIngress: Ingress
  }
}

export interface IngressUpdatedEvent extends BaseEvent {
  type: 'IngressUpdated'
  payload: {
    name: string
    namespace: string
    ingress: Ingress
    previousIngress: Ingress
  }
}

// ─── Lease Events ────────────────────────────────────────────────────────

export interface LeaseCreatedEvent extends BaseEvent {
  type: 'LeaseCreated'
  payload: {
    lease: Lease
  }
}

export interface LeaseDeletedEvent extends BaseEvent {
  type: 'LeaseDeleted'
  payload: {
    name: string
    namespace: string
    deletedLease: Lease
  }
}

export interface LeaseUpdatedEvent extends BaseEvent {
  type: 'LeaseUpdated'
  payload: {
    name: string
    namespace: string
    lease: Lease
    previousLease: Lease
  }
}

// ─── Event Union Type ────────────────────────────────────────────────

export type ClusterEvent =
  | PodCreatedEvent
  | PodDeletedEvent
  | PodUpdatedEvent
  | PodBoundEvent
  | ConfigMapCreatedEvent
  | ConfigMapDeletedEvent
  | ConfigMapUpdatedEvent
  | SecretCreatedEvent
  | SecretDeletedEvent
  | SecretUpdatedEvent
  | ReplicaSetCreatedEvent
  | ReplicaSetDeletedEvent
  | ReplicaSetUpdatedEvent
  | DeploymentCreatedEvent
  | DeploymentDeletedEvent
  | DeploymentUpdatedEvent
  | DaemonSetCreatedEvent
  | DaemonSetDeletedEvent
  | DaemonSetUpdatedEvent
  | StatefulSetCreatedEvent
  | StatefulSetDeletedEvent
  | StatefulSetUpdatedEvent
  | PodLabeledEvent
  | ConfigMapLabeledEvent
  | SecretLabeledEvent
  | PodAnnotatedEvent
  | ConfigMapAnnotatedEvent
  | SecretAnnotatedEvent
  | ServiceCreatedEvent
  | ServiceDeletedEvent
  | ServiceUpdatedEvent
  | EndpointsCreatedEvent
  | EndpointsDeletedEvent
  | EndpointsUpdatedEvent
  | EndpointSliceCreatedEvent
  | EndpointSliceDeletedEvent
  | EndpointSliceUpdatedEvent
  | PersistentVolumeCreatedEvent
  | PersistentVolumeDeletedEvent
  | PersistentVolumeUpdatedEvent
  | PersistentVolumeClaimCreatedEvent
  | PersistentVolumeClaimDeletedEvent
  | PersistentVolumeClaimUpdatedEvent
  | ServiceLabeledEvent
  | ServiceAnnotatedEvent
  | NodeCreatedEvent
  | NodeDeletedEvent
  | NodeUpdatedEvent
  | NamespaceCreatedEvent
  | NamespaceDeletedEvent
  | NamespaceUpdatedEvent
  | IngressCreatedEvent
  | IngressDeletedEvent
  | IngressUpdatedEvent
  | LeaseCreatedEvent
  | LeaseDeletedEvent
  | LeaseUpdatedEvent

// ─── Event Factory Helpers ───────────────────────────────────────────────

const createEventMetadata = (source?: string): BaseEvent['metadata'] => ({
  source: source || 'cluster',
  correlationId: crypto.randomUUID()
})

const createEventTimestamp = (): string => new Date().toISOString()

// ─── Event Factory Functions ─────────────────────────────────────────────

/**
 * Create PodCreated event
 */
export const createPodCreatedEvent = (
  pod: Pod,
  source?: string
): PodCreatedEvent => ({
  type: 'PodCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { pod }
})

/**
 * Create PodDeleted event
 */
export const createPodDeletedEvent = (
  name: string,
  namespace: string,
  deletedPod: Pod,
  source?: string
): PodDeletedEvent => ({
  type: 'PodDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedPod }
})

/**
 * Create PodUpdated event
 */
export const createPodUpdatedEvent = (
  name: string,
  namespace: string,
  pod: Pod,
  previousPod: Pod,
  source?: string
): PodUpdatedEvent => ({
  type: 'PodUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, pod, previousPod }
})

/**
 * Create PodBound event
 */
export const createPodBoundEvent = (
  name: string,
  namespace: string,
  nodeName: string,
  pod: Pod,
  previousPod: Pod,
  source?: string
): PodBoundEvent => ({
  type: 'PodBound',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, nodeName, pod, previousPod }
})

/**
 * Create ConfigMapCreated event
 */
export const createConfigMapCreatedEvent = (
  configMap: ConfigMap,
  source?: string
): ConfigMapCreatedEvent => ({
  type: 'ConfigMapCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { configMap }
})

/**
 * Create ConfigMapDeleted event
 */
export const createConfigMapDeletedEvent = (
  name: string,
  namespace: string,
  deletedConfigMap: ConfigMap,
  source?: string
): ConfigMapDeletedEvent => ({
  type: 'ConfigMapDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedConfigMap }
})

/**
 * Create ConfigMapUpdated event
 */
export const createConfigMapUpdatedEvent = (
  name: string,
  namespace: string,
  configMap: ConfigMap,
  previousConfigMap: ConfigMap,
  source?: string
): ConfigMapUpdatedEvent => ({
  type: 'ConfigMapUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, configMap, previousConfigMap }
})

/**
 * Create SecretCreated event
 */
export const createSecretCreatedEvent = (
  secret: Secret,
  source?: string
): SecretCreatedEvent => ({
  type: 'SecretCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { secret }
})

/**
 * Create SecretDeleted event
 */
export const createSecretDeletedEvent = (
  name: string,
  namespace: string,
  deletedSecret: Secret,
  source?: string
): SecretDeletedEvent => ({
  type: 'SecretDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedSecret }
})

/**
 * Create SecretUpdated event
 */
export const createSecretUpdatedEvent = (
  name: string,
  namespace: string,
  secret: Secret,
  previousSecret: Secret,
  source?: string
): SecretUpdatedEvent => ({
  type: 'SecretUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, secret, previousSecret }
})

/**
 * Create ReplicaSetCreated event
 */
export const createReplicaSetCreatedEvent = (
  replicaSet: ReplicaSet,
  source?: string
): ReplicaSetCreatedEvent => ({
  type: 'ReplicaSetCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { replicaSet }
})

/**
 * Create ReplicaSetDeleted event
 */
export const createReplicaSetDeletedEvent = (
  name: string,
  namespace: string,
  deletedReplicaSet: ReplicaSet,
  source?: string
): ReplicaSetDeletedEvent => ({
  type: 'ReplicaSetDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedReplicaSet }
})

/**
 * Create ReplicaSetUpdated event
 */
export const createReplicaSetUpdatedEvent = (
  name: string,
  namespace: string,
  replicaSet: ReplicaSet,
  previousReplicaSet: ReplicaSet,
  source?: string
): ReplicaSetUpdatedEvent => ({
  type: 'ReplicaSetUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, replicaSet, previousReplicaSet }
})

/**
 * Create DeploymentCreated event
 */
export const createDeploymentCreatedEvent = (
  deployment: Deployment,
  source?: string
): DeploymentCreatedEvent => ({
  type: 'DeploymentCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { deployment }
})

/**
 * Create DeploymentDeleted event
 */
export const createDeploymentDeletedEvent = (
  name: string,
  namespace: string,
  deletedDeployment: Deployment,
  source?: string
): DeploymentDeletedEvent => ({
  type: 'DeploymentDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedDeployment }
})

/**
 * Create DeploymentUpdated event
 */
export const createDeploymentUpdatedEvent = (
  name: string,
  namespace: string,
  deployment: Deployment,
  previousDeployment: Deployment,
  source?: string
): DeploymentUpdatedEvent => ({
  type: 'DeploymentUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deployment, previousDeployment }
})

export const createDaemonSetCreatedEvent = (
  daemonSet: DaemonSet,
  source?: string
): DaemonSetCreatedEvent => ({
  type: 'DaemonSetCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { daemonSet }
})

export const createDaemonSetDeletedEvent = (
  name: string,
  namespace: string,
  deletedDaemonSet: DaemonSet,
  source?: string
): DaemonSetDeletedEvent => ({
  type: 'DaemonSetDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedDaemonSet }
})

export const createDaemonSetUpdatedEvent = (
  name: string,
  namespace: string,
  daemonSet: DaemonSet,
  previousDaemonSet: DaemonSet,
  source?: string
): DaemonSetUpdatedEvent => ({
  type: 'DaemonSetUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, daemonSet, previousDaemonSet }
})

export const createStatefulSetCreatedEvent = (
  statefulSet: StatefulSet,
  source?: string
): StatefulSetCreatedEvent => ({
  type: 'StatefulSetCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { statefulSet }
})

export const createStatefulSetDeletedEvent = (
  name: string,
  namespace: string,
  deletedStatefulSet: StatefulSet,
  source?: string
): StatefulSetDeletedEvent => ({
  type: 'StatefulSetDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedStatefulSet }
})

export const createStatefulSetUpdatedEvent = (
  name: string,
  namespace: string,
  statefulSet: StatefulSet,
  previousStatefulSet: StatefulSet,
  source?: string
): StatefulSetUpdatedEvent => ({
  type: 'StatefulSetUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, statefulSet, previousStatefulSet }
})

/**
 * Create PodLabeled event
 */
export const createPodLabeledEvent = (
  name: string,
  namespace: string,
  labels: Record<string, string>,
  pod: Pod,
  previousPod: Pod,
  source?: string
): PodLabeledEvent => ({
  type: 'PodLabeled',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, labels, pod, previousPod }
})

/**
 * Create ConfigMapLabeled event
 */
export const createConfigMapLabeledEvent = (
  name: string,
  namespace: string,
  labels: Record<string, string>,
  configMap: ConfigMap,
  previousConfigMap: ConfigMap,
  source?: string
): ConfigMapLabeledEvent => ({
  type: 'ConfigMapLabeled',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, labels, configMap, previousConfigMap }
})

/**
 * Create SecretLabeled event
 */
export const createSecretLabeledEvent = (
  name: string,
  namespace: string,
  labels: Record<string, string>,
  secret: Secret,
  previousSecret: Secret,
  source?: string
): SecretLabeledEvent => ({
  type: 'SecretLabeled',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, labels, secret, previousSecret }
})

/**
 * Create PodAnnotated event
 */
export const createPodAnnotatedEvent = (
  name: string,
  namespace: string,
  annotations: Record<string, string>,
  pod: Pod,
  previousPod: Pod,
  source?: string
): PodAnnotatedEvent => ({
  type: 'PodAnnotated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, annotations, pod, previousPod }
})

/**
 * Create ConfigMapAnnotated event
 */
export const createConfigMapAnnotatedEvent = (
  name: string,
  namespace: string,
  annotations: Record<string, string>,
  configMap: ConfigMap,
  previousConfigMap: ConfigMap,
  source?: string
): ConfigMapAnnotatedEvent => ({
  type: 'ConfigMapAnnotated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, annotations, configMap, previousConfigMap }
})

/**
 * Create SecretAnnotated event
 */
export const createSecretAnnotatedEvent = (
  name: string,
  namespace: string,
  annotations: Record<string, string>,
  secret: Secret,
  previousSecret: Secret,
  source?: string
): SecretAnnotatedEvent => ({
  type: 'SecretAnnotated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, annotations, secret, previousSecret }
})

/**
 * Create ServiceCreated event
 */
export const createServiceCreatedEvent = (
  service: Service,
  source?: string
): ServiceCreatedEvent => ({
  type: 'ServiceCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { service }
})

/**
 * Create ServiceDeleted event
 */
export const createServiceDeletedEvent = (
  name: string,
  namespace: string,
  deletedService: Service,
  source?: string
): ServiceDeletedEvent => ({
  type: 'ServiceDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedService }
})

/**
 * Create ServiceUpdated event
 */
export const createServiceUpdatedEvent = (
  name: string,
  namespace: string,
  service: Service,
  previousService: Service,
  source?: string
): ServiceUpdatedEvent => ({
  type: 'ServiceUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, service, previousService }
})

export const createEndpointsCreatedEvent = (
  endpoints: Endpoints,
  source?: string
): EndpointsCreatedEvent => ({
  type: 'EndpointsCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { endpoints }
})

export const createEndpointsDeletedEvent = (
  name: string,
  namespace: string,
  deletedEndpoints: Endpoints,
  source?: string
): EndpointsDeletedEvent => ({
  type: 'EndpointsDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedEndpoints }
})

export const createEndpointsUpdatedEvent = (
  name: string,
  namespace: string,
  endpoints: Endpoints,
  previousEndpoints: Endpoints,
  source?: string
): EndpointsUpdatedEvent => ({
  type: 'EndpointsUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, endpoints, previousEndpoints }
})

export const createEndpointSliceCreatedEvent = (
  endpointSlice: EndpointSlice,
  source?: string
): EndpointSliceCreatedEvent => ({
  type: 'EndpointSliceCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { endpointSlice }
})

export const createEndpointSliceDeletedEvent = (
  name: string,
  namespace: string,
  deletedEndpointSlice: EndpointSlice,
  source?: string
): EndpointSliceDeletedEvent => ({
  type: 'EndpointSliceDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedEndpointSlice }
})

export const createEndpointSliceUpdatedEvent = (
  name: string,
  namespace: string,
  endpointSlice: EndpointSlice,
  previousEndpointSlice: EndpointSlice,
  source?: string
): EndpointSliceUpdatedEvent => ({
  type: 'EndpointSliceUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, endpointSlice, previousEndpointSlice }
})

/**
 * Create PersistentVolumeCreated event
 */
export const createPersistentVolumeCreatedEvent = (
  persistentVolume: PersistentVolume,
  source?: string
): PersistentVolumeCreatedEvent => ({
  type: 'PersistentVolumeCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { persistentVolume }
})

/**
 * Create PersistentVolumeDeleted event
 */
export const createPersistentVolumeDeletedEvent = (
  name: string,
  deletedPersistentVolume: PersistentVolume,
  source?: string
): PersistentVolumeDeletedEvent => ({
  type: 'PersistentVolumeDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, deletedPersistentVolume }
})

/**
 * Create PersistentVolumeUpdated event
 */
export const createPersistentVolumeUpdatedEvent = (
  name: string,
  persistentVolume: PersistentVolume,
  previousPersistentVolume: PersistentVolume,
  source?: string
): PersistentVolumeUpdatedEvent => ({
  type: 'PersistentVolumeUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, persistentVolume, previousPersistentVolume }
})

/**
 * Create PersistentVolumeClaimCreated event
 */
export const createPersistentVolumeClaimCreatedEvent = (
  persistentVolumeClaim: PersistentVolumeClaim,
  source?: string
): PersistentVolumeClaimCreatedEvent => ({
  type: 'PersistentVolumeClaimCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { persistentVolumeClaim }
})

/**
 * Create PersistentVolumeClaimDeleted event
 */
export const createPersistentVolumeClaimDeletedEvent = (
  name: string,
  namespace: string,
  deletedPersistentVolumeClaim: PersistentVolumeClaim,
  source?: string
): PersistentVolumeClaimDeletedEvent => ({
  type: 'PersistentVolumeClaimDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedPersistentVolumeClaim }
})

/**
 * Create PersistentVolumeClaimUpdated event
 */
export const createPersistentVolumeClaimUpdatedEvent = (
  name: string,
  namespace: string,
  persistentVolumeClaim: PersistentVolumeClaim,
  previousPersistentVolumeClaim: PersistentVolumeClaim,
  source?: string
): PersistentVolumeClaimUpdatedEvent => ({
  type: 'PersistentVolumeClaimUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: {
    name,
    namespace,
    persistentVolumeClaim,
    previousPersistentVolumeClaim
  }
})

/**
 * Create NodeCreated event
 */
export const createNodeCreatedEvent = (
  node: Node,
  source?: string
): NodeCreatedEvent => ({
  type: 'NodeCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { node }
})

/**
 * Create NodeDeleted event
 */
export const createNodeDeletedEvent = (
  name: string,
  deletedNode: Node,
  source?: string
): NodeDeletedEvent => ({
  type: 'NodeDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, deletedNode }
})

/**
 * Create NodeUpdated event
 */
export const createNodeUpdatedEvent = (
  name: string,
  node: Node,
  previousNode: Node,
  source?: string
): NodeUpdatedEvent => ({
  type: 'NodeUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, node, previousNode }
})

/**
 * Create NamespaceCreated event
 */
export const createNamespaceCreatedEvent = (
  namespace: Namespace,
  source?: string
): NamespaceCreatedEvent => ({
  type: 'NamespaceCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { namespace }
})

/**
 * Create NamespaceDeleted event
 */
export const createNamespaceDeletedEvent = (
  name: string,
  deletedNamespace: Namespace,
  source?: string
): NamespaceDeletedEvent => ({
  type: 'NamespaceDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, deletedNamespace }
})

/**
 * Create NamespaceUpdated event
 */
export const createNamespaceUpdatedEvent = (
  name: string,
  namespace: Namespace,
  previousNamespace: Namespace,
  source?: string
): NamespaceUpdatedEvent => ({
  type: 'NamespaceUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, previousNamespace }
})

/**
 * Create IngressCreated event
 */
export const createIngressCreatedEvent = (
  ingress: Ingress,
  source?: string
): IngressCreatedEvent => ({
  type: 'IngressCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { ingress }
})

/**
 * Create IngressDeleted event
 */
export const createIngressDeletedEvent = (
  name: string,
  namespace: string,
  deletedIngress: Ingress,
  source?: string
): IngressDeletedEvent => ({
  type: 'IngressDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedIngress }
})

/**
 * Create IngressUpdated event
 */
export const createIngressUpdatedEvent = (
  name: string,
  namespace: string,
  ingress: Ingress,
  previousIngress: Ingress,
  source?: string
): IngressUpdatedEvent => ({
  type: 'IngressUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, ingress, previousIngress }
})

/**
 * Create LeaseCreated event
 */
export const createLeaseCreatedEvent = (
  lease: Lease,
  source?: string
): LeaseCreatedEvent => ({
  type: 'LeaseCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { lease }
})

/**
 * Create LeaseDeleted event
 */
export const createLeaseDeletedEvent = (
  name: string,
  namespace: string,
  deletedLease: Lease,
  source?: string
): LeaseDeletedEvent => ({
  type: 'LeaseDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, deletedLease }
})

/**
 * Create LeaseUpdated event
 */
export const createLeaseUpdatedEvent = (
  name: string,
  namespace: string,
  lease: Lease,
  previousLease: Lease,
  source?: string
): LeaseUpdatedEvent => ({
  type: 'LeaseUpdated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { name, namespace, lease, previousLease }
})
