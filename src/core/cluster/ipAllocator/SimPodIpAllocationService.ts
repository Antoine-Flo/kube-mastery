import type { ApiServerFacade } from '../../api/ApiServerFacade'
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
  emitEvent: ApiServerFacade['emitEvent'],
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
      emitEvent(
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
  emitEvent(
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
  apiServer: ApiServerFacade
): (() => void) => {
  const eventBus = apiServer.getEventBus()
  const emitEvent = apiServer.emitEvent
  const allocator = createSimPodIpAllocator()
  const existingPods = apiServer.listResources('Pod')
  for (const pod of existingPods) {
    ensurePodIpIfRunning(emitEvent, pod, allocator, 'sim-ip-allocator-initial')
  }

  const unsubscribePodUpdated = eventBus.subscribe(
    'PodUpdated',
    (event: PodUpdatedEvent) => {
      ensurePodIpIfRunning(
        emitEvent,
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
