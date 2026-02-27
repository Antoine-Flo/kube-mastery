import type { ClusterState } from '../ClusterState'
import type { EventBus } from '../events/EventBus'
import {
  createPodUpdatedEvent,
  type PodDeletedEvent,
  type PodUpdatedEvent
} from '../events/types'
import type { Pod } from '../ressources/Pod'
import { createSimPodIpAllocator } from './SimPodIpAllocator'

const withAssignedPodIP = (pod: Pod, podIP: string): Pod => {
  return {
    ...pod,
    status: {
      ...pod.status,
      podIP,
      podIPs: [{ ip: podIP }]
    }
  }
}

const ensurePodIpIfRunning = (
  eventBus: EventBus,
  pod: Pod,
  allocator: ReturnType<typeof createSimPodIpAllocator>,
  source: string
): void => {
  if (pod.status.phase !== 'Running') {
    return
  }
  if (pod.status.podIP != null) {
    allocator.reserve(pod)
    if (
      pod.status.podIPs == null ||
      pod.status.podIPs.length === 0 ||
      pod.status.podIPs[0]?.ip !== pod.status.podIP
    ) {
      eventBus.emit(
        createPodUpdatedEvent(
          pod.metadata.name,
          pod.metadata.namespace,
          withAssignedPodIP(pod, pod.status.podIP),
          pod,
          source
        )
      )
    }
    return
  }
  const allocated = allocator.assign(pod)
  eventBus.emit(
    createPodUpdatedEvent(
      pod.metadata.name,
      pod.metadata.namespace,
      withAssignedPodIP(pod, allocated),
      pod,
      source
    )
  )
}

export const initializeSimPodIpAllocation = (
  eventBus: EventBus,
  clusterState: ClusterState
): (() => void) => {
  const allocator = createSimPodIpAllocator()
  const existingPods = clusterState.getPods()
  for (const pod of existingPods) {
    ensurePodIpIfRunning(eventBus, pod, allocator, 'sim-ip-allocator-initial')
  }

  const unsubscribePodUpdated = eventBus.subscribe(
    'PodUpdated',
    (event: PodUpdatedEvent) => {
      ensurePodIpIfRunning(
        eventBus,
        event.payload.pod,
        allocator,
        'sim-ip-allocator'
      )
    }
  )

  const unsubscribePodDeleted = eventBus.subscribe(
    'PodDeleted',
    (event: PodDeletedEvent) => {
      allocator.release(event.payload.deletedPod)
    }
  )

  return () => {
    unsubscribePodUpdated()
    unsubscribePodDeleted()
  }
}
