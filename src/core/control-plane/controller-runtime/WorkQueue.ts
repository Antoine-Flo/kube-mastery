// ═══════════════════════════════════════════════════════════════════════════
// WORK QUEUE
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes-style work queue for controller reconciliation.
// - Deduplicates keys (same resource won't be processed twice in same batch)
// - Async processing with configurable delay
// - Supports stopping/restarting

import type { ReconcileResult } from './types'

export interface WorkQueueOptions {
  /** Delay between processing items (ms). Default: 0 */
  processDelay?: number
  /** Use requestAnimationFrame instead of setTimeout. Default: false */
  useRAF?: boolean
  /** Initial delay for retry backoff (ms). Default: 50 */
  retryBaseDelayMs?: number
  /** Maximum delay for retry backoff (ms). Default: 5000 */
  retryMaxDelayMs?: number
  /** Maximum retry attempts per key. Default: unlimited */
  retryMaxAttempts?: number
}

export interface EnqueueOptions {
  /** Delay before making the key runnable */
  afterMs?: number
  /** Reset retry attempts for this key */
  resetRetry?: boolean
}

export interface WorkQueue {
  /** Add a key to the queue. If already present, it's a no-op (deduplication) */
  add(key: string): void
  /** Add a key to the queue with explicit enqueue options */
  addWithOptions(key: string, options?: EnqueueOptions): void
  /** Requeue key with exponential backoff */
  retry(key: string): void
  /** Start processing the queue with the given handler */
  start(handler: (key: string) => void | ReconcileResult): void
  /** Stop processing the queue */
  stop(): void
  /** Check if queue is currently processing */
  isRunning(): boolean
  /** Get current queue size (for debugging) */
  size(): number
  /** Get retry attempts for a key */
  attempts(key: string): number
}

/**
 * Create a new WorkQueue instance
 *
 * @param options - Configuration options
 * @returns WorkQueue instance
 */
export const createWorkQueue = (options: WorkQueueOptions = {}): WorkQueue => {
  const processDelay = options.processDelay ?? 0
  const useRAF = options.useRAF ?? false
  const processImmediately = processDelay <= 0 && useRAF === false
  const maxImmediateBatchSize = 1000
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 50
  const retryMaxDelayMs = options.retryMaxDelayMs ?? 5000
  const retryMaxAttempts = options.retryMaxAttempts

  // Queue storage - Set for O(1) deduplication
  const queue = new Set<string>()
  const retryAttemptsByKey = new Map<string, number>()
  const delayedDueAtByKey = new Map<string, number>()
  const delayedTimerByKey = new Map<string, ReturnType<typeof setTimeout>>()

  // Processing state
  let running = false
  let handler: ((key: string) => void | ReconcileResult) | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let rafId: number | null = null
  let processingImmediate = false

  const clearDelayedTimer = (key: string): void => {
    const timerId = delayedTimerByKey.get(key)
    if (timerId != null) {
      clearTimeout(timerId)
      delayedTimerByKey.delete(key)
    }
    delayedDueAtByKey.delete(key)
  }

  const scheduleDelayed = (key: string, dueAtMs: number): void => {
    const now = Date.now()
    const waitMs = Math.max(0, dueAtMs - now)
    clearDelayedTimer(key)
    delayedDueAtByKey.set(key, dueAtMs)
    const timerId = setTimeout(() => {
      delayedTimerByKey.delete(key)
      delayedDueAtByKey.delete(key)
      queue.add(key)
      if (running && queue.size === 1) {
        scheduleProcess()
      }
    }, waitMs)
    delayedTimerByKey.set(key, timerId)
  }

  const enqueueKey = (key: string, enqueueOptions: EnqueueOptions = {}): void => {
    const afterMs = Math.max(0, enqueueOptions.afterMs ?? 0)
    if (enqueueOptions.resetRetry === true) {
      retryAttemptsByKey.delete(key)
    }

    if (afterMs === 0) {
      clearDelayedTimer(key)
      queue.add(key)
      if (running && queue.size === 1) {
        scheduleProcess()
      }
      return
    }

    if (queue.has(key)) {
      return
    }

    const requestedDueAt = Date.now() + afterMs
    const existingDueAt = delayedDueAtByKey.get(key)
    if (existingDueAt != null && existingDueAt <= requestedDueAt) {
      return
    }
    scheduleDelayed(key, requestedDueAt)
  }

  const computeRetryDelay = (attempt: number): number => {
    const exponential = retryBaseDelayMs * 2 ** Math.max(0, attempt - 1)
    return Math.min(retryMaxDelayMs, exponential)
  }

  const retryKey = (key: string): void => {
    const previousAttempts = retryAttemptsByKey.get(key) ?? 0
    const nextAttempts = previousAttempts + 1
    if (
      retryMaxAttempts != null &&
      retryMaxAttempts > 0 &&
      nextAttempts > retryMaxAttempts
    ) {
      return
    }
    retryAttemptsByKey.set(key, nextAttempts)
    const delayMs = computeRetryDelay(nextAttempts)
    enqueueKey(key, { afterMs: delayMs })
  }

  /**
   * Schedule next processing tick
   */
  const scheduleProcess = (): void => {
    if (!running || queue.size === 0) {
      return
    }

    if (processImmediately) {
      if (processingImmediate) {
        return
      }
      processingImmediate = true
      let processedCount = 0
      while (
        running &&
        handler != null &&
        queue.size > 0 &&
        processedCount < maxImmediateBatchSize
      ) {
        processOne()
        processedCount += 1
      }
      processingImmediate = false
      if (queue.size > 0) {
        if (timeoutId !== null) {
          return
        }
        timeoutId = setTimeout(processNext, 0)
      }
      return
    }

    // Ensure only one pending callback is scheduled at a time.
    if (timeoutId !== null || rafId !== null) {
      return
    }

    if (useRAF && typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(processNext)
    } else {
      timeoutId = setTimeout(processNext, processDelay)
    }
  }

  const processOne = (): void => {
    if (!running || !handler || queue.size === 0) {
      return
    }

    // Get first key from queue (FIFO)
    const key = queue.values().next().value
    if (key) {
      queue.delete(key)

      // Call handler
      try {
        const result = handler(key)
        if (
          result != null &&
          typeof result === 'object' &&
          typeof result.requeueAfterMs === 'number' &&
          result.requeueAfterMs > 0
        ) {
          enqueueKey(key, { afterMs: result.requeueAfterMs })
        } else if (
          result != null &&
          typeof result === 'object' &&
          result.retry === true
        ) {
          retryKey(key)
        } else {
          retryAttemptsByKey.delete(key)
        }
      } catch (error) {
        console.error(`[WorkQueue] Error processing key "${key}":`, error)
        retryKey(key)
      }
    }

  }

  /**
   * Process the next item in the queue
   */
  const processNext = (): void => {
    // Clear pending handles first since this callback is now executing.
    timeoutId = null
    rafId = null
    processOne()
    if (queue.size > 0) {
      scheduleProcess()
    }
  }

  return {
    add(key: string): void {
      enqueueKey(key)
    },

    addWithOptions(key: string, enqueueOptions: EnqueueOptions = {}): void {
      enqueueKey(key, enqueueOptions)
    },

    retry(key: string): void {
      retryKey(key)
    },

    start(
      processHandler: (key: string) => void | ReconcileResult
    ): void {
      handler = processHandler
      running = true

      // Start processing if there are items
      if (queue.size > 0) {
        scheduleProcess()
      }
    },

    stop(): void {
      running = false

      // Cancel pending timers
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      for (const timerId of delayedTimerByKey.values()) {
        clearTimeout(timerId)
      }
      delayedTimerByKey.clear()
      delayedDueAtByKey.clear()
    },

    isRunning(): boolean {
      return running
    },

    size(): number {
      return queue.size + delayedDueAtByKey.size
    },

    attempts(key: string): number {
      return retryAttemptsByKey.get(key) ?? 0
    }
  }
}
