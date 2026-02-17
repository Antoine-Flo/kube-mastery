import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { createPodCreatedEvent } from '../../../src/core/cluster/events/types'
import { createPod } from '../../../src/core/cluster/ressources/Pod'

describe('pod lifecycle scheduling invariants', () => {
  it('keeps newly created unscheduled pod in Pending', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const pod = createPod({
      name: 'nginx',
      namespace: 'default',
      phase: 'Pending',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })

    eventBus.emit(createPodCreatedEvent(pod, 'test'))

    const stored = clusterState.findPod('nginx', 'default')
    expect(stored.ok).toBe(true)
    if (!stored.ok) {
      return
    }
    expect(stored.value.spec.nodeName).toBeUndefined()
    expect(stored.value.status.phase).toBe('Pending')
  })
})
