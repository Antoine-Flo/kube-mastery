import type {
  ClusterEvent,
  PersistentVolumeClaimDeletedEvent,
  PersistentVolumeClaimLifecycleEvent
} from '../cluster/events/types'
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
    const key = buildPersistentVolumeClaimKey(
      namespace,
      persistentVolumeClaimName
    )
    const previousEvents = persistentVolumeClaimEventHistory.get(key) ?? []
    persistentVolumeClaimEventHistory.set(
      key,
      trimEvents([...previousEvents, event])
    )
  }

  const onPersistentVolumeClaimLifecycle = (
    event: PersistentVolumeClaimLifecycleEvent
  ): void => {
    appendPersistentVolumeClaimEvent(
      event.payload.namespace,
      event.payload.name,
      {
        type: event.payload.eventType,
        reason: event.payload.reason,
        source: event.payload.source,
        message: event.payload.message,
        timestamp: event.timestamp
      }
    )
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
      if (event.type === 'PersistentVolumeClaimLifecycle') {
        onPersistentVolumeClaimLifecycle(event)
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
      const key = buildPersistentVolumeClaimKey(
        namespace,
        persistentVolumeClaimName
      )
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
