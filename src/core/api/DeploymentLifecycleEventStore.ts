import type {
  ClusterEvent,
  DeploymentDeletedEvent,
  DeploymentScaledEvent
} from '../cluster/events/types'
import type { EtcdLikeStore } from '../etcd/EtcdLikeStore'

export interface DeploymentLifecycleDescribeEvent {
  type: 'Normal' | 'Warning'
  reason: string
  source: string
  message: string
  timestamp: string
}

export interface DeploymentLifecycleEventStore {
  listDeploymentEvents: (
    namespace: string,
    deploymentName: string
  ) => readonly DeploymentLifecycleDescribeEvent[]
  stop: () => void
}

const MAX_EVENTS_PER_DEPLOYMENT = 100

const buildDeploymentKey = (
  namespace: string,
  deploymentName: string
): string => {
  return `${namespace}/${deploymentName}`
}

const trimEvents = (
  events: readonly DeploymentLifecycleDescribeEvent[]
): readonly DeploymentLifecycleDescribeEvent[] => {
  if (events.length <= MAX_EVENTS_PER_DEPLOYMENT) {
    return events
  }
  return events.slice(events.length - MAX_EVENTS_PER_DEPLOYMENT)
}

const toDescribeEvent = (
  event: DeploymentScaledEvent
): DeploymentLifecycleDescribeEvent => {
  return {
    type: 'Normal',
    reason: event.payload.reason,
    source: event.metadata?.source ?? 'deployment-controller',
    message: event.payload.message,
    timestamp: event.timestamp
  }
}

export const createDeploymentLifecycleEventStore = (
  etcd: EtcdLikeStore
): DeploymentLifecycleEventStore => {
  const deploymentEventHistory = new Map<
    string,
    readonly DeploymentLifecycleDescribeEvent[]
  >()
  let stopped = false
  let cachedRevision = 0

  const appendDeploymentEvent = (
    namespace: string,
    deploymentName: string,
    event: DeploymentLifecycleDescribeEvent
  ): void => {
    const key = buildDeploymentKey(namespace, deploymentName)
    const previousEvents = deploymentEventHistory.get(key) ?? []
    deploymentEventHistory.set(key, trimEvents([...previousEvents, event]))
  }

  const onDeploymentScaled = (event: DeploymentScaledEvent): void => {
    appendDeploymentEvent(
      event.payload.namespace,
      event.payload.deploymentName,
      toDescribeEvent(event)
    )
  }

  const onDeploymentDeleted = (event: DeploymentDeletedEvent): void => {
    const key = buildDeploymentKey(event.payload.namespace, event.payload.name)
    deploymentEventHistory.delete(key)
  }

  const rebuildCacheFromEventLog = (): void => {
    deploymentEventHistory.clear()
    const log = etcd.getEventLog()
    for (const record of log) {
      const event = record.event as ClusterEvent
      if (event.type === 'DeploymentScaled') {
        onDeploymentScaled(event)
        continue
      }
      if (event.type === 'DeploymentDeleted') {
        onDeploymentDeleted(event)
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
    listDeploymentEvents: (namespace: string, deploymentName: string) => {
      if (stopped) {
        return []
      }
      refreshCacheIfNeeded()
      const key = buildDeploymentKey(namespace, deploymentName)
      return deploymentEventHistory.get(key) ?? []
    },
    stop: () => {
      if (stopped) {
        return
      }
      stopped = true
      deploymentEventHistory.clear()
    }
  }
}
