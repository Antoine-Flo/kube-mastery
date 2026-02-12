import type { AppEvent, AppEventType } from '../../events/AppEvent'
import type { EventSubscriber, UnsubscribeFn } from '../../events/types'

// ═══════════════════════════════════════════════════════════════════════════
// EVENT BUS
// ═══════════════════════════════════════════════════════════════════════════
// Central event dispatcher using Observer pattern.
// Allows components to subscribe to specific event types or all events.
// Optionally stores event history for time-travel debugging (Phase 4).
// Generic implementation that supports all application events.

export type EventFilter = (event: AppEvent) => boolean

export interface EventBus {
  emit: (event: AppEvent) => void
  subscribe: <T extends AppEvent>(
    eventType: AppEventType,
    subscriber: EventSubscriber<T>
  ) => UnsubscribeFn
  subscribeAll: (subscriber: EventSubscriber<AppEvent>) => UnsubscribeFn
  subscribeFiltered: (
    filter: EventFilter,
    subscriber: EventSubscriber<AppEvent>
  ) => UnsubscribeFn
  getHistory: () => readonly AppEvent[]
  getHistoryFiltered: (filter: EventFilter) => readonly AppEvent[]
  clearHistory: () => void
}

interface EventBusOptions {
  enableHistory?: boolean
  maxHistorySize?: number
}

// ─── Pure Functions ──────────────────────────────────────────────────────

/**
 * Add event to history with FIFO rotation
 * Pure function
 */
const addToHistory = (
  history: AppEvent[],
  event: AppEvent,
  maxSize: number
): AppEvent[] => {
  const newHistory = [...history, event]
  if (newHistory.length > maxSize) {
    return newHistory.slice(1)
  }
  return newHistory
}

// ─── Factory ─────────────────────────────────────────────────────────────

/**
 * Create an EventBus instance
 *
 * @param options - Configuration options
 * @returns EventBus instance with publish/subscribe API
 */
export const createEventBus = (options: EventBusOptions = {}): EventBus => {
  const enableHistory = options.enableHistory ?? true
  const maxHistorySize = options.maxHistorySize ?? 1000

  // Subscribers storage: Map<EventType, Set<Subscriber>>
  const subscribers = new Map<AppEventType, Set<EventSubscriber<AppEvent>>>()
  const allSubscribers = new Set<EventSubscriber<AppEvent>>()
  const filteredSubscribers = new Map<EventSubscriber<AppEvent>, EventFilter>()
  let eventHistory: AppEvent[] = []

  /**
   * Emit an event to all relevant subscribers
   *
   * Order of notification (important for state consistency):
   * 1. allSubscribers - State updates first (ClusterState uses this)
   * 2. typeSubscribers - Controllers react after state is updated
   * 3. filteredSubscribers - Other observers
   */
  const emit = (event: AppEvent): void => {
    // Store in history if enabled
    if (enableHistory) {
      eventHistory = addToHistory(eventHistory, event, maxHistorySize)
    }

    // 1. Notify all-events subscribers FIRST (state updates)
    allSubscribers.forEach((subscriber) => {
      subscriber(event)
    })

    // 2. Notify type-specific subscribers (controllers)
    const typeSubscribers = subscribers.get(event.type)
    if (typeSubscribers) {
      typeSubscribers.forEach((subscriber) => {
        subscriber(event)
      })
    }

    // 3. Notify filtered subscribers
    filteredSubscribers.forEach((filter, subscriber) => {
      if (filter(event)) {
        subscriber(event)
      }
    })
  }

  /**
   * Subscribe to a specific event type
   */
  const subscribe = <T extends AppEvent>(
    eventType: AppEventType,
    subscriber: EventSubscriber<T>
  ): UnsubscribeFn => {
    if (!subscribers.has(eventType)) {
      subscribers.set(eventType, new Set())
    }

    const typeSubscribers = subscribers.get(eventType)!
    typeSubscribers.add(subscriber as EventSubscriber<AppEvent>)

    // Return unsubscribe function
    return () => {
      typeSubscribers.delete(subscriber as EventSubscriber<AppEvent>)
      if (typeSubscribers.size === 0) {
        subscribers.delete(eventType)
      }
    }
  }

  /**
   * Subscribe to all events
   */
  const subscribeAll = (
    subscriber: EventSubscriber<AppEvent>
  ): UnsubscribeFn => {
    allSubscribers.add(subscriber)

    // Return unsubscribe function
    return () => {
      allSubscribers.delete(subscriber)
    }
  }

  /**
   * Subscribe to events matching a filter
   */
  const subscribeFiltered = (
    filter: EventFilter,
    subscriber: EventSubscriber<AppEvent>
  ): UnsubscribeFn => {
    filteredSubscribers.set(subscriber, filter)

    // Return unsubscribe function
    return () => {
      filteredSubscribers.delete(subscriber)
    }
  }

  /**
   * Get event history (read-only)
   */
  const getHistory = (): readonly AppEvent[] => {
    return [...eventHistory]
  }

  /**
   * Get filtered event history
   */
  const getHistoryFiltered = (filter: EventFilter): readonly AppEvent[] => {
    return eventHistory.filter(filter)
  }

  /**
   * Clear event history
   */
  const clearHistory = (): void => {
    eventHistory = []
  }

  return {
    emit,
    subscribe,
    subscribeAll,
    subscribeFiltered,
    getHistory,
    getHistoryFiltered,
    clearHistory
  }
}
