import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEventBus, type EventBus } from '../../../src/core/cluster/events/EventBus'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createFileCreatedEvent } from '../../../src/core/filesystem/events/types'
import { createFile } from '../../../src/core/filesystem/models/File'
import { createPodCreatedEvent } from '../../../src/core/cluster/events/types'
import type { AppEvent } from '../../../src/core/events/AppEvent'

describe('AppEvent Integration', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = createEventBus()
  })

  describe('mixed event types', () => {
    it('should handle both cluster and filesystem events', () => {
      const allSubscriber = vi.fn()
      const clusterSubscriber = vi.fn()
      const filesystemSubscriber = vi.fn()

      eventBus.subscribeAll(allSubscriber)
      eventBus.subscribe('PodCreated', clusterSubscriber)
      eventBus.subscribe('FileCreated', filesystemSubscriber)

      const podEvent = createPodCreatedEvent(
        createPod({
          name: 'test-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        }),
        'kubectl'
      )

      const fileEvent = createFileCreatedEvent(
        createFile('test.txt', '/home/test.txt', 'content'),
        '/home/test.txt',
        'filesystem'
      )

      eventBus.emit(podEvent)
      eventBus.emit(fileEvent)

      // subscribeAll should receive both
      expect(allSubscriber).toHaveBeenCalledTimes(2)
      expect(allSubscriber).toHaveBeenCalledWith(podEvent)
      expect(allSubscriber).toHaveBeenCalledWith(fileEvent)

      // Type-specific subscribers
      expect(clusterSubscriber).toHaveBeenCalledTimes(1)
      expect(clusterSubscriber).toHaveBeenCalledWith(podEvent)
      expect(filesystemSubscriber).toHaveBeenCalledTimes(1)
      expect(filesystemSubscriber).toHaveBeenCalledWith(fileEvent)
    })
  })

  describe('event history with mixed types', () => {
    it('should store both cluster and filesystem events in history', () => {
      const podEvent = createPodCreatedEvent(
        createPod({
          name: 'test-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        }),
        'kubectl'
      )

      const fileEvent = createFileCreatedEvent(
        createFile('test.txt', '/home/test.txt', 'content'),
        '/home/test.txt',
        'filesystem'
      )

      eventBus.emit(podEvent)
      eventBus.emit(fileEvent)

      const history = eventBus.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0].type).toBe('PodCreated')
      expect(history[1].type).toBe('FileCreated')
    })
  })

  describe('filtered subscription with mixed types', () => {
    it('should filter by event domain', () => {
      const filesystemSubscriber = vi.fn()
      const filter = (event: AppEvent) => event.type.startsWith('File') || event.type.startsWith('Directory')

      eventBus.subscribeFiltered(filter, filesystemSubscriber)

      const podEvent = createPodCreatedEvent(
        createPod({
          name: 'test-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        }),
        'kubectl'
      )

      const fileEvent = createFileCreatedEvent(
        createFile('test.txt', '/home/test.txt', 'content'),
        '/home/test.txt',
        'filesystem'
      )

      eventBus.emit(podEvent)
      eventBus.emit(fileEvent)

      expect(filesystemSubscriber).toHaveBeenCalledTimes(1)
      expect(filesystemSubscriber).toHaveBeenCalledWith(fileEvent)
    })

    it('should filter by source metadata', () => {
      const kubectlSubscriber = vi.fn()
      const filter = (event: AppEvent) => event.metadata?.source === 'kubectl'

      eventBus.subscribeFiltered(filter, kubectlSubscriber)

      const podEvent = createPodCreatedEvent(
        createPod({
          name: 'test-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        }),
        'kubectl'
      )

      const fileEvent = createFileCreatedEvent(
        createFile('test.txt', '/home/test.txt', 'content'),
        '/home/test.txt',
        'filesystem'
      )

      eventBus.emit(podEvent)
      eventBus.emit(fileEvent)

      expect(kubectlSubscriber).toHaveBeenCalledTimes(1)
      expect(kubectlSubscriber).toHaveBeenCalledWith(podEvent)
    })
  })
})
