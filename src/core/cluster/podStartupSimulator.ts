// ═══════════════════════════════════════════════════════════════════════════
// POD STARTUP SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════
// Transitions Pending pods to Running after a delay (simulating kubelet startup).
// Subscribes to PodBound and processes existing Pending+scheduled pods on start.

import type { ClusterState } from './ClusterState'
import type { EventBus } from './events/EventBus'
import { createPodUpdatedEvent } from './events/types'
import type { PodBoundEvent } from './events/types'
import type { Pod } from './ressources/Pod'
import { reconcileInitContainers } from './initContainers/reconciler'

export interface PodStartupSimulatorOptions {
  pendingDelayRangeMs?: {
    minMs: number
    maxMs: number
  }
}

const randomInRange = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export interface PodStartupSimulator {
  start: () => void
  stop: () => void
}

/**
 * Create a simulator that transitions Pending pods to Running after a delay.
 * Call start() after scheduler is initialized (e.g. in EmulatedEnvironmentManager).
 */
export const createPodStartupSimulator = (
  eventBus: EventBus,
  getState: () => ClusterState,
  options: PodStartupSimulatorOptions = {}
): PodStartupSimulator => {
  const pendingDelayRangeMs = options.pendingDelayRangeMs
  let unsubscribe: (() => void) | null = null
  const timeouts: ReturnType<typeof setTimeout>[] = []

  const scheduleTransition = (pod: Pod): void => {
    const emitRunning = (): void => {
      const updated = reconcileInitContainers(pod)
      eventBus.emit(
        createPodUpdatedEvent(
          pod.metadata.name,
          pod.metadata.namespace,
          updated,
          pod,
          'pod-startup-simulator'
        )
      )
    }

    if (pendingDelayRangeMs == null) {
      emitRunning()
      return
    }

    const minDelayMs = Math.max(0, Math.floor(pendingDelayRangeMs.minMs))
    const maxDelayMs = Math.max(minDelayMs, Math.floor(pendingDelayRangeMs.maxMs))
    if (maxDelayMs === 0) {
      emitRunning()
      return
    }

    const delay = randomInRange(minDelayMs, maxDelayMs)
    const id = setTimeout(() => {
      emitRunning()
    }, delay)
    timeouts.push(id)
  }

  const handlePodBound = (event: PodBoundEvent): void => {
    const pod = event.payload.pod
    if (pod.status.phase !== 'Pending') {
      return
    }
    if (pod.spec.nodeName == null || pod.spec.nodeName.length === 0) {
      return
    }
    scheduleTransition(pod)
  }

  const start = (): void => {
    const state = getState()
    const pods = state.getPods()
    for (const pod of pods) {
      if (
        pod.status.phase === 'Pending' &&
        pod.spec.nodeName != null &&
        pod.spec.nodeName.length > 0
      ) {
        scheduleTransition(pod)
      }
    }
    unsubscribe = eventBus.subscribe(
      'PodBound',
      handlePodBound
    )
  }

  const stop = (): void => {
    for (const id of timeouts) {
      clearTimeout(id)
    }
    timeouts.length = 0
    if (unsubscribe != null) {
      unsubscribe()
      unsubscribe = null
    }
  }

  return { start, stop }
}
