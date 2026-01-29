// ═══════════════════════════════════════════════════════════════════════════
// CLUSTER EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Type definitions for cluster events following Kubernetes event-driven model.
// Events represent state changes (CRUD operations) on cluster resources.

import type { BaseEvent } from '../../events/types'
import type { ConfigMap } from '../ressources/ConfigMap'
import type { Deployment } from '../ressources/Deployment'
import type { Pod } from '../ressources/Pod'
import type { ReplicaSet } from '../ressources/ReplicaSet'
import type { Secret } from '../ressources/Secret'
import type { Service } from '../ressources/Service'

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

// ─── Event Union Type ────────────────────────────────────────────────

export type ClusterEvent =
    | PodCreatedEvent
    | PodDeletedEvent
    | PodUpdatedEvent
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
    | PodLabeledEvent
    | ConfigMapLabeledEvent
    | SecretLabeledEvent
    | PodAnnotatedEvent
    | ConfigMapAnnotatedEvent
    | SecretAnnotatedEvent
    | ServiceCreatedEvent
    | ServiceDeletedEvent
    | ServiceUpdatedEvent
    | ServiceLabeledEvent
    | ServiceAnnotatedEvent

// ─── Event Factory Helpers ───────────────────────────────────────────────

const createEventMetadata = (source?: string): BaseEvent['metadata'] => ({
    source: source || 'cluster',
    correlationId: crypto.randomUUID(),
})

const createEventTimestamp = (): string => new Date().toISOString()

// ─── Event Factory Functions ─────────────────────────────────────────────

/**
 * Create PodCreated event
 */
export const createPodCreatedEvent = (pod: Pod, source?: string): PodCreatedEvent => ({
    type: 'PodCreated',
    timestamp: createEventTimestamp(),
    metadata: createEventMetadata(source),
    payload: { pod },
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
    payload: { name, namespace, deletedPod },
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
    payload: { name, namespace, pod, previousPod },
})

/**
 * Create ConfigMapCreated event
 */
export const createConfigMapCreatedEvent = (configMap: ConfigMap, source?: string): ConfigMapCreatedEvent => ({
    type: 'ConfigMapCreated',
    timestamp: createEventTimestamp(),
    metadata: createEventMetadata(source),
    payload: { configMap },
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
    payload: { name, namespace, deletedConfigMap },
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
    payload: { name, namespace, configMap, previousConfigMap },
})

/**
 * Create SecretCreated event
 */
export const createSecretCreatedEvent = (secret: Secret, source?: string): SecretCreatedEvent => ({
    type: 'SecretCreated',
    timestamp: createEventTimestamp(),
    metadata: createEventMetadata(source),
    payload: { secret },
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
    payload: { name, namespace, deletedSecret },
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
    payload: { name, namespace, secret, previousSecret },
})

/**
 * Create ReplicaSetCreated event
 */
export const createReplicaSetCreatedEvent = (replicaSet: ReplicaSet, source?: string): ReplicaSetCreatedEvent => ({
    type: 'ReplicaSetCreated',
    timestamp: createEventTimestamp(),
    metadata: createEventMetadata(source),
    payload: { replicaSet },
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
    payload: { name, namespace, deletedReplicaSet },
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
    payload: { name, namespace, replicaSet, previousReplicaSet },
})

/**
 * Create DeploymentCreated event
 */
export const createDeploymentCreatedEvent = (deployment: Deployment, source?: string): DeploymentCreatedEvent => ({
    type: 'DeploymentCreated',
    timestamp: createEventTimestamp(),
    metadata: createEventMetadata(source),
    payload: { deployment },
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
    payload: { name, namespace, deletedDeployment },
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
    payload: { name, namespace, deployment, previousDeployment },
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
    payload: { name, namespace, labels, pod, previousPod },
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
    payload: { name, namespace, labels, configMap, previousConfigMap },
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
    payload: { name, namespace, labels, secret, previousSecret },
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
    payload: { name, namespace, annotations, pod, previousPod },
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
    payload: { name, namespace, annotations, configMap, previousConfigMap },
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
    payload: { name, namespace, annotations, secret, previousSecret },
})

/**
 * Create ServiceCreated event
 */
export const createServiceCreatedEvent = (service: Service, source?: string): ServiceCreatedEvent => ({
    type: 'ServiceCreated',
    timestamp: createEventTimestamp(),
    metadata: createEventMetadata(source),
    payload: { service },
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
    payload: { name, namespace, deletedService },
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
    payload: { name, namespace, service, previousService },
})
