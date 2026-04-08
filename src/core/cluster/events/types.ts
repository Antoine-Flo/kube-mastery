import type { BaseEvent } from '../../events/types'
import type { ClusterResourceTypeByKind } from '../generated/clusterResourceModels.generated'
import {
  createClusterEventMetadata,
  createClusterEventTimestamp
} from './types.generated'
import type { GeneratedClusterCrudEvent } from './types.generated'

export * from './types.generated'

type Pod = ClusterResourceTypeByKind['Pod']
type ConfigMap = ClusterResourceTypeByKind['ConfigMap']
type Secret = ClusterResourceTypeByKind['Secret']
type Service = ClusterResourceTypeByKind['Service']

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

export interface DeploymentScaledEvent extends BaseEvent {
  type: 'DeploymentScaled'
  payload: {
    namespace: string
    deploymentName: string
    replicaSetName: string
    fromReplicas: number
    toReplicas: number
    reason: 'ScalingReplicaSet'
    message: string
  }
}

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

export type ClusterEvent =
  | GeneratedClusterCrudEvent
  | PodBoundEvent
  | DeploymentScaledEvent
  | PodLabeledEvent
  | ConfigMapLabeledEvent
  | SecretLabeledEvent
  | PodAnnotatedEvent
  | ConfigMapAnnotatedEvent
  | SecretAnnotatedEvent
  | ServiceLabeledEvent
  | ServiceAnnotatedEvent

export const createPodBoundEvent = (
  name: string,
  namespace: string,
  nodeName: string,
  pod: Pod,
  previousPod: Pod,
  source?: string
): PodBoundEvent => ({
  type: 'PodBound',
  timestamp: createClusterEventTimestamp(),
  metadata: createClusterEventMetadata(source),
  payload: { name, namespace, nodeName, pod, previousPod }
})

export const createDeploymentScaledEvent = (
  namespace: string,
  deploymentName: string,
  replicaSetName: string,
  fromReplicas: number,
  toReplicas: number,
  source?: string
): DeploymentScaledEvent => ({
  type: 'DeploymentScaled',
  timestamp: createClusterEventTimestamp(),
  metadata: createClusterEventMetadata(source),
  payload: {
    namespace,
    deploymentName,
    replicaSetName,
    fromReplicas,
    toReplicas,
    reason: 'ScalingReplicaSet',
    message:
      toReplicas >= fromReplicas
        ? `Scaled up replica set ${replicaSetName} from ${fromReplicas} to ${toReplicas}`
        : `Scaled down replica set ${replicaSetName} from ${fromReplicas} to ${toReplicas}`
  }
})

export const createPodLabeledEvent = (
  name: string,
  namespace: string,
  labels: Record<string, string>,
  pod: Pod,
  previousPod: Pod,
  source?: string
): PodLabeledEvent => ({
  type: 'PodLabeled',
  timestamp: createClusterEventTimestamp(),
  metadata: createClusterEventMetadata(source),
  payload: { name, namespace, labels, pod, previousPod }
})

export const createConfigMapLabeledEvent = (
  name: string,
  namespace: string,
  labels: Record<string, string>,
  configMap: ConfigMap,
  previousConfigMap: ConfigMap,
  source?: string
): ConfigMapLabeledEvent => ({
  type: 'ConfigMapLabeled',
  timestamp: createClusterEventTimestamp(),
  metadata: createClusterEventMetadata(source),
  payload: { name, namespace, labels, configMap, previousConfigMap }
})

export const createSecretLabeledEvent = (
  name: string,
  namespace: string,
  labels: Record<string, string>,
  secret: Secret,
  previousSecret: Secret,
  source?: string
): SecretLabeledEvent => ({
  type: 'SecretLabeled',
  timestamp: createClusterEventTimestamp(),
  metadata: createClusterEventMetadata(source),
  payload: { name, namespace, labels, secret, previousSecret }
})

export const createPodAnnotatedEvent = (
  name: string,
  namespace: string,
  annotations: Record<string, string>,
  pod: Pod,
  previousPod: Pod,
  source?: string
): PodAnnotatedEvent => ({
  type: 'PodAnnotated',
  timestamp: createClusterEventTimestamp(),
  metadata: createClusterEventMetadata(source),
  payload: { name, namespace, annotations, pod, previousPod }
})

export const createConfigMapAnnotatedEvent = (
  name: string,
  namespace: string,
  annotations: Record<string, string>,
  configMap: ConfigMap,
  previousConfigMap: ConfigMap,
  source?: string
): ConfigMapAnnotatedEvent => ({
  type: 'ConfigMapAnnotated',
  timestamp: createClusterEventTimestamp(),
  metadata: createClusterEventMetadata(source),
  payload: { name, namespace, annotations, configMap, previousConfigMap }
})

export const createSecretAnnotatedEvent = (
  name: string,
  namespace: string,
  annotations: Record<string, string>,
  secret: Secret,
  previousSecret: Secret,
  source?: string
): SecretAnnotatedEvent => ({
  type: 'SecretAnnotated',
  timestamp: createClusterEventTimestamp(),
  metadata: createClusterEventMetadata(source),
  payload: { name, namespace, annotations, secret, previousSecret }
})
