import type { ApiServerFacade } from './ApiServerFacade'
import type { EventBus } from '../cluster/events/EventBus'
import type { ClusterEvent } from '../cluster/events/types'
import type { Event, EventInvolvedObject } from '../cluster/ressources/Event'
import { createEvent } from '../cluster/ressources/Event'
import type { AppEvent } from '../events/AppEvent'

interface EventRecordCandidate {
  namespace: string
  involvedObject: EventInvolvedObject
  reason: string
  message: string
  type: 'Normal' | 'Warning'
  reportingComponent?: string
  reportingInstance?: string
  action?: string
}

interface CreateEventRecorderOptions {
  eventTtlMs?: number
  now?: () => Date
}

interface EventRecorder {
  start: () => void
  stop: () => void
  reconcile: (event: ClusterEvent) => void
  initialSync: () => void
  resyncAll: () => void
}

const DEFAULT_EVENT_TTL_MS = 60 * 60 * 1000

const makeAggregationKey = (candidate: EventRecordCandidate): string => {
  return [
    candidate.namespace,
    candidate.involvedObject.apiVersion,
    candidate.involvedObject.kind,
    candidate.involvedObject.name,
    candidate.reason,
    candidate.message,
    candidate.type,
    candidate.reportingComponent ?? '',
    candidate.reportingInstance ?? '',
    candidate.action ?? ''
  ].join('|')
}

const hashString = (value: string): string => {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16)
}

const toDnsLabel = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  if (normalized.length === 0) {
    return 'event'
  }
  return normalized.slice(0, 40)
}

const buildEventName = (candidate: EventRecordCandidate): string => {
  const key = makeAggregationKey(candidate)
  const hash = hashString(key).slice(0, 10)
  const involvedName = toDnsLabel(candidate.involvedObject.name ?? '')
  const reason = toDnsLabel(candidate.reason)
  return `${involvedName}.${reason}.${hash}`.slice(0, 63)
}

const resolveSourceMetadata = (
  source: string | undefined
): { reportingComponent?: string; reportingInstance?: string } => {
  if (source == null || source.length === 0) {
    return {}
  }
  return {
    reportingComponent: source,
    reportingInstance: source
  }
}

const isIgnoredSource = (source: string | undefined): boolean => {
  if (source == null) {
    return false
  }
  if (source === 'api-server') {
    return true
  }
  if (source === 'api-server-test') {
    return true
  }
  return source.startsWith('event-recorder')
}

const mapPodBoundEvent = (event: ClusterEvent): EventRecordCandidate | undefined => {
  if (event.type !== 'PodBound') {
    return undefined
  }
  const source = event.metadata?.source
  if (isIgnoredSource(source)) {
    return undefined
  }
  const sourceMetadata = resolveSourceMetadata(source)
  const namespace = event.payload.namespace
  const podName = event.payload.name
  return {
    namespace,
    involvedObject: {
      apiVersion: 'v1',
      kind: 'Pod',
      name: podName,
      namespace
    },
    reason: 'Scheduled',
    message: `Successfully assigned ${namespace}/${podName} to ${event.payload.nodeName}`,
    type: 'Normal',
    ...sourceMetadata
  }
}

const mapPodUpdatedEvent = (
  event: ClusterEvent
): EventRecordCandidate | undefined => {
  if (event.type !== 'PodUpdated') {
    return undefined
  }
  const source = event.metadata?.source
  if (isIgnoredSource(source)) {
    return undefined
  }
  const namespace = event.payload.namespace
  const podName = event.payload.name
  const sourceMetadata = resolveSourceMetadata(source)
  const previousPhase = event.payload.previousPod.status.phase
  const nextPhase = event.payload.pod.status.phase
  if (previousPhase !== nextPhase && nextPhase === 'Running') {
    return {
      namespace,
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: podName,
        namespace
      },
      reason: 'Started',
      message: `Started pod ${namespace}/${podName}`,
      type: 'Normal',
      ...sourceMetadata
    }
  }
  const containerStatuses = event.payload.pod.status.containerStatuses ?? []
  const hasBackOff = containerStatuses.some((status) => {
    return status.stateDetails?.reason === 'BackOff'
  })
  if (hasBackOff) {
    return {
      namespace,
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: podName,
        namespace
      },
      reason: 'BackOff',
      message: `Back-off restarting failed container in pod ${namespace}/${podName}`,
      type: 'Warning',
      ...sourceMetadata
    }
  }
  const hasImagePullBackoff = containerStatuses.some((status) => {
    return (
      status.stateDetails?.reason === 'ImagePullBackOff' ||
      status.stateDetails?.reason === 'ErrImagePull'
    )
  })
  if (hasImagePullBackoff) {
    return {
      namespace,
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: podName,
        namespace
      },
      reason: 'Failed',
      message: `Failed to pull image for pod ${namespace}/${podName}`,
      type: 'Warning',
      ...sourceMetadata
    }
  }
  const hasFailedMount = containerStatuses.some((status) => {
    return status.stateDetails?.reason === 'FailedMount'
  })
  if (hasFailedMount) {
    return {
      namespace,
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: podName,
        namespace
      },
      reason: 'FailedMount',
      message: `Unable to attach or mount volumes for pod ${namespace}/${podName}`,
      type: 'Warning',
      ...sourceMetadata
    }
  }
  return undefined
}

const mapDeploymentScaledEvent = (
  event: ClusterEvent
): EventRecordCandidate | undefined => {
  if (event.type !== 'DeploymentScaled') {
    return undefined
  }
  const source = event.metadata?.source
  if (isIgnoredSource(source)) {
    return undefined
  }
  const sourceMetadata = resolveSourceMetadata(source)
  return {
    namespace: event.payload.namespace,
    involvedObject: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      name: event.payload.deploymentName,
      namespace: event.payload.namespace
    },
    reason: event.payload.reason,
    message: event.payload.message,
    type: 'Normal',
    action: 'ScalingReplicaSet',
    ...sourceMetadata
  }
}

const mapReplicaSetCreatedEvent = (
  event: ClusterEvent
): EventRecordCandidate | undefined => {
  if (event.type !== 'ReplicaSetCreated') {
    return undefined
  }
  const source = event.metadata?.source
  if (isIgnoredSource(source)) {
    return undefined
  }
  const namespace = event.payload.replicaSet.metadata.namespace
  const replicaSetName = event.payload.replicaSet.metadata.name
  const sourceMetadata = resolveSourceMetadata(source)
  return {
    namespace,
    involvedObject: {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      name: replicaSetName,
      namespace
    },
    reason: 'SuccessfulCreate',
    message: `Created replica set ${replicaSetName}`,
    type: 'Normal',
    action: 'Create',
    ...sourceMetadata
  }
}

const mapEndpointsUpdatedEvent = (
  event: ClusterEvent
): EventRecordCandidate | undefined => {
  if (event.type !== 'EndpointsUpdated') {
    return undefined
  }
  const source = event.metadata?.source
  if (isIgnoredSource(source)) {
    return undefined
  }
  const namespace = event.payload.namespace
  const endpointsName = event.payload.name
  const sourceMetadata = resolveSourceMetadata(source)
  return {
    namespace,
    involvedObject: {
      apiVersion: 'v1',
      kind: 'Endpoints',
      name: endpointsName,
      namespace
    },
    reason: 'Updated',
    message: `Updated endpoints ${namespace}/${endpointsName}`,
    type: 'Normal',
    action: 'Update',
    ...sourceMetadata
  }
}

const mapPersistentVolumeClaimUpdatedEvent = (
  event: ClusterEvent
): EventRecordCandidate | undefined => {
  if (event.type !== 'PersistentVolumeClaimUpdated') {
    return undefined
  }
  const source = event.metadata?.source
  if (isIgnoredSource(source)) {
    return undefined
  }
  const currentPhase = event.payload.persistentVolumeClaim.status.phase
  const previousPhase = event.payload.previousPersistentVolumeClaim.status.phase
  if (currentPhase === previousPhase) {
    return undefined
  }
  const namespace = event.payload.namespace
  const claimName = event.payload.name
  const sourceMetadata = resolveSourceMetadata(source)
  if (currentPhase === 'Bound') {
    return {
      namespace,
      involvedObject: {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        name: claimName,
        namespace
      },
      reason: 'ProvisioningSucceeded',
      message: `Successfully provisioned volume for ${namespace}/${claimName}`,
      type: 'Normal',
      action: 'Provision',
      ...sourceMetadata
    }
  }
  return {
    namespace,
    involvedObject: {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      name: claimName,
      namespace
    },
    reason: 'VolumeBinding',
    message: `PersistentVolumeClaim ${namespace}/${claimName} changed phase to ${currentPhase}`,
    type: 'Normal',
    action: 'Update',
    ...sourceMetadata
  }
}

const mapPersistentVolumeUpdatedEvent = (
  event: ClusterEvent
): EventRecordCandidate | undefined => {
  if (event.type !== 'PersistentVolumeUpdated') {
    return undefined
  }
  const source = event.metadata?.source
  if (isIgnoredSource(source)) {
    return undefined
  }
  const currentPhase = event.payload.persistentVolume.status.phase
  const previousPhase = event.payload.previousPersistentVolume.status.phase
  if (currentPhase === previousPhase) {
    return undefined
  }
  const volumeName = event.payload.name
  const sourceMetadata = resolveSourceMetadata(source)
  return {
    namespace: 'default',
    involvedObject: {
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      name: volumeName
    },
    reason: 'VolumePhaseChanged',
    message: `PersistentVolume ${volumeName} changed phase to ${currentPhase}`,
    type: 'Normal',
    action: 'Update',
    ...sourceMetadata
  }
}

const mapClusterEventToCandidate = (
  event: ClusterEvent
): EventRecordCandidate | undefined => {
  if (event.type === 'EventCreated' || event.type === 'EventUpdated') {
    return undefined
  }
  if (event.type === 'EventDeleted') {
    return undefined
  }
  const podBoundCandidate = mapPodBoundEvent(event)
  if (podBoundCandidate != null) {
    return podBoundCandidate
  }
  const podUpdatedCandidate = mapPodUpdatedEvent(event)
  if (podUpdatedCandidate != null) {
    return podUpdatedCandidate
  }
  const deploymentScaledCandidate = mapDeploymentScaledEvent(event)
  if (deploymentScaledCandidate != null) {
    return deploymentScaledCandidate
  }
  const replicaSetCreatedCandidate = mapReplicaSetCreatedEvent(event)
  if (replicaSetCreatedCandidate != null) {
    return replicaSetCreatedCandidate
  }
  const endpointsUpdatedCandidate = mapEndpointsUpdatedEvent(event)
  if (endpointsUpdatedCandidate != null) {
    return endpointsUpdatedCandidate
  }
  const persistentVolumeClaimUpdatedCandidate =
    mapPersistentVolumeClaimUpdatedEvent(event)
  if (persistentVolumeClaimUpdatedCandidate != null) {
    return persistentVolumeClaimUpdatedCandidate
  }
  return mapPersistentVolumeUpdatedEvent(event)
}

const isClusterEvent = (event: AppEvent): event is ClusterEvent => {
  if (typeof event !== 'object' || event == null) {
    return false
  }
  if ('payload' in event && 'timestamp' in event) {
    return true
  }
  return false
}

const parseTimestampMs = (timestamp: string): number | undefined => {
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) {
    return undefined
  }
  return parsed
}

export const createEventRecorder = (
  apiServer: ApiServerFacade,
  eventBus: EventBus,
  options: CreateEventRecorderOptions = {}
): EventRecorder => {
  const eventTtlMs = options.eventTtlMs ?? DEFAULT_EVENT_TTL_MS
  const now = options.now ?? (() => new Date())
  let unsubscribe: (() => void) | undefined

  const cleanupExpiredEvents = (): void => {
    const currentTime = now().getTime()
    const events = apiServer.listResources('Event')
    for (const event of events) {
      const lastTimestampMs = parseTimestampMs(event.lastTimestamp)
      if (lastTimestampMs == null) {
        continue
      }
      if (currentTime - lastTimestampMs <= eventTtlMs) {
        continue
      }
      apiServer.deleteResource('Event', event.metadata.name, event.metadata.namespace)
    }
  }

  const createOrAggregateEvent = (
    candidate: EventRecordCandidate,
    observedAt: string
  ): void => {
    const eventName = buildEventName(candidate)
    const existingResult = apiServer.findResource(
      'Event',
      eventName,
      candidate.namespace
    )
    if (existingResult.ok) {
      const existing = existingResult.value as Event
      const updated = createEvent({
        name: existing.metadata.name,
        namespace: existing.metadata.namespace,
        involvedObject: existing.involvedObject,
        reason: existing.reason,
        message: existing.message,
        type: existing.type,
        count: existing.count + 1,
        firstTimestamp: existing.firstTimestamp,
        lastTimestamp: observedAt,
        creationTimestamp: existing.metadata.creationTimestamp,
        resourceVersion: existing.metadata.resourceVersion,
        uid: existing.metadata.uid,
        eventTime: observedAt,
        reportingComponent:
          candidate.reportingComponent ?? existing.reportingComponent,
        reportingInstance:
          candidate.reportingInstance ?? existing.reportingInstance,
        action: candidate.action ?? existing.action
      })
      apiServer.updateResource(
        'Event',
        existing.metadata.name,
        updated,
        existing.metadata.namespace
      )
      return
    }
    const created = createEvent({
      name: eventName,
      namespace: candidate.namespace,
      involvedObject: candidate.involvedObject,
      reason: candidate.reason,
      message: candidate.message,
      type: candidate.type,
      count: 1,
      firstTimestamp: observedAt,
      lastTimestamp: observedAt,
      creationTimestamp: observedAt,
      eventTime: observedAt,
      reportingComponent: candidate.reportingComponent,
      reportingInstance: candidate.reportingInstance,
      action: candidate.action
    })
    apiServer.createResource('Event', created, candidate.namespace)
  }

  const reconcile = (event: ClusterEvent): void => {
    const candidate = mapClusterEventToCandidate(event)
    if (candidate == null) {
      return
    }
    cleanupExpiredEvents()
    createOrAggregateEvent(candidate, event.timestamp)
  }

  const initialSync = (): void => {
    cleanupExpiredEvents()
  }

  const resyncAll = (): void => {
    cleanupExpiredEvents()
  }

  const start = (): void => {
    if (unsubscribe != null) {
      return
    }
    initialSync()
    unsubscribe = eventBus.subscribeAll((event) => {
      if (!isClusterEvent(event)) {
        return
      }
      reconcile(event)
    })
  }

  const stop = (): void => {
    if (unsubscribe == null) {
      return
    }
    unsubscribe()
    unsubscribe = undefined
  }

  return {
    start,
    stop,
    reconcile,
    initialSync,
    resyncAll
  }
}
