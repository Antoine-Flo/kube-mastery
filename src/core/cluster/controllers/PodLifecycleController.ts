// ═══════════════════════════════════════════════════════════════════════════
// POD LIFECYCLE CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
// Reconciles pod phase transitions (Pending -> Running) for scheduled pods.

import type { EventBus } from '../events/EventBus'
import type { ClusterEvent } from '../events/types'
import type { PodBoundEvent } from '../events/types'
import { createPodUpdatedEvent } from '../events/types'
import type { Pod } from '../ressources/Pod'
import {
  createImageRegistry,
  type ImageRegistry
} from '../../containers/registry/ImageRegistry'
import { reconcileInitContainers } from '../initContainers/reconciler'
import type { PodVolumeReadiness } from '../../volumes/VolumeState'
import {
  reportControllerObservation,
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
  restartBackoffMs?: {
    initialMs: number
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

const DEFAULT_RESTART_BACKOFF = {
  initialMs: 1000,
  maxMs: 30000
} as const

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

const buildPodHostIP = (
  pod: Pod,
  state: ControllerState
): string | undefined => {
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

const ensureHostIPs = (
  hostIP: string | undefined
): Array<{ ip: string }> | undefined => {
  if (hostIP == null || hostIP.length === 0) {
    return undefined
  }
  return [{ ip: hostIP }]
}

const countInitContainers = (pod: Pod): number => {
  return pod.spec.initContainers?.length ?? 0
}

const buildPodConditions = (
  pod: Pod,
  transitionTime: string
): Pod['status']['conditions'] => {
  const regularContainerNames = new Set(
    pod.spec.containers.map((container) => container.name)
  )
  const regularStatuses = (pod.status.containerStatuses ?? []).filter(
    (status) => {
      return regularContainerNames.has(status.name)
    }
  )
  const allRegularReady =
    regularStatuses.length > 0 &&
    regularStatuses.every((status) => status.ready === true)
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
  private imageRegistry: ImageRegistry
  private unsubscribe: (() => void) | null = null
  private unsubscribePodBound: (() => void) | null = null
  private stopPeriodicResync: () => void = () => {}
  private options: PodLifecycleControllerOptions
  private pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private restartTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private restartAttempts = new Map<string, number>()

  constructor(
    eventBus: EventBus,
    getState: () => ControllerState,
    options: PodLifecycleControllerOptions = {}
  ) {
    this.eventBus = eventBus
    this.getState = getState
    this.imageRegistry = createImageRegistry()
    this.options = options
    this.workQueue = createWorkQueue({ processDelay: 0 })
  }

  start(): void {
    this.unsubscribe = subscribeToEvents(
      this.eventBus,
      WATCHED_EVENTS,
      (event) => this.handleEvent(event)
    )
    this.unsubscribePodBound = this.eventBus.subscribe('PodBound', (event) =>
      this.handlePodBound(event as PodBoundEvent)
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
    for (const timeoutId of this.restartTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.restartTimeouts.clear()
    this.restartAttempts.clear()
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
    this.observe({
      action: 'reconcile',
      key,
      reason: 'Start'
    })
    const { namespace, name } = parsePodKey(key)
    const state = this.getState()
    const podResult = state.findPod(name, namespace)
    if (!podResult.ok || podResult.value == null) {
      this.observe({
        action: 'skip',
        key,
        reason: 'NotFound'
      })
      this.clearPendingTimeout(key)
      this.clearRestartTimeout(key)
      this.restartAttempts.delete(key)
      return
    }

    const pod = podResult.value
    if (!shouldProgressPod(pod)) {
      this.observe({
        action: 'skip',
        key,
        reason: 'NotSchedulable'
      })
      this.clearPendingTimeout(key)
      this.clearRestartTimeout(key)
      return
    }

    const volumeReadiness = this.options.volumeReadinessProbe?.(pod)
    if (volumeReadiness != null && !volumeReadiness.ready) {
      this.observe({
        action: 'skip',
        key,
        reason: 'VolumeNotReady'
      })
      this.clearPendingTimeout(key)
      this.emitPodWaitingForVolume(pod, volumeReadiness.reason)
      return
    }
    const startupIssueReason = this.detectStartupIssueReason(pod)
    if (startupIssueReason != null) {
      if (startupIssueReason === 'CrashLoopBackOff') {
        this.handleCrashLoopBackOff(key, pod)
        return
      }
      this.observe({
        action: 'skip',
        key,
        reason: startupIssueReason
      })
      this.clearPendingTimeout(key)
      this.emitPodStartupIssue(pod, startupIssueReason)
      return
    }
    this.clearRestartTimeout(key)
    this.restartAttempts.delete(key)
    if (this.pendingTimeouts.has(key)) {
      this.observe({
        action: 'skip',
        key,
        reason: 'AlreadyPending'
      })
      return
    }
    this.emitPodContainerCreating(pod)

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
      const latestVolumeReadiness =
        this.options.volumeReadinessProbe?.(latestPod)
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
      const key = makePodKey(pod.metadata.namespace, pod.metadata.name)
      this.clearPendingTimeout(key)
      this.clearRestartTimeout(key)
      this.restartAttempts.delete(key)
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
    const key = makePodKey(pod.metadata.namespace, pod.metadata.name)
    this.workQueue.add(key)
    this.observe({
      action: 'enqueue',
      key
    })
  }

  private clearPendingTimeout(key: string): void {
    const timeoutId = this.pendingTimeouts.get(key)
    if (timeoutId == null) {
      return
    }
    clearTimeout(timeoutId)
    this.pendingTimeouts.delete(key)
  }

  private clearRestartTimeout(key: string): void {
    const timeoutId = this.restartTimeouts.get(key)
    if (timeoutId == null) {
      return
    }
    clearTimeout(timeoutId)
    this.restartTimeouts.delete(key)
  }

  private computeRestartBackoffMs(key: string): number {
    const configuredInitialMs = this.options.restartBackoffMs?.initialMs
    const configuredMaxMs = this.options.restartBackoffMs?.maxMs
    const initialMs = Math.max(
      1,
      Math.floor(configuredInitialMs ?? DEFAULT_RESTART_BACKOFF.initialMs)
    )
    const maxMs = Math.max(initialMs, Math.floor(configuredMaxMs ?? DEFAULT_RESTART_BACKOFF.maxMs))
    const previousAttempts = this.restartAttempts.get(key) ?? 0
    const nextAttempts = previousAttempts + 1
    this.restartAttempts.set(key, nextAttempts)
    const exponentialDelay = initialMs * 2 ** (nextAttempts - 1)
    return Math.min(maxMs, exponentialDelay)
  }

  private handleCrashLoopBackOff(key: string, pod: Pod): void {
    const restartPolicy = pod.spec.restartPolicy ?? 'Always'
    const restartAllowed = restartPolicy === 'Always' || restartPolicy === 'OnFailure'
    if (!restartAllowed) {
      this.observe({
        action: 'skip',
        key,
        reason: 'RestartPolicyDisallowsRestart'
      })
      this.clearPendingTimeout(key)
      this.clearRestartTimeout(key)
      this.emitPodStartupIssue(pod, 'Error')
      return
    }

    if (this.restartTimeouts.has(key)) {
      this.observe({
        action: 'skip',
        key,
        reason: 'RestartBackoffActive'
      })
      return
    }

    this.observe({
      action: 'skip',
      key,
      reason: 'CrashLoopBackOff'
    })
    this.clearPendingTimeout(key)
    this.emitPodContainerWaitingReason(pod, 'CrashLoopBackOff', {
      incrementRestartOnCrash: true
    })

    const delayMs = this.computeRestartBackoffMs(key)
    const timeoutId = setTimeout(() => {
      this.restartTimeouts.delete(key)
      const { namespace, name } = parsePodKey(key)
      const latestPodResult = this.getState().findPod(name, namespace)
      if (!latestPodResult.ok || latestPodResult.value == null) {
        return
      }
      const latestPod = latestPodResult.value
      if (!shouldProgressPod(latestPod)) {
        return
      }
      this.emitPodContainerCreating(latestPod)
      this.enqueuePod(latestPod)
    }, delayMs)
    this.restartTimeouts.set(key, timeoutId)
  }

  private emitPodRunning(pod: Pod): void {
    const transitionTime = new Date().toISOString()
    const runningPod = reconcileInitContainers(pod)
    const hostIP = buildPodHostIP(runningPod, this.getState())
    const updated: Pod = {
      ...runningPod,
      status: {
        ...runningPod.status,
        ...(runningPod.status.startTime == null
          ? { startTime: transitionTime }
          : {}),
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

  private detectStartupIssueReason(pod: Pod): string | undefined {
    for (const container of pod.spec.containers) {
      const imageValidation = this.imageRegistry.validateImage(container.image)
      if (!imageValidation.ok) {
        return 'ImagePullBackOff'
      }
      if (
        this.hasInvalidRuntimeArgs(
          container,
          imageValidation.value.behavior.runtimeValidation
        )
      ) {
        return 'CrashLoopBackOff'
      }
      if (imageValidation.value.behavior.defaultStatus === 'Failed') {
        return 'CrashLoopBackOff'
      }
    }
    return undefined
  }

  private hasInvalidRuntimeArgs(
    container: Pod['spec']['containers'][number],
    runtimeValidation:
      | {
          rejectNonFlagArgsWithoutCommand?: boolean
        }
      | undefined
  ): boolean {
    if (runtimeValidation?.rejectNonFlagArgsWithoutCommand !== true) {
      return false
    }
    if (container.command != null && container.command.length > 0) {
      return false
    }
    if (container.args == null || container.args.length === 0) {
      return false
    }

    const firstArg = container.args[0]
    if (firstArg == null) {
      return false
    }
    return !firstArg.startsWith('-')
  }

  private emitPodContainerCreating(pod: Pod): void {
    this.emitPodContainerWaitingReason(pod, 'ContainerCreating')
  }

  private emitPodStartupIssue(pod: Pod, waitingReason: string): void {
    this.emitPodContainerWaitingReason(pod, waitingReason)
  }

  private emitPodContainerWaitingReason(
    pod: Pod,
    waitingReason: string,
    options?: { incrementRestartOnCrash?: boolean }
  ): void {
    const transitionTime = new Date().toISOString()
    const currentStatuses = pod.status.containerStatuses ?? []
    const regularContainerNames = new Set(
      pod.spec.containers.map((container) => container.name)
    )
    const updatedStatuses = currentStatuses.map((status) => {
      if (!regularContainerNames.has(status.name)) {
        return status
      }
      return {
        ...status,
        ready: false,
        state: 'Waiting' as const,
        started: false,
        waitingReason,
        ...(waitingReason === 'CrashLoopBackOff'
          ? {
              terminatedReason: 'Error',
              lastRestartAt:
                options?.incrementRestartOnCrash === true
                  ? transitionTime
                  : status.lastRestartAt,
              restartCount: options?.incrementRestartOnCrash === true
                ? (status.restartCount ?? 0) + 1
                : status.restartCount
            }
          : { terminatedReason: undefined })
      }
    })
    const hasChanged = updatedStatuses.some((updatedStatus, index) => {
      const previousStatus = currentStatuses[index]
      if (previousStatus == null) {
        return true
      }
      if (previousStatus.waitingReason !== updatedStatus.waitingReason) {
        return true
      }
      if (previousStatus.state !== updatedStatus.state) {
        return true
      }
      if (previousStatus.restartCount !== updatedStatus.restartCount) {
        return true
      }
      return previousStatus.terminatedReason !== updatedStatus.terminatedReason
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

  private observe(
    input: {
      action: 'enqueue' | 'reconcile' | 'skip'
      key: string
      reason?: string
      eventType?: ClusterEventType
    }
  ): void {
    reportControllerObservation(this.options, {
      controller: 'PodLifecycleController',
      action: input.action,
      key: input.key,
      reason: input.reason,
      eventType: input.eventType
    })
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
