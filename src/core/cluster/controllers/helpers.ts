// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER HELPERS
// ═══════════════════════════════════════════════════════════════════════════
// Shared helper functions for all Kubernetes controllers

import type { EventBus } from '../events/EventBus'
import type { ClusterEvent } from '../events/types'
import type {
  ClusterEventType,
  ControllerObservation,
  ControllerResyncOptions,
  OwnedResource,
  OwnerResource
} from './types'

// ─── Owner Reference Helpers ─────────────────────────────────────────────

/**
 * Find the owner resource of a child resource using ownerReferences
 *
 * @param child - The child resource with potential ownerReferences
 * @param ownerKind - The kind of owner to look for (e.g., 'ReplicaSet', 'Deployment')
 * @param getOwners - Function to get all potential owner resources
 * @returns The owner resource if found, undefined otherwise
 */
export const findOwnerByRef = <TOwner extends OwnerResource>(
  child: OwnedResource,
  ownerKind: string,
  getOwners: () => TOwner[]
): TOwner | undefined => {
  const ownerRefs = child.metadata.ownerReferences
  if (!ownerRefs) {
    return undefined
  }

  // Find the ownerReference matching the kind
  const ownerRef = ownerRefs.find((ref) => ref.kind === ownerKind)
  if (!ownerRef) {
    return undefined
  }

  // Find the actual owner resource
  const owners = getOwners()
  return owners.find(
    (owner) =>
      owner.metadata.name === ownerRef.name &&
      owner.metadata.namespace === child.metadata.namespace
  )
}

/**
 * Get all children owned by a parent resource
 *
 * @param owner - The owner resource
 * @param children - All potential child resources
 * @returns Children that have an ownerReference pointing to the owner
 */
export const getOwnedResources = <TChild extends OwnedResource>(
  owner: OwnerResource,
  children: TChild[]
): TChild[] => {
  return children.filter((child) => {
    const ownerRefs = child.metadata.ownerReferences
    if (!ownerRefs) {
      return false
    }

    return ownerRefs.some(
      (ref) => ref.kind === owner.kind && ref.name === owner.metadata.name
    )
  })
}

/**
 * Create an ownerReference for a child resource
 */
export const createOwnerRef = (
  owner: OwnerResource,
  controller = true
): {
  apiVersion: string
  kind: string
  name: string
  uid: string
  controller: boolean
} => ({
  apiVersion: owner.apiVersion,
  kind: owner.kind,
  name: owner.metadata.name,
  uid: `${owner.metadata.namespace}-${owner.metadata.name}`,
  controller
})

// ─── Event Subscription Helpers ──────────────────────────────────────────

type UnsubscribeFn = () => void

/**
 * Subscribe to multiple specific event types
 * More efficient than subscribeAll when you only need certain events
 *
 * @param eventBus - The EventBus instance
 * @param eventTypes - Array of event types to subscribe to
 * @param handler - Handler function for matching events
 * @returns Unsubscribe function that removes all subscriptions
 */
export const subscribeToEvents = (
  eventBus: EventBus,
  eventTypes: ClusterEventType[],
  handler: (event: ClusterEvent) => void
): UnsubscribeFn => {
  const unsubscribers: UnsubscribeFn[] = []

  for (const eventType of eventTypes) {
    const unsub = eventBus.subscribe(
      eventType,
      handler as (event: unknown) => void
    )
    unsubscribers.push(unsub)
  }

  // Return a function that unsubscribes from all
  return () => {
    for (const unsub of unsubscribers) {
      unsub()
    }
  }
}

export const startPeriodicResync = (
  resyncIntervalMs: number | undefined,
  resyncFn: () => void
): (() => void) => {
  if (resyncIntervalMs == null || resyncIntervalMs <= 0) {
    return () => {}
  }
  const intervalId = setInterval(() => {
    resyncFn()
  }, resyncIntervalMs)
  return () => {
    clearInterval(intervalId)
  }
}

export const reportControllerObservation = (
  options: Pick<ControllerResyncOptions, 'observer'>,
  observation: Omit<ControllerObservation, 'timestamp'>
): void => {
  if (options.observer == null) {
    return
  }
  options.observer({
    ...observation,
    timestamp: new Date().toISOString()
  })
}

// ─── Status Computation Helpers ──────────────────────────────────────────

/**
 * Check if two status objects are equal (shallow comparison on specified keys)
 */
export const statusEquals = <T>(a: T, b: T, keys: (keyof T)[]): boolean => {
  return keys.every((key) => a[key] === b[key])
}

// ─── Random Suffix Generator ─────────────────────────────────────────────

/**
 * Generate a random suffix for resource names (5 chars)
 */
export const generateSuffix = (): string => {
  return Math.random().toString(36).substring(2, 7)
}

/**
 * Generate a Kind-like pod name: prefix-<10 char hash>-<5 char suffix>
 * e.g. coredns-7d764666f9-9nlgh
 */
export const generateKindLikePodName = (prefix: string): string => {
  const segment10 = Math.random().toString(36).substring(2, 12)
  return `${prefix}-${segment10}-${generateSuffix()}`
}
