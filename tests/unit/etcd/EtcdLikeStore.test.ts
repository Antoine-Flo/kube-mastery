import { describe, expect, it } from 'vitest'
import { createEtcdLikeStore } from '../../../src/core/etcd/EtcdLikeStore'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createStatefulSet } from '../../../src/core/cluster/ressources/StatefulSet'
import { CLUSTER_MUTATION_EVENT_TYPES } from '../../../src/core/cluster/events/handlers'
import {
  createPodCreatedEvent,
  createPodDeletedEvent,
  createStatefulSetCreatedEvent
} from '../../../src/core/cluster/events/types'

describe('EtcdLikeStore', () => {
  it('increments revision on cluster mutations and restore', () => {
    const eventBus = createEventBus()
    const store = createEtcdLikeStore(eventBus)

    expect(store.getRevision()).toBe(1)
    expect(store.getResourceVersion()).toBe('1')

    const pod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'web', image: 'nginx:latest' }]
    })
    store.appendEvent(createPodCreatedEvent(pod, 'test'))
    expect(store.getRevision()).toBe(2)

    const foundPod = store.findResource('Pod', 'web', 'default')
    expect(foundPod.ok).toBe(true)

    const snapshot = store.snapshot()
    store.appendEvent(createPodDeletedEvent('web', 'default', pod, 'test'))
    store.restore(snapshot)
    expect(store.getRevision()).toBe(4)

    store.dispose()
  })

  it('exposes snapshot with revision metadata', () => {
    const store = createEtcdLikeStore(createEventBus())

    const snapshot = store.snapshotWithRevision()
    expect(snapshot.revision).toBe(1)
    expect(snapshot.state.pods.items.length).toBeGreaterThanOrEqual(0)

    store.dispose()
  })

  it('appends events through store and tracks event log', () => {
    const store = createEtcdLikeStore(createEventBus())
    const pod = createPod({
      name: 'etcd-web',
      namespace: 'default',
      containers: [{ name: 'web', image: 'nginx:latest' }]
    })

    const revision = store.appendEvent(createPodCreatedEvent(pod, 'test'))
    expect(revision).toBe(2)
    expect(store.getRevision()).toBe(2)
    expect(store.getEventLog().length).toBeGreaterThanOrEqual(1)
    expect(store.getEventLog().at(-1)?.event.type).toBe('PodCreated')
    expect(store.getEventLog().at(-1)?.eventType).toBe('PodCreated')
    expect(store.getEventLog().at(-1)?.resourceVersion).toBe('2')

    store.dispose()
  })

  it('increments revision for StatefulSetCreated events', () => {
    const store = createEtcdLikeStore(createEventBus())
    const statefulSet = createStatefulSet({
      name: 'web',
      namespace: 'default',
      selector: { matchLabels: { app: 'web' } },
      template: {
        metadata: { labels: { app: 'web' } },
        spec: {
          containers: [{ name: 'web', image: 'nginx:latest' }]
        }
      }
    })

    expect(store.getRevision()).toBe(1)
    store.appendEvent(createStatefulSetCreatedEvent(statefulSet, 'test'))
    expect(store.getRevision()).toBe(2)

    store.dispose()
  })

  it('includes all previously missing mutation event types', () => {
    const expectedMutationEvents = [
      'StatefulSetCreated',
      'StatefulSetUpdated',
      'StatefulSetDeleted',
      'ControllerRevisionCreated',
      'ControllerRevisionUpdated',
      'ControllerRevisionDeleted',
      'EndpointsCreated',
      'EndpointsUpdated',
      'EndpointsDeleted',
      'EndpointSliceCreated',
      'EndpointSliceUpdated',
      'EndpointSliceDeleted'
    ]

    for (const eventType of expectedMutationEvents) {
      expect(CLUSTER_MUTATION_EVENT_TYPES.has(eventType)).toBe(true)
    }
  })
})
