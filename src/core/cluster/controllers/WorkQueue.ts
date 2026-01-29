// ═══════════════════════════════════════════════════════════════════════════
// WORK QUEUE
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes-style work queue for controller reconciliation.
// - Deduplicates keys (same resource won't be processed twice in same batch)
// - Async processing with configurable delay
// - Supports stopping/restarting

export interface WorkQueueOptions {
    /** Delay between processing items (ms). Default: 0 */
    processDelay?: number
    /** Use requestAnimationFrame instead of setTimeout. Default: false */
    useRAF?: boolean
}

export interface WorkQueue {
    /** Add a key to the queue. If already present, it's a no-op (deduplication) */
    add(key: string): void
    /** Start processing the queue with the given handler */
    start(handler: (key: string) => void): void
    /** Stop processing the queue */
    stop(): void
    /** Check if queue is currently processing */
    isRunning(): boolean
    /** Get current queue size (for debugging) */
    size(): number
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

    // Queue storage - Set for O(1) deduplication
    const queue = new Set<string>()
    
    // Processing state
    let running = false
    let handler: ((key: string) => void) | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let rafId: number | null = null

    /**
     * Schedule next processing tick
     */
    const scheduleProcess = (): void => {
        if (!running || queue.size === 0) return

        if (useRAF && typeof requestAnimationFrame !== 'undefined') {
            rafId = requestAnimationFrame(processNext)
        } else {
            timeoutId = setTimeout(processNext, processDelay)
        }
    }

    /**
     * Process the next item in the queue
     */
    const processNext = (): void => {
        if (!running || !handler || queue.size === 0) return

        // Get first key from queue (FIFO)
        const key = queue.values().next().value
        if (key) {
            queue.delete(key)
            
            // Call handler
            try {
                handler(key)
            } catch (error) {
                console.error(`[WorkQueue] Error processing key "${key}":`, error)
            }
        }

        // Schedule next if there are more items
        if (queue.size > 0) {
            scheduleProcess()
        }
    }

    return {
        add(key: string): void {
            queue.add(key)
            
            // If running and this is the first item, start processing
            if (running && queue.size === 1) {
                scheduleProcess()
            }
        },

        start(processHandler: (key: string) => void): void {
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
        },

        isRunning(): boolean {
            return running
        },

        size(): number {
            return queue.size
        },
    }
}
