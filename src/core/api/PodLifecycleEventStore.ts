import type {
  ClusterEvent,
  PodDeletedEvent,
  PodBoundEvent,
  PodUpdatedEvent
} from '../cluster/events/types'
import type { EtcdLikeStore } from '../etcd/EtcdLikeStore'
import type { Pod, ContainerStatus } from '../cluster/ressources/Pod'

export interface PodLifecycleDescribeEvent {
  type: 'Normal' | 'Warning'
  reason: string
  source: string
  message: string
  timestamp: string
}

export interface PodLifecycleEventStore {
  listPodEvents: (
    namespace: string,
    podName: string
  ) => readonly PodLifecycleDescribeEvent[]
  stop: () => void
}

const MAX_EVENTS_PER_POD = 100

const buildPodKey = (namespace: string, podName: string): string => {
  return `${namespace}/${podName}`
}

const getPrimaryContainerStatus = (
  pod: Pod | undefined
): ContainerStatus | undefined => {
  if (pod == null) {
    return undefined
  }
  const primaryContainer = pod.spec.containers[0]
  if (primaryContainer == null) {
    return undefined
  }
  return (pod.status.containerStatuses ?? []).find((status) => {
    return status.name === primaryContainer.name
  })
}

const buildLifecycleWarningEvent = (
  pod: Pod,
  reason: string,
  timestamp: string
): PodLifecycleDescribeEvent | undefined => {
  const primaryContainer = pod.spec.containers[0]
  const containerName = primaryContainer?.name ?? 'container'
  const containerImage = primaryContainer?.image ?? '<unknown>'
  if (reason === 'ErrImagePull') {
    return {
      type: 'Warning',
      reason: 'Failed',
      source: 'kubelet',
      message: `Failed to pull image "${containerImage}": image not found`,
      timestamp
    }
  }
  if (reason === 'ImagePullBackOff') {
    return {
      type: 'Warning',
      reason: 'BackOff',
      source: 'kubelet',
      message: `Back-off pulling image "${containerImage}"`,
      timestamp
    }
  }
  if (reason === 'CrashLoopBackOff') {
    return {
      type: 'Warning',
      reason: 'BackOff',
      source: 'kubelet',
      message: `Back-off restarting failed container ${containerName} in pod ${pod.metadata.namespace}/${pod.metadata.name}`,
      timestamp
    }
  }
  if (
    reason === 'VolumesNotReady' ||
    reason === 'WaitingForPVC' ||
    reason === 'PersistentVolumeClaimPending' ||
    reason === 'PersistentVolumeClaimNotFound'
  ) {
    return {
      type: 'Warning',
      reason: 'FailedMount',
      source: 'kubelet',
      message:
        'Unable to attach or mount volumes: timed out waiting for condition',
      timestamp
    }
  }
  return undefined
}

const shouldEmitWarningForReasonTransition = (
  previousStatus: ContainerStatus | undefined,
  currentStatus: ContainerStatus | undefined
): boolean => {
  const currentReason = currentStatus?.stateDetails?.reason
  if (currentReason == null || currentReason.length === 0) {
    return false
  }
  const previousReason = previousStatus?.stateDetails?.reason
  if (previousReason !== currentReason) {
    return true
  }
  if (currentReason !== 'CrashLoopBackOff') {
    return false
  }
  const previousRestartCount = previousStatus?.restartCount ?? 0
  const currentRestartCount = currentStatus?.restartCount ?? 0
  return currentRestartCount > previousRestartCount
}

const isTransitionToRunning = (
  previousStatus: ContainerStatus | undefined,
  currentStatus: ContainerStatus | undefined
): boolean => {
  const previousState = previousStatus?.stateDetails?.state
  const currentState = currentStatus?.stateDetails?.state
  if (currentState !== 'Running') {
    return false
  }
  return previousState !== 'Running'
}

const isTransitionToTerminated = (
  previousStatus: ContainerStatus | undefined,
  currentStatus: ContainerStatus | undefined
): boolean => {
  const previousState = previousStatus?.stateDetails?.state
  const currentState = currentStatus?.stateDetails?.state
  if (currentState !== 'Terminated') {
    return false
  }
  return previousState !== 'Terminated'
}

const buildTerminationEvents = (
  pod: Pod,
  previousStatus: ContainerStatus | undefined,
  currentStatus: ContainerStatus | undefined,
  timestamp: string
): readonly PodLifecycleDescribeEvent[] => {
  if (!isTransitionToTerminated(previousStatus, currentStatus)) {
    return []
  }
  const primaryContainer = pod.spec.containers[0]
  const containerName = primaryContainer?.name ?? 'container'
  const terminatedReason = currentStatus?.stateDetails?.reason ?? 'Error'
  const terminatedExitCode = currentStatus?.stateDetails?.exitCode ?? 1
  const events: PodLifecycleDescribeEvent[] = [
    {
      type: 'Normal',
      reason: 'Killing',
      source: 'kubelet',
      message: `Stopping container ${containerName}`,
      timestamp
    }
  ]
  if (terminatedExitCode === 0 || terminatedReason === 'Completed') {
    events.push({
      type: 'Normal',
      reason: 'Completed',
      source: 'kubelet',
      message: `Container ${containerName} exited successfully`,
      timestamp
    })
    return events
  }
  events.push({
    type: 'Warning',
    reason: 'Failed',
    source: 'kubelet',
    message: `Container ${containerName} terminated with exit code ${terminatedExitCode} (${terminatedReason})`,
    timestamp
  })
  return events
}

const trimEvents = (
  events: readonly PodLifecycleDescribeEvent[]
): readonly PodLifecycleDescribeEvent[] => {
  if (events.length <= MAX_EVENTS_PER_POD) {
    return events
  }
  return events.slice(events.length - MAX_EVENTS_PER_POD)
}

export const createPodLifecycleEventStore = (
  etcd: EtcdLikeStore
): PodLifecycleEventStore => {
  const podEventHistory = new Map<
    string,
    readonly PodLifecycleDescribeEvent[]
  >()
  let stopped = false
  let cachedRevision = 0

  const appendPodEvent = (
    namespace: string,
    podName: string,
    event: PodLifecycleDescribeEvent
  ): void => {
    const key = buildPodKey(namespace, podName)
    const previousEvents = podEventHistory.get(key) ?? []
    const nextEvents = trimEvents([...previousEvents, event])
    podEventHistory.set(key, nextEvents)
  }

  const onPodBound = (event: PodBoundEvent): void => {
    appendPodEvent(event.payload.namespace, event.payload.name, {
      type: 'Normal',
      reason: 'Scheduled',
      source: 'default-scheduler',
      message: `Successfully assigned ${event.payload.namespace}/${event.payload.name} to ${event.payload.nodeName}`,
      timestamp: event.timestamp
    })
  }

  const onPodUpdated = (event: PodUpdatedEvent): void => {
    const namespace = event.payload.namespace
    const podName = event.payload.name
    const currentPod = event.payload.pod
    const previousPod = event.payload.previousPod
    const currentStatus = getPrimaryContainerStatus(currentPod)
    const previousStatus = getPrimaryContainerStatus(previousPod)

    if (isTransitionToRunning(previousStatus, currentStatus)) {
      const primaryContainer = currentPod.spec.containers[0]
      const containerName = primaryContainer?.name ?? 'container'
      const containerImage = primaryContainer?.image ?? '<unknown>'
      appendPodEvent(namespace, podName, {
        type: 'Normal',
        reason: 'Pulled',
        source: 'kubelet',
        message: `spec.containers{${containerName}}: Container image "${containerImage}" already present on machine and can be accessed by the pod`,
        timestamp: event.timestamp
      })
      appendPodEvent(namespace, podName, {
        type: 'Normal',
        reason: 'Created',
        source: 'kubelet',
        message: `spec.containers{${containerName}}: Container created`,
        timestamp: event.timestamp
      })
      appendPodEvent(namespace, podName, {
        type: 'Normal',
        reason: 'Started',
        source: 'kubelet',
        message: `spec.containers{${containerName}}: Container started`,
        timestamp: event.timestamp
      })
    }

    const terminationEvents = buildTerminationEvents(
      currentPod,
      previousStatus,
      currentStatus,
      event.timestamp
    )
    for (const terminationEvent of terminationEvents) {
      appendPodEvent(namespace, podName, terminationEvent)
    }

    if (shouldEmitWarningForReasonTransition(previousStatus, currentStatus)) {
      const reason = currentStatus?.stateDetails?.reason
      if (reason != null) {
        const warningEvent = buildLifecycleWarningEvent(
          currentPod,
          reason,
          event.timestamp
        )
        if (warningEvent != null) {
          appendPodEvent(namespace, podName, warningEvent)
        }
      }
    }
  }

  const onPodDeleted = (event: PodDeletedEvent): void => {
    const key = buildPodKey(event.payload.namespace, event.payload.name)
    podEventHistory.delete(key)
  }

  const rebuildCacheFromEventLog = (): void => {
    podEventHistory.clear()
    const log = etcd.getEventLog()
    for (const record of log) {
      const event = record.event
      if (
        event.type !== 'PodBound' &&
        event.type !== 'PodUpdated' &&
        event.type !== 'PodDeleted'
      ) {
        continue
      }
      const clusterEvent = event as ClusterEvent
      if (clusterEvent.type === 'PodBound') {
        onPodBound(clusterEvent)
        continue
      }
      if (clusterEvent.type === 'PodUpdated') {
        onPodUpdated(clusterEvent)
        continue
      }
      onPodDeleted(clusterEvent as PodDeletedEvent)
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
    listPodEvents: (namespace: string, podName: string) => {
      if (stopped) {
        return []
      }
      refreshCacheIfNeeded()
      const key = buildPodKey(namespace, podName)
      return podEventHistory.get(key) ?? []
    },
    stop: () => {
      if (stopped) {
        return
      }
      stopped = true
      podEventHistory.clear()
    }
  }
}
