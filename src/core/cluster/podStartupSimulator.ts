// ═══════════════════════════════════════════════════════════════════════════
// POD STARTUP SIMULATOR (COMPAT WRAPPER)
// ═══════════════════════════════════════════════════════════════════════════
// Backward-compatible wrapper around PodLifecycleController.

import type { ClusterState } from './ClusterState'
import type { EventBus } from './events/EventBus'
import type {
  PodBoundEvent,
  PodCreatedEvent,
  PodDeletedEvent,
  PodUpdatedEvent
} from './events/types'
import {
  createPodLifecycleController,
  type PodLifecycleControllerOptions
} from './controllers/PodLifecycleController'
import type { Pod } from './ressources/Pod'

export interface PodStartupSimulatorOptions {
  pendingDelayRangeMs?: {
    minMs: number
    maxMs: number
  }
}

export interface PodStartupSimulator {
  start: () => void
  stop: () => void
}

export const createPodStartupSimulator = (
  eventBus: EventBus,
  getState: () => ClusterState,
  options: PodStartupSimulatorOptions = {}
): PodStartupSimulator => {
  let controller:
    | ReturnType<typeof createPodLifecycleController>
    | null = null
  let unsubscribeLocalStore: (() => void) | null = null
  const localPods = new Map<string, Pod>()

  const controllerOptions: PodLifecycleControllerOptions = {
    pendingDelayRangeMs: options.pendingDelayRangeMs,
    eventSource: 'pod-startup-simulator'
  }

  const makePodKey = (namespace: string, name: string): string => {
    return `${namespace}/${name}`
  }

  const maybeGetUnderlyingState = (): Partial<ClusterState> => {
    return getState() as Partial<ClusterState>
  }

  const buildStateAdapter = () => {
    return {
      getPods: (namespace?: string): Pod[] => {
        const underlyingState = maybeGetUnderlyingState()
        if (typeof underlyingState.getPods === 'function') {
          return underlyingState.getPods(namespace)
        }
        const pods = Array.from(localPods.values())
        if (namespace == null) {
          return pods
        }
        return pods.filter((pod) => pod.metadata.namespace === namespace)
      },
      findPod: (name: string, namespace: string) => {
        const underlyingState = maybeGetUnderlyingState()
        if (typeof underlyingState.findPod === 'function') {
          return underlyingState.findPod(name, namespace)
        }
        const pod = localPods.get(makePodKey(namespace, name))
        if (pod == null) {
          return { ok: false as const }
        }
        return { ok: true as const, value: pod }
      },
      getNodes: () => {
        const underlyingState = maybeGetUnderlyingState()
        if (typeof underlyingState.getNodes === 'function') {
          return underlyingState.getNodes()
        }
        return []
      },
      getReplicaSets: () => [],
      findReplicaSet: () => ({ ok: false as const }),
      getDeployments: () => [],
      findDeployment: () => ({ ok: false as const }),
      getDaemonSets: () => [],
      findDaemonSet: () => ({ ok: false as const }),
      getPersistentVolumes: () => [],
      findPersistentVolume: () => ({ ok: false as const }),
      getPersistentVolumeClaims: () => [],
      findPersistentVolumeClaim: () => ({ ok: false as const })
    }
  }

  return {
    start(): void {
      if (controller != null) {
        return
      }
      const unsubscribePodCreated = eventBus.subscribe(
        'PodCreated',
        (event: PodCreatedEvent) => {
          const pod = event.payload.pod
          localPods.set(makePodKey(pod.metadata.namespace, pod.metadata.name), pod)
        }
      )
      const unsubscribePodUpdated = eventBus.subscribe(
        'PodUpdated',
        (event: PodUpdatedEvent) => {
          const pod = event.payload.pod
          localPods.set(makePodKey(pod.metadata.namespace, pod.metadata.name), pod)
        }
      )
      const unsubscribePodBound = eventBus.subscribe(
        'PodBound',
        (event: PodBoundEvent) => {
          const pod = event.payload.pod
          localPods.set(makePodKey(pod.metadata.namespace, pod.metadata.name), pod)
        }
      )
      const unsubscribePodDeleted = eventBus.subscribe(
        'PodDeleted',
        (event: PodDeletedEvent) => {
          const pod = event.payload.deletedPod
          localPods.delete(makePodKey(pod.metadata.namespace, pod.metadata.name))
        }
      )
      unsubscribeLocalStore = () => {
        unsubscribePodCreated()
        unsubscribePodUpdated()
        unsubscribePodBound()
        unsubscribePodDeleted()
      }
      controller = createPodLifecycleController(
        eventBus,
        buildStateAdapter,
        controllerOptions
      )
    },
    stop(): void {
      if (controller == null) {
        return
      }
      controller.stop()
      controller = null
      if (unsubscribeLocalStore != null) {
        unsubscribeLocalStore()
        unsubscribeLocalStore = null
      }
      localPods.clear()
    }
  }
}
