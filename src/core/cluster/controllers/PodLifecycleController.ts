// ═══════════════════════════════════════════════════════════════════════════
// POD LIFECYCLE CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
// Reconciles pod phase transitions (Pending -> Running) for scheduled pods.

import type { EventBus } from '../events/EventBus'
import type { ClusterEvent } from '../events/types'
import type { PodBoundEvent } from '../events/types'
import { createPodUpdatedEvent } from '../events/types'
import type { Pod } from '../ressources/Pod'
import { reconcileInitContainers } from '../initContainers/reconciler'
import type { PodVolumeReadiness } from '../../volumes/VolumeState'
import {
  startPeriodicResync,
  subscribeToEvents
} from './helpers'
import type {
  ClusterEventType,
  ControllerResyncOptions,
  ControllerState,
  ReconcilerController
} from './types'
import { createWorkQueue, type WorkQueue } from './WorkQueue'

export interface PodLifecycleControllerOptions extends ControllerResyncOptions {
  pendingDelayRangeMs?: {
    minMs: number
    maxMs: number
  }
  eventSource?: string
  volumeReadinessProbe?: (pod: Pod) => PodVolumeReadiness
}

const WATCHED_EVENTS: ClusterEventType[] = [
  'PodCreated',
  'PodUpdated',
  'PodDeleted'
]

const makePodKey = (namespace: string, name: string): string => {
  return `${namespace}/${name}`
}

const parsePodKey = (key: string): { namespace: string; name: string } => {
  const [namespace, name] = key.split('/')
  return { namespace, name }
}

const randomInRange = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const shouldProgressPod = (pod: Pod): boolean => {
  return (
    pod.status.phase === 'Pending' &&
    pod.spec.nodeName != null &&
    pod.spec.nodeName.length > 0
  )
}

const buildPodHostIP = (pod: Pod, state: ControllerState): string | undefined => {
  const nodeName = pod.spec.nodeName
  if (nodeName == null || nodeName.length === 0) {
    return undefined
  }
  const node = state.getNodes().find((item) => item.metadata.name === nodeName)
  if (node == null) {
    return undefined
  }
  const nodeAddresses = node.status.addresses
  if (nodeAddresses == null) {
    return undefined
  }
  const internalAddress = nodeAddresses.find((address) => {
    return address.type === 'InternalIP'
  })
  if (internalAddress == null) {
    return undefined
  }
  return internalAddress.address
}

const ensureHostIPs = (hostIP: string | undefined): Array<{ ip: string }> | undefined => {
  if (hostIP == null || hostIP.length === 0) {
    return undefined
  }
  return [{ ip: hostIP }]
}

const countInitContainers = (pod: Pod): number => {
  return pod.spec.initContainers?.length ?? 0
}

const buildPodConditions = (pod: Pod, transitionTime: string): Pod['status']['conditions'] => {
  const regularContainerNames = new Set(pod.spec.containers.map((container) => container.name))
  const regularStatuses = (pod.status.containerStatuses ?? []).filter((status) => {
    return regularContainerNames.has(status.name)
  })
  const allRegularReady =
    regularStatuses.length > 0 && regularStatuses.every((status) => status.ready === true)
  const initialized =
    countInitContainers(pod) === 0 ||
    pod.status.phase === 'Running' ||
    pod.status.phase === 'Succeeded'
  const ready = pod.status.phase === 'Running' && allRegularReady
  const scheduled = pod.spec.nodeName != null && pod.spec.nodeName.length > 0
  const observedGeneration = pod.metadata.generation ?? 1
  return [
    {
      type: 'Initialized',
      status: initialized ? 'True' : 'False',
      lastTransitionTime: transitionTime,
      lastProbeTime: null,
      observedGeneration
    },
    {
      type: 'Ready',
      status: ready ? 'True' : 'False',
      lastTransitionTime: transitionTime,
      lastProbeTime: null,
      observedGeneration
    },
    {
      type: 'ContainersReady',
      status: ready ? 'True' : 'False',
      lastTransitionTime: transitionTime,
      lastProbeTime: null,
      observedGeneration
    },
    {
      type: 'PodScheduled',
      status: scheduled ? 'True' : 'False',
      lastTransitionTime: transitionTime,
      lastProbeTime: null,
      observedGeneration
    }
  ]
}

export class PodLifecycleController implements ReconcilerController {
  private eventBus: EventBus
  private getState: () => ControllerState
  private workQueue: WorkQueue
  private unsubscribe: (() => void) | null = null
  private unsubscribePodBound: (() => void) | null = null
  private stopPeriodicResync: () => void = () => {}
  private options: PodLifecycleControllerOptions
  private pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    eventBus: EventBus,
    getState: () => ControllerState,
    options: PodLifecycleControllerOptions = {}
  ) {
    this.eventBus = eventBus
    this.getState = getState
    this.options = options
    this.workQueue = createWorkQueue({ processDelay: 0 })
  }

  start(): void {
    this.unsubscribe = subscribeToEvents(
      this.eventBus,
      WATCHED_EVENTS,
      (event) => this.handleEvent(event)
    )
    this.unsubscribePodBound = this.eventBus.subscribe(
      'PodBound',
      (event) => this.handlePodBound(event as PodBoundEvent)
    )
    this.workQueue.start((key) => this.reconcile(key))
    this.initialSync()
    this.stopPeriodicResync = startPeriodicResync(
      this.options.resyncIntervalMs,
      () => this.resyncAll()
    )
  }

  stop(): void {
    if (this.unsubscribe != null) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    if (this.unsubscribePodBound != null) {
      this.unsubscribePodBound()
      this.unsubscribePodBound = null
    }
    this.stopPeriodicResync()
    this.stopPeriodicResync = () => {}
    this.workQueue.stop()
    for (const timeoutId of this.pendingTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.pendingTimeouts.clear()
  }

  initialSync(): void {
    const state = this.getState()
    const pods = state.getPods()
    for (const pod of pods) {
      if (!shouldProgressPod(pod)) {
        continue
      }
      this.enqueuePod(pod)
    }
  }

  resyncAll(): void {
    this.initialSync()
  }

  reconcile(key: string): void {
    const { namespace, name } = parsePodKey(key)
    const state = this.getState()
    const podResult = state.findPod(name, namespace)
    if (!podResult.ok || podResult.value == null) {
      this.clearPendingTimeout(key)
      return
    }

    const pod = podResult.value
    if (!shouldProgressPod(pod)) {
      this.clearPendingTimeout(key)
      return
    }

    const volumeReadiness = this.options.volumeReadinessProbe?.(pod)
    if (volumeReadiness != null && !volumeReadiness.ready) {
      this.clearPendingTimeout(key)
      this.emitPodWaitingForVolume(pod, volumeReadiness.reason)
      return
    }
    if (this.pendingTimeouts.has(key)) {
      return
    }

    const delayRange = this.options.pendingDelayRangeMs
    if (delayRange == null) {
      this.emitPodRunning(pod)
      return
    }

    const minDelayMs = Math.max(0, Math.floor(delayRange.minMs))
    const maxDelayMs = Math.max(minDelayMs, Math.floor(delayRange.maxMs))
    if (maxDelayMs === 0) {
      this.emitPodRunning(pod)
      return
    }

    const delayMs = randomInRange(minDelayMs, maxDelayMs)
    const timeoutId = setTimeout(() => {
      this.pendingTimeouts.delete(key)
      const latestPodResult = this.getState().findPod(name, namespace)
      if (!latestPodResult.ok || latestPodResult.value == null) {
        return
      }
      const latestPod = latestPodResult.value
      if (!shouldProgressPod(latestPod)) {
        return
      }
      const latestVolumeReadiness = this.options.volumeReadinessProbe?.(latestPod)
      if (latestVolumeReadiness != null && !latestVolumeReadiness.ready) {
        this.emitPodWaitingForVolume(latestPod, latestVolumeReadiness.reason)
        return
      }
      this.emitPodRunning(latestPod)
    }, delayMs)
    this.pendingTimeouts.set(key, timeoutId)
  }

  private handleEvent(event: ClusterEvent): void {
    if (event.type === 'PodDeleted') {
      const pod = event.payload.deletedPod
      this.clearPendingTimeout(makePodKey(pod.metadata.namespace, pod.metadata.name))
      return
    }
    if (event.type !== 'PodCreated' && event.type !== 'PodUpdated') {
      return
    }
    const pod = event.payload.pod
    if (!shouldProgressPod(pod)) {
      return
    }
    this.enqueuePod(pod)
  }

  private handlePodBound(event: PodBoundEvent): void {
    const pod = event.payload.pod
    if (!shouldProgressPod(pod)) {
      return
    }
    this.enqueuePod(pod)
  }

  private enqueuePod(pod: Pod): void {
    this.workQueue.add(makePodKey(pod.metadata.namespace, pod.metadata.name))
  }

  private clearPendingTimeout(key: string): void {
    const timeoutId = this.pendingTimeouts.get(key)
    if (timeoutId == null) {
      return
    }
    clearTimeout(timeoutId)
    this.pendingTimeouts.delete(key)
  }

  private emitPodRunning(pod: Pod): void {
    const transitionTime = new Date().toISOString()
    const runningPod = reconcileInitContainers(pod)
    const hostIP = buildPodHostIP(runningPod, this.getState())
    const updated: Pod = {
      ...runningPod,
      status: {
        ...runningPod.status,
        ...(runningPod.status.startTime == null ? { startTime: transitionTime } : {}),
        ...(hostIP != null ? { hostIP } : {}),
        ...(hostIP != null ? { hostIPs: ensureHostIPs(hostIP) } : {}),
        observedGeneration: runningPod.metadata.generation ?? 1,
        conditions: buildPodConditions(runningPod, transitionTime)
      }
    }
    this.eventBus.emit(
      createPodUpdatedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        updated,
        pod,
        this.options.eventSource ?? 'pod-lifecycle-controller'
      )
    )
  }

  private emitPodWaitingForVolume(pod: Pod, reason?: string): void {
    const waitingReason = reason ?? 'VolumesNotReady'
    const transitionTime = new Date().toISOString()
    const currentStatuses = pod.status.containerStatuses ?? []
    const updatedStatuses = currentStatuses.map((status) => ({
      ...status,
      ready: false,
      state: 'Waiting' as const,
      started: false,
      waitingReason
    }))
    const hasChanged = updatedStatuses.some((updatedStatus, index) => {
      const previousStatus = currentStatuses[index]
      if (previousStatus == null) {
        return true
      }
      if (previousStatus.waitingReason !== updatedStatus.waitingReason) {
        return true
      }
      return previousStatus.state !== updatedStatus.state
    })
    if (!hasChanged) {
      return
    }
    const updatedPod: Pod = {
      ...pod,
      status: {
        ...pod.status,
        phase: 'Pending',
        observedGeneration: pod.metadata.generation ?? 1,
        conditions: buildPodConditions(
          {
            ...pod,
            status: {
              ...pod.status,
              phase: 'Pending',
              containerStatuses: updatedStatuses
            }
          },
          transitionTime
        ),
        containerStatuses: updatedStatuses
      }
    }
    this.eventBus.emit(
      createPodUpdatedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        updatedPod,
        pod,
        this.options.eventSource ?? 'pod-lifecycle-controller'
      )
    )
  }
}

export const createPodLifecycleController = (
  eventBus: EventBus,
  getState: () => ControllerState,
  options: PodLifecycleControllerOptions = {}
): PodLifecycleController => {
  const controller = new PodLifecycleController(eventBus, getState, options)
  controller.start()
  return controller
}
