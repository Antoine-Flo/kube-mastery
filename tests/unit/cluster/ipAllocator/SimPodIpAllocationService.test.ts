import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import {
  createPodDeletedEvent,
  createPodUpdatedEvent,
  type PodUpdatedEvent
} from '../../../../src/core/cluster/events/types'
import { createSimPodIpAllocator } from '../../../../src/core/cluster/ipAllocator/SimPodIpAllocator'
import { initializeSimPodIpAllocation } from '../../../../src/core/cluster/ipAllocator/SimPodIpAllocationService'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'

describe('initializeSimPodIpAllocation', () => {
  it('assigns podIP when pod becomes Running', () => {
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    const initialPod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }],
      phase: 'Pending'
    })
    apiServer.createResource('Pod', initialPod)
    const stop = initializeSimPodIpAllocation(apiServer)

    let updatedPodWithIp: string | undefined
    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      if (event.metadata?.source === 'sim-ip-allocator') {
        updatedPodWithIp = event.payload.pod.status.podIP
        expect(event.payload.pod.status.podIPs?.[0]?.ip).toBe(
          event.payload.pod.status.podIP
        )
      }
    })

    const runningPod = {
      ...initialPod,
      status: {
        ...initialPod.status,
        phase: 'Running' as const
      }
    }
    eventBus.emit(
      createPodUpdatedEvent(
        runningPod.metadata.name,
        runningPod.metadata.namespace,
        runningPod,
        initialPod,
        'test'
      )
    )

    expect(updatedPodWithIp).toBeDefined()
    stop()
  })

  it('releases pod IP on PodDeleted', () => {
    const allocator = createSimPodIpAllocator()
    const pod = createPod({
      name: 'api',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }],
      phase: 'Running'
    })
    const first = allocator.assign(pod)
    allocator.release(pod)
    const second = allocator.assign(pod)
    expect(second).toBe(first)

    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    apiServer.createResource('Pod', pod)
    const stop = initializeSimPodIpAllocation(apiServer)
    eventBus.emit(
      createPodDeletedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        pod,
        'test'
      )
    )
    stop()
  })
})
