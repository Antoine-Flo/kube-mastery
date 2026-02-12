import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEventBus,
  type EventBus
} from '../../../../src/core/cluster/events/EventBus'
import type {
  PodCreatedEvent,
  PodDeletedEvent
} from '../../../../src/core/cluster/events/types'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import type { AppEvent } from '../../../../src/core/events/AppEvent'

describe('EventBus', () => {
  let eventBus: EventBus

  const createTestPod = (name: string) =>
    createPod({
      name,
      namespace: 'default',
      containers: [{ name: 'main', image: 'nginx:latest' }]
    })

  const createPodCreatedEvent = (name: string): PodCreatedEvent => ({
    type: 'PodCreated',
    timestamp: new Date().toISOString(),
    payload: { pod: createTestPod(name) }
  })

  const createPodDeletedEvent = (name: string): PodDeletedEvent => ({
    type: 'PodDeleted',
    timestamp: new Date().toISOString(),
    payload: {
      name,
      namespace: 'default',
      deletedPod: createTestPod(name)
    }
  })

  beforeEach(() => {
    eventBus = createEventBus()
  })

  describe('emit and subscribe', () => {
    it('should notify subscriber when event is emitted', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('PodCreated', subscriber)

      const event = createPodCreatedEvent('test-pod')
      eventBus.emit(event)

      expect(subscriber).toHaveBeenCalledWith(event)
      expect(subscriber).toHaveBeenCalledTimes(1)
    })

    it('should not notify subscriber for different event type', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('PodDeleted', subscriber)

      const event = createPodCreatedEvent('test-pod')
      eventBus.emit(event)

      expect(subscriber).not.toHaveBeenCalled()
    })

    it('should notify multiple subscribers for same event type', () => {
      const subscriber1 = vi.fn()
      const subscriber2 = vi.fn()

      eventBus.subscribe('PodCreated', subscriber1)
      eventBus.subscribe('PodCreated', subscriber2)

      const event = createPodCreatedEvent('test-pod')
      eventBus.emit(event)

      expect(subscriber1).toHaveBeenCalledWith(event)
      expect(subscriber2).toHaveBeenCalledWith(event)
    })

    it('should support multiple event types', () => {
      const createSubscriber = vi.fn()
      const deleteSubscriber = vi.fn()

      eventBus.subscribe('PodCreated', createSubscriber)
      eventBus.subscribe('PodDeleted', deleteSubscriber)

      const createEvent = createPodCreatedEvent('pod-1')
      const deleteEvent = createPodDeletedEvent('pod-2')

      eventBus.emit(createEvent)
      eventBus.emit(deleteEvent)

      expect(createSubscriber).toHaveBeenCalledWith(createEvent)
      expect(deleteSubscriber).toHaveBeenCalledWith(deleteEvent)
    })
  })

  describe('unsubscribe', () => {
    it('should stop notifying after unsubscribe', () => {
      const subscriber = vi.fn()
      const unsubscribe = eventBus.subscribe('PodCreated', subscriber)

      eventBus.emit(createPodCreatedEvent('pod-1'))
      expect(subscriber).toHaveBeenCalledTimes(1)

      unsubscribe()

      eventBus.emit(createPodCreatedEvent('pod-2'))
      expect(subscriber).toHaveBeenCalledTimes(1) // Still 1, not called again
    })

    it('should not affect other subscribers when one unsubscribes', () => {
      const subscriber1 = vi.fn()
      const subscriber2 = vi.fn()

      const unsubscribe1 = eventBus.subscribe('PodCreated', subscriber1)
      eventBus.subscribe('PodCreated', subscriber2)

      unsubscribe1()

      const event = createPodCreatedEvent('test-pod')
      eventBus.emit(event)

      expect(subscriber1).not.toHaveBeenCalled()
      expect(subscriber2).toHaveBeenCalledWith(event)
    })
  })

  describe('subscribeAll', () => {
    it('should receive all event types', () => {
      const subscriber = vi.fn()
      eventBus.subscribeAll(subscriber)

      const createEvent = createPodCreatedEvent('pod-1')
      const deleteEvent = createPodDeletedEvent('pod-2')

      eventBus.emit(createEvent)
      eventBus.emit(deleteEvent)

      expect(subscriber).toHaveBeenCalledTimes(2)
      expect(subscriber).toHaveBeenCalledWith(createEvent)
      expect(subscriber).toHaveBeenCalledWith(deleteEvent)
    })

    it('should unsubscribe from all events', () => {
      const subscriber = vi.fn()
      const unsubscribe = eventBus.subscribeAll(subscriber)

      eventBus.emit(createPodCreatedEvent('pod-1'))
      expect(subscriber).toHaveBeenCalledTimes(1)

      unsubscribe()

      eventBus.emit(createPodDeletedEvent('pod-2'))
      expect(subscriber).toHaveBeenCalledTimes(1)
    })
  })

  describe('subscribeFiltered', () => {
    it('should only receive events matching filter', () => {
      const subscriber = vi.fn()
      const filter = (event: AppEvent) => event.type === 'PodCreated'

      eventBus.subscribeFiltered(filter, subscriber)

      const createEvent = createPodCreatedEvent('pod-1')
      const deleteEvent = createPodDeletedEvent('pod-2')

      eventBus.emit(createEvent)
      eventBus.emit(deleteEvent)

      expect(subscriber).toHaveBeenCalledTimes(1)
      expect(subscriber).toHaveBeenCalledWith(createEvent)
    })

    it('should filter by payload content', () => {
      const subscriber = vi.fn()
      const filter = (event: AppEvent) => {
        if (event.type === 'PodCreated') {
          return event.payload.pod.metadata.name.startsWith('important-')
        }
        return false
      }

      eventBus.subscribeFiltered(filter, subscriber)

      eventBus.emit(createPodCreatedEvent('important-pod'))
      eventBus.emit(createPodCreatedEvent('normal-pod'))

      expect(subscriber).toHaveBeenCalledTimes(1)
    })

    it('should unsubscribe filtered subscription', () => {
      const subscriber = vi.fn()
      const filter = () => true

      const unsubscribe = eventBus.subscribeFiltered(filter, subscriber)

      eventBus.emit(createPodCreatedEvent('pod-1'))
      expect(subscriber).toHaveBeenCalledTimes(1)

      unsubscribe()

      eventBus.emit(createPodCreatedEvent('pod-2'))
      expect(subscriber).toHaveBeenCalledTimes(1)
    })
  })

  describe('event history', () => {
    it('should store events in history', () => {
      const event1 = createPodCreatedEvent('pod-1')
      const event2 = createPodCreatedEvent('pod-2')

      eventBus.emit(event1)
      eventBus.emit(event2)

      const history = eventBus.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0]).toEqual(event1)
      expect(history[1]).toEqual(event2)
    })

    it('should return readonly history copy', () => {
      eventBus.emit(createPodCreatedEvent('pod-1'))

      const history1 = eventBus.getHistory()
      const history2 = eventBus.getHistory()

      expect(history1).not.toBe(history2) // Different array instances
    })

    it('should clear history', () => {
      eventBus.emit(createPodCreatedEvent('pod-1'))
      eventBus.emit(createPodCreatedEvent('pod-2'))

      expect(eventBus.getHistory()).toHaveLength(2)

      eventBus.clearHistory()

      expect(eventBus.getHistory()).toHaveLength(0)
    })

    it('should filter history', () => {
      eventBus.emit(createPodCreatedEvent('pod-1'))
      eventBus.emit(createPodDeletedEvent('pod-2'))
      eventBus.emit(createPodCreatedEvent('pod-3'))

      const filter = (event: AppEvent) => event.type === 'PodCreated'
      const filtered = eventBus.getHistoryFiltered(filter)

      expect(filtered).toHaveLength(2)
      expect(filtered[0].type).toBe('PodCreated')
      expect(filtered[1].type).toBe('PodCreated')
    })
  })

  describe('history options', () => {
    it('should disable history when option is false', () => {
      const bus = createEventBus({ enableHistory: false })

      bus.emit(createPodCreatedEvent('pod-1'))
      bus.emit(createPodCreatedEvent('pod-2'))

      expect(bus.getHistory()).toHaveLength(0)
    })

    it('should limit history size with FIFO rotation', () => {
      const bus = createEventBus({ maxHistorySize: 3 })

      bus.emit(createPodCreatedEvent('pod-1'))
      bus.emit(createPodCreatedEvent('pod-2'))
      bus.emit(createPodCreatedEvent('pod-3'))
      bus.emit(createPodCreatedEvent('pod-4'))

      const history = bus.getHistory()
      expect(history).toHaveLength(3)

      // First event should be dropped
      expect((history[0] as PodCreatedEvent).payload.pod.metadata.name).toBe(
        'pod-2'
      )
      expect((history[2] as PodCreatedEvent).payload.pod.metadata.name).toBe(
        'pod-4'
      )
    })
  })

  describe('default options', () => {
    it('should enable history by default', () => {
      const bus = createEventBus()

      bus.emit(createPodCreatedEvent('pod-1'))

      expect(bus.getHistory()).toHaveLength(1)
    })
  })

  describe('subscriber execution order', () => {
    it('should call allSubscribers before typeSubscribers', () => {
      const callOrder: string[] = []

      eventBus.subscribeAll(() => {
        callOrder.push('all')
      })

      eventBus.subscribe('PodCreated', () => {
        callOrder.push('type')
      })

      eventBus.emit(createPodCreatedEvent('pod-1'))

      expect(callOrder).toEqual(['all', 'type'])
    })

    it('should call allSubscribers before filteredSubscribers', () => {
      const callOrder: string[] = []

      eventBus.subscribeAll(() => {
        callOrder.push('all')
      })

      eventBus.subscribeFiltered(
        () => true,
        () => {
          callOrder.push('filtered')
        }
      )

      eventBus.emit(createPodCreatedEvent('pod-1'))

      expect(callOrder).toEqual(['all', 'filtered'])
    })

    it('should call typeSubscribers before filteredSubscribers', () => {
      const callOrder: string[] = []

      eventBus.subscribe('PodCreated', () => {
        callOrder.push('type')
      })

      eventBus.subscribeFiltered(
        () => true,
        () => {
          callOrder.push('filtered')
        }
      )

      eventBus.emit(createPodCreatedEvent('pod-1'))

      expect(callOrder).toEqual(['type', 'filtered'])
    })

    it('should maintain order: all -> type -> filtered', () => {
      const callOrder: string[] = []

      // Subscribe in reverse order to verify it's not just insertion order
      eventBus.subscribeFiltered(
        () => true,
        () => {
          callOrder.push('filtered')
        }
      )

      eventBus.subscribe('PodCreated', () => {
        callOrder.push('type')
      })

      eventBus.subscribeAll(() => {
        callOrder.push('all')
      })

      eventBus.emit(createPodCreatedEvent('pod-1'))

      expect(callOrder).toEqual(['all', 'type', 'filtered'])
    })
  })
})
