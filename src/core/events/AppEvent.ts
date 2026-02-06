// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION EVENT UNION
// ═══════════════════════════════════════════════════════════════════════════
// Union type of all application events.
// Extend this type when adding new event domains.

import type { ClusterEvent } from '../cluster/events/types'
import type { FileSystemEvent } from '../filesystem/events/types'

// ─── Application Event Union ──────────────────────────────────────────────

/**
 * Union type of all application events
 * Add new event types here when creating new domains
 */
export type AppEvent = ClusterEvent | FileSystemEvent

export type AppEventType = AppEvent['type']
