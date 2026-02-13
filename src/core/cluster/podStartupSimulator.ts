// ═══════════════════════════════════════════════════════════════════════════
// POD STARTUP SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════
// Transitions Pending pods to Running after a delay (simulating kubelet startup).
// Subscribes to PodUpdated and processes existing Pending pods on start.

import type { ClusterState } from './ClusterState'
import type { EventBus } from './events/EventBus'
import { createPodUpdatedEvent } from './events/types'
import type { Pod } from './ressources/Pod'
import type { ContainerStatus } from './ressources/Pod'

export interface PodStartupSimulatorOptions {
  /**
   * Delay before transitioning Pending -> Running.
   * 0 or undefined: immediate (for conformance / sync mode).
   * >0: random delay in ms between 100 and this value (capped at 2000).
   */
  startupDelayMs?: number
}

const randomInRange = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min

function podToRunning(pod: Pod): Pod {
  const containerStatuses: ContainerStatus[] = (
    pod.status.containerStatuses ?? []
  ).map((cs) => {
    const { waitingReason: _w, terminatedReason: _t, ...rest } = cs
    return { ...rest, ready: true, state: 'Running' as const }
  })
  return {
    ...pod,
    status: {
      ...pod.status,
      phase: 'Running',
      containerStatuses
    }
  }
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
  const { startupDelayMs = 0 } = options
  let unsubscribe: (() => void) | null = null
  const timeouts: ReturnType<typeof setTimeout>[] = []

  const scheduleTransition = (pod: Pod): void => {
    const emitRunning = (): void => {
      const updated = podToRunning(pod)
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

    if (startupDelayMs === 0 || startupDelayMs == null) {
      emitRunning()
      return
    }

    const delay = randomInRange(100, Math.min(startupDelayMs, 2000))
    const id = setTimeout(() => {
      emitRunning()
    }, delay)
    timeouts.push(id)
  }

  const handlePodUpdated = (event: {
    type: string
    payload?: { newPod: Pod }
  }): void => {
    if (event.type !== 'PodUpdated' || event.payload == null) {
      return
    }
    const pod = event.payload.newPod
    if (pod.status.phase !== 'Pending') {
      return
    }
    scheduleTransition(pod)
  }

  const start = (): void => {
    const state = getState()
    const pods = state.getPods()
    for (const pod of pods) {
      if (pod.status.phase === 'Pending') {
        scheduleTransition(pod)
      }
    }
    unsubscribe = eventBus.subscribe(
      'PodUpdated',
      handlePodUpdated as (e: unknown) => void
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
