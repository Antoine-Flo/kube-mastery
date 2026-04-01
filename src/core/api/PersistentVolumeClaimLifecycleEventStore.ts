import type {
  ClusterEvent,
  PersistentVolumeClaimCreatedEvent,
  PersistentVolumeClaimDeletedEvent,
  PersistentVolumeClaimUpdatedEvent
} from '../cluster/events/types'
import type { StorageClass } from '../cluster/ressources/StorageClass'
import type { EtcdLikeStore } from '../etcd/EtcdLikeStore'

export interface PersistentVolumeClaimLifecycleDescribeEvent {
  type: 'Normal' | 'Warning'
  reason: string
  source: string
  message: string
  timestamp: string
}

export interface PersistentVolumeClaimLifecycleEventStore {
  listPersistentVolumeClaimEvents: (
    namespace: string,
    persistentVolumeClaimName: string
  ) => readonly PersistentVolumeClaimLifecycleDescribeEvent[]
  stop: () => void
}

const MAX_EVENTS_PER_PERSISTENT_VOLUME_CLAIM = 200
const WAIT_FOR_FIRST_CONSUMER_REASON = 'WaitForFirstConsumer'

const buildPersistentVolumeClaimKey = (
  namespace: string,
  persistentVolumeClaimName: string
): string => {
  return `${namespace}/${persistentVolumeClaimName}`
}

const trimEvents = (
  events: readonly PersistentVolumeClaimLifecycleDescribeEvent[]
): readonly PersistentVolumeClaimLifecycleDescribeEvent[] => {
  if (events.length <= MAX_EVENTS_PER_PERSISTENT_VOLUME_CLAIM) {
    return events
  }
  return events.slice(events.length - MAX_EVENTS_PER_PERSISTENT_VOLUME_CLAIM)
}

const hasWaitForFirstConsumerMode = (
  etcd: EtcdLikeStore,
  storageClassName: string | undefined
): boolean => {
  if (storageClassName == null || storageClassName.length === 0) {
    return false
  }
  const storageClassResult = etcd.findResource('StorageClass', storageClassName)
  if (!storageClassResult.ok) {
    return false
  }
  const storageClass = storageClassResult.value as StorageClass
  return storageClass.volumeBindingMode === 'WaitForFirstConsumer'
}

const resolveProvisionerSource = (
  etcd: EtcdLikeStore,
  storageClassName: string | undefined
): string => {
  if (storageClassName == null || storageClassName.length === 0) {
    return 'persistentvolume-controller'
  }
  const storageClassResult = etcd.findResource('StorageClass', storageClassName)
  if (!storageClassResult.ok) {
    return `${storageClassName}-provisioner`
  }
  const storageClass = storageClassResult.value as StorageClass
  const provisioner = storageClass.provisioner
  if (provisioner.length === 0) {
    return `${storageClassName}-provisioner`
  }
  const provisionerNameSegment = provisioner.includes('/')
    ? provisioner.split('/').at(-1) ?? provisioner
    : provisioner
  return `${provisioner}_${provisionerNameSegment}-provisioner`
}

export const createPersistentVolumeClaimLifecycleEventStore = (
  etcd: EtcdLikeStore
): PersistentVolumeClaimLifecycleEventStore => {
  const persistentVolumeClaimEventHistory = new Map<
    string,
    readonly PersistentVolumeClaimLifecycleDescribeEvent[]
  >()
  let stopped = false
  let cachedRevision = 0

  const appendPersistentVolumeClaimEvent = (
    namespace: string,
    persistentVolumeClaimName: string,
    event: PersistentVolumeClaimLifecycleDescribeEvent
  ): void => {
    const key = buildPersistentVolumeClaimKey(namespace, persistentVolumeClaimName)
    const previousEvents = persistentVolumeClaimEventHistory.get(key) ?? []
    persistentVolumeClaimEventHistory.set(
      key,
      trimEvents([...previousEvents, event])
    )
  }

  const appendWaitForFirstConsumerEventIfNeeded = (
    event: PersistentVolumeClaimCreatedEvent | PersistentVolumeClaimUpdatedEvent
  ): void => {
    const claim = event.payload.persistentVolumeClaim
    if (claim.status.phase !== 'Pending') {
      return
    }
    if (!hasWaitForFirstConsumerMode(etcd, claim.spec.storageClassName)) {
      return
    }
    appendPersistentVolumeClaimEvent(claim.metadata.namespace, claim.metadata.name, {
      type: 'Normal',
      reason: WAIT_FOR_FIRST_CONSUMER_REASON,
      source: 'persistentvolume-controller',
      message:
        'waiting for first consumer to be created before binding',
      timestamp: event.timestamp
    })
  }

  const appendProvisioningEventsIfNeeded = (
    event: PersistentVolumeClaimUpdatedEvent
  ): void => {
    const currentClaim = event.payload.persistentVolumeClaim
    const previousClaim = event.payload.previousPersistentVolumeClaim
    if (
      previousClaim.status.phase === 'Bound' ||
      currentClaim.status.phase !== 'Bound' ||
      currentClaim.spec.volumeName == null ||
      currentClaim.spec.volumeName.length === 0
    ) {
      return
    }
    const source = resolveProvisionerSource(etcd, currentClaim.spec.storageClassName)
    appendPersistentVolumeClaimEvent(
      currentClaim.metadata.namespace,
      currentClaim.metadata.name,
      {
        type: 'Normal',
        reason: 'Provisioning',
        source,
        message: `External provisioner is provisioning volume for claim "${currentClaim.metadata.namespace}/${currentClaim.metadata.name}"`,
        timestamp: event.timestamp
      }
    )
    appendPersistentVolumeClaimEvent(
      currentClaim.metadata.namespace,
      currentClaim.metadata.name,
      {
        type: 'Normal',
        reason: 'ProvisioningSucceeded',
        source,
        message: `Successfully provisioned volume ${currentClaim.spec.volumeName}`,
        timestamp: event.timestamp
      }
    )
  }

  const onPersistentVolumeClaimCreated = (
    event: PersistentVolumeClaimCreatedEvent
  ): void => {
    appendWaitForFirstConsumerEventIfNeeded(event)
  }

  const onPersistentVolumeClaimUpdated = (
    event: PersistentVolumeClaimUpdatedEvent
  ): void => {
    appendWaitForFirstConsumerEventIfNeeded(event)
    appendProvisioningEventsIfNeeded(event)
  }

  const onPersistentVolumeClaimDeleted = (
    event: PersistentVolumeClaimDeletedEvent
  ): void => {
    const key = buildPersistentVolumeClaimKey(
      event.payload.namespace,
      event.payload.name
    )
    persistentVolumeClaimEventHistory.delete(key)
  }

  const rebuildCacheFromEventLog = (): void => {
    persistentVolumeClaimEventHistory.clear()
    const log = etcd.getEventLog()
    for (const record of log) {
      const event = record.event as ClusterEvent
      if (event.type === 'PersistentVolumeClaimCreated') {
        onPersistentVolumeClaimCreated(event)
        continue
      }
      if (event.type === 'PersistentVolumeClaimUpdated') {
        onPersistentVolumeClaimUpdated(event)
        continue
      }
      if (event.type === 'PersistentVolumeClaimDeleted') {
        onPersistentVolumeClaimDeleted(event)
      }
    }
    cachedRevision = etcd.getRevision()
  }

  const refreshCacheIfNeeded = (): void => {
    const currentRevision = etcd.getRevision()
    if (currentRevision === cachedRevision) {
      return
    }
    rebuildCacheFromEventLog()
  }

  return {
    listPersistentVolumeClaimEvents: (namespace, persistentVolumeClaimName) => {
      if (stopped) {
        return []
      }
      refreshCacheIfNeeded()
      const key = buildPersistentVolumeClaimKey(namespace, persistentVolumeClaimName)
      return persistentVolumeClaimEventHistory.get(key) ?? []
    },
    stop: () => {
      if (stopped) {
        return
      }
      stopped = true
      persistentVolumeClaimEventHistory.clear()
    }
  }
}
