// ═══════════════════════════════════════════════════════════════════════════
// KUBERNETES SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════
// Watches for unscheduled pods and assigns them to nodes.
// This is a separate component from controllers, following K8s architecture.
// Simplified implementation: no plugins, no preemption, simple node selection.

import type { EventBus } from '../events/EventBus'
import type { ClusterEvent, PodCreatedEvent } from '../events/types'
import { createPodUpdatedEvent } from '../events/types'
import type { Node } from '../ressources/Node'
import { getNodeStatus } from '../ressources/Node'
import type { Pod } from '../ressources/Pod'

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * State accessor for the scheduler
 */
export interface SchedulerState {
  getNodes: () => Node[]
  getPods: (namespace?: string) => Pod[]
  findPod: (name: string, namespace: string) => { ok: boolean; value?: Pod }
}

/**
 * Scheduler interface
 */
export interface Scheduler {
  start(): void
  stop(): void
}

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Check if a pod needs scheduling (no nodeName assigned)
 */
const needsScheduling = (pod: Pod): boolean => {
  return !pod.spec.nodeName
}

/**
 * Check if a node is schedulable
 * - Must be Ready
 * - Must not be unschedulable (cordoned)
 * - Must not have NoSchedule taints that the pod doesn't tolerate
 */
const isNodeSchedulable = (node: Node): boolean => {
  // Check if node is Ready
  if (getNodeStatus(node) !== 'Ready') {
    return false
  }

  // Check if node is cordoned
  if (node.spec.unschedulable) {
    return false
  }

  // For simplicity, we don't check taints/tolerations in this version
  // A full implementation would check pod tolerations against node taints

  return true
}

/**
 * Find all feasible nodes for scheduling
 */
const findFeasibleNodes = (nodes: Node[]): Node[] => {
  return nodes.filter(isNodeSchedulable)
}

// ─── Scheduler Implementation ─────────────────────────────────────────────

/**
 * Create a Scheduler instance
 *
 * The scheduler:
 * 1. Watches for PodCreated events
 * 2. Filters to pods without nodeName
 * 3. Finds feasible nodes
 * 4. Selects a node (round-robin)
 * 5. Emits PodUpdated with nodeName assigned
 */
export const createScheduler = (
  eventBus: EventBus,
  getState: () => SchedulerState
): Scheduler => {
  let unsubscribe: (() => void) | null = null
  let nextNodeIndex = 0

  /**
   * Select a node using round-robin strategy
   */
  const selectNode = (feasibleNodes: Node[]): Node | null => {
    if (feasibleNodes.length === 0) {
      return null
    }

    const node = feasibleNodes[nextNodeIndex % feasibleNodes.length]
    nextNodeIndex = (nextNodeIndex + 1) % feasibleNodes.length
    return node
  }

  /**
   * Bind a pod to a node by emitting PodUpdated event.
   * Only assigns nodeName; phase stays Pending until PodStartupSimulator transitions to Running.
   */
  const bind = (pod: Pod, nodeName: string): void => {
    const updatedPod: Pod = {
      ...pod,
      spec: {
        ...pod.spec,
        nodeName
      },
      status: {
        ...pod.status
      }
    }

    eventBus.emit(
      createPodUpdatedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        updatedPod,
        pod,
        'scheduler'
      )
    )
  }

  /**
   * Schedule a single pod
   * Returns true if scheduled, false if no feasible nodes
   */
  const scheduleOne = (pod: Pod): boolean => {
    const state = getState()
    const nodes = state.getNodes()

    // Find feasible nodes
    const feasibleNodes = findFeasibleNodes(nodes)

    if (feasibleNodes.length === 0) {
      // No nodes available - pod stays unscheduled
      // In a real scheduler, this would go to a retry queue
      return false
    }

    // Select a node
    const selectedNode = selectNode(feasibleNodes)
    if (!selectedNode) {
      return false
    }

    // Bind the pod to the node
    bind(pod, selectedNode.metadata.name)

    return true
  }

  /**
   * Handle PodCreated events
   */
  const handlePodCreated = (event: PodCreatedEvent): void => {
    const pod = event.payload.pod

    // Only schedule pods that need it
    if (!needsScheduling(pod)) {
      return
    }

    // Skip pods created by the scheduler itself (avoid loops)
    if (event.metadata?.source === 'scheduler') {
      return
    }

    // Schedule the pod
    scheduleOne(pod)
  }

  /**
   * Handle incoming cluster events
   */
  const handleEvent = (event: ClusterEvent): void => {
    if (event.type === 'PodCreated') {
      handlePodCreated(event as PodCreatedEvent)
    }
  }

  const scheduleExistingUnboundPods = (): void => {
    const state = getState()
    const pods = state.getPods()
    for (const pod of pods) {
      if (!needsScheduling(pod)) {
        continue
      }
      scheduleOne(pod)
    }
  }

  return {
    start(): void {
      scheduleExistingUnboundPods()
      // Subscribe to PodCreated events
      unsubscribe = eventBus.subscribe('PodCreated', handleEvent)
    },

    stop(): void {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
    }
  }
}
