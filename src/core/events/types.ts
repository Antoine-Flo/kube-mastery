// ═══════════════════════════════════════════════════════════════════════════
// BASE EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Generic event types that all domain events extend.
// Provides common structure for event-driven architecture.

// ─── Base Event Structure ────────────────────────────────────────────────

export interface BaseEvent {
  type: string
  timestamp: string
  metadata?: {
    source?: string
    correlationId?: string
    [key: string]: unknown
  }
}

// ─── Event Subscriber Types ────────────────────────────────────────────────

export type EventSubscriber<T extends BaseEvent = BaseEvent> = (event: T) => void

export type UnsubscribeFn = () => void
