import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkQueue, type WorkQueue } from '../../../../src/core/cluster/controllers/WorkQueue'

describe('WorkQueue', () => {
  let queue: WorkQueue

  beforeEach(() => {
    queue = createWorkQueue({ processDelay: 0 })
  })

  describe('add', () => {
    it('should add a key to the queue', () => {
      queue.add('default/my-pod')
      expect(queue.size()).toBe(1)
    })

    it('should deduplicate keys', () => {
      queue.add('default/my-pod')
      queue.add('default/my-pod')
      queue.add('default/my-pod')
      expect(queue.size()).toBe(1)
    })

    it('should accept multiple different keys', () => {
      queue.add('default/pod-1')
      queue.add('default/pod-2')
      queue.add('kube-system/pod-3')
      expect(queue.size()).toBe(3)
    })
  })

  describe('start and stop', () => {
    it('should start processing', () => {
      const handler = vi.fn()
      queue.start(handler)
      expect(queue.isRunning()).toBe(true)
    })

    it('should stop processing', () => {
      const handler = vi.fn()
      queue.start(handler)
      queue.stop()
      expect(queue.isRunning()).toBe(false)
    })

    it('should process items when started', async () => {
      const handler = vi.fn()
      queue.add('default/pod-1')
      queue.start(handler)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handler).toHaveBeenCalledWith('default/pod-1')
      expect(queue.size()).toBe(0)
    })

    it('should process items added after start', async () => {
      const handler = vi.fn()
      queue.start(handler)
      queue.add('default/pod-1')

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handler).toHaveBeenCalledWith('default/pod-1')
    })

    it('should not process after stop', async () => {
      const handler = vi.fn()
      queue.start(handler)
      queue.stop()
      queue.add('default/pod-1')

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(handler).not.toHaveBeenCalled()
      expect(queue.size()).toBe(1)
    })
  })

  describe('processing order', () => {
    it('should process items in FIFO order', async () => {
      const processedKeys: string[] = []
      const handler = (key: string) => {
        processedKeys.push(key)
      }

      queue.add('default/pod-1')
      queue.add('default/pod-2')
      queue.add('default/pod-3')
      queue.start(handler)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(processedKeys).toEqual(['default/pod-1', 'default/pod-2', 'default/pod-3'])
    })
  })

  describe('error handling', () => {
    it('should continue processing after handler error', async () => {
      const processedKeys: string[] = []
      const handler = (key: string) => {
        if (key === 'default/pod-2') {
          throw new Error('Test error')
        }
        processedKeys.push(key)
      }

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      queue.add('default/pod-1')
      queue.add('default/pod-2')
      queue.add('default/pod-3')
      queue.start(handler)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(processedKeys).toEqual(['default/pod-1', 'default/pod-3'])
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('deduplication during processing', () => {
    it('should deduplicate keys added during processing', async () => {
      let callCount = 0
      const handler = vi.fn(() => {
        callCount++
        // Add same key while processing
        if (callCount === 1) {
          queue.add('default/pod-1')
        }
      })

      queue.add('default/pod-1')
      queue.start(handler)

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should be called twice: once for initial add, once for re-add
      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('processDelay option', () => {
    it('should delay processing with processDelay option', async () => {
      const delayedQueue = createWorkQueue({ processDelay: 50 })
      const handler = vi.fn()

      delayedQueue.add('default/pod-1')
      delayedQueue.start(handler)

      // Should not be called immediately
      expect(handler).not.toHaveBeenCalled()

      // Wait for delay
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handler).toHaveBeenCalledWith('default/pod-1')
    })
  })
})
