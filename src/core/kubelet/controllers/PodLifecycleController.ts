// ═══════════════════════════════════════════════════════════════════════════
// POD LIFECYCLE CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
// Reconciles pod phase transitions (Pending -> Running) for scheduled pods.

import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { EventBus } from '../../cluster/events/EventBus'
import type { ClusterEvent } from '../../cluster/events/types'
import type { PodBoundEvent } from '../../cluster/events/types'
import { createPodUpdatedEvent } from '../../cluster/events/types'
import type {
  ContainerRuntimeStateDetails,
  Pod
} from '../../cluster/ressources/Pod'
import type { ContainerRuntimeSimulator } from '../../runtime/ContainerRuntimeSimulator'
import {
  createImageRegistry,
  type ImageRegistry
} from '../../containers/registry/ImageRegistry'
import { getSimulatedCommandExitCode } from '../../cluster/containerCommand'
import { reconcileInitContainers } from '../../cluster/initContainers/reconciler'
import { generateCrashLogLines } from '../../cluster/logGenerator'
import type { PodVolumeReadiness } from '../../volumes/VolumeState'
import {
  reportControllerObservation,
  startPeriodicResync,
  subscribeToEvents
} from '../../control-plane/controller-runtime/helpers'
import { createControllerStateFromApi } from '../../control-plane/controller-runtime/stateFromApi'
import type {
  ClusterEventType,
  ControllerResyncOptions,
  ControllerState,
  ReconcilerController
} from '../../control-plane/controller-runtime/types'
import { createWorkQueue, type WorkQueue } from '../../control-plane/controller-runtime/WorkQueue'

export interface PodLifecycleControllerOptions extends ControllerResyncOptions {
  pendingDelayRangeMs?: {
    minMs: number
    maxMs: number
  }
  completionDelayRangeMs?: {
    minMs: number
    maxMs: number
  }
  restartBackoffMs?: {
    initialMs: number
    maxMs: number
  }
  imagePullBackoffMs?: {
    initialMs: number
    maxMs: number
  }
  imagePullTimingMs?: {
    initialPullMs: number
    retryPullMs: number
    errTransitionMs: number
  }
  crashLoopTimingMs?: {
    errorToBackoffMs: number
  }
  eventSource?: string
  volumeReadinessProbe?: (pod: Pod) => PodVolumeReadiness
  containerRuntime?: ContainerRuntimeSimulator
}

const WATCHED_EVENTS: ClusterEventType[] = [
  'PodCreated',
  'PodUpdated',
  'PodDeleted'
]

const DEFAULT_RESTART_BACKOFF = {
  initialMs: 10000,
  maxMs: 300000
} as const

const DEFAULT_IMAGE_PULL_BACKOFF = {
  initialMs: 10000,
  maxMs: 300000
} as const

const DEFAULT_IMAGE_PULL_TIMING = {
  initialPullMs: 3000,
  retryPullMs: 1200,
  errTransitionMs: 1500
} as const

const DEFAULT_CRASH_LOOP_TIMING = {
  errorToBackoffMs: 1800
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

const createControllerStateAccessor = (
  apiServer: ApiServerFacade
): (() => ControllerState) => {
  return () => {
    return createControllerStateFromApi(apiServer)
  }
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
  private emitEvent: ApiServerFacade['emitEvent']
  private getState: () => ControllerState
  private workQueue: WorkQueue
  private imageRegistry: ImageRegistry
  private unsubscribe: (() => void) | null = null
  private unsubscribePodBound: (() => void) | null = null
  private stopPeriodicResync: () => void = () => {}
  private options: PodLifecycleControllerOptions
  private pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private completionTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private restartTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private restartAttempts = new Map<string, number>()
  private imagePullTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private imagePullAttempts = new Map<string, number>()

  constructor(
    apiServer: ApiServerFacade,
    options: PodLifecycleControllerOptions = {}
  ) {
    this.eventBus = apiServer.getEventBus()
    this.emitEvent = apiServer.emitEvent
    this.getState = createControllerStateAccessor(apiServer)
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
    for (const timeoutId of this.completionTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.completionTimeouts.clear()
    for (const timeoutId of this.restartTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.restartTimeouts.clear()
    this.restartAttempts.clear()
    for (const timeoutId of this.imagePullTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.imagePullTimeouts.clear()
    this.imagePullAttempts.clear()
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
      this.clearCompletionTimeout(key)
      this.clearRestartTimeout(key)
      this.restartAttempts.delete(key)
      this.clearImagePullState(key)
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
      if (pod.status.phase !== 'Running') {
        this.clearCompletionTimeout(key)
      }
      this.clearRestartTimeout(key)
      this.clearImagePullTimeout(key)
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
      this.clearImagePullTimeout(key)
      return
    }
    const startupIssueReason = this.detectStartupIssueReason(pod)
    if (startupIssueReason != null) {
      if (startupIssueReason === 'ImagePullBackOff') {
        this.handleImagePullBackOff(key, pod)
        return
      }
      if (startupIssueReason === 'CrashLoopBackOff') {
        this.clearImagePullState(key)
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
    this.clearImagePullState(key)
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
      this.emitPodRunning(key, pod)
      return
    }

    const minDelayMs = Math.max(0, Math.floor(delayRange.minMs))
    const maxDelayMs = Math.max(minDelayMs, Math.floor(delayRange.maxMs))
    if (maxDelayMs === 0) {
      this.emitPodRunning(key, pod)
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
      this.emitPodRunning(key, latestPod)
    }, delayMs)
    this.pendingTimeouts.set(key, timeoutId)
  }

  private handleEvent(event: ClusterEvent): void {
    if (event.type === 'PodDeleted') {
      const pod = event.payload.deletedPod
      this.stopRuntimeContainersForPod(pod, {
        reason: 'PodDeleted',
        exitCode: 0
      })
      const key = makePodKey(pod.metadata.namespace, pod.metadata.name)
      this.clearPendingTimeout(key)
      this.clearCompletionTimeout(key)
      this.clearRestartTimeout(key)
      this.restartAttempts.delete(key)
      this.clearImagePullState(key)
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

  private clearCompletionTimeout(key: string): void {
    const timeoutId = this.completionTimeouts.get(key)
    if (timeoutId == null) {
      return
    }
    clearTimeout(timeoutId)
    this.completionTimeouts.delete(key)
  }

  private clearRestartTimeout(key: string): void {
    const timeoutId = this.restartTimeouts.get(key)
    if (timeoutId == null) {
      return
    }
    clearTimeout(timeoutId)
    this.restartTimeouts.delete(key)
  }

  private clearImagePullTimeout(key: string): void {
    const timeoutId = this.imagePullTimeouts.get(key)
    if (timeoutId == null) {
      return
    }
    clearTimeout(timeoutId)
    this.imagePullTimeouts.delete(key)
  }

  private clearImagePullState(key: string): void {
    this.clearImagePullTimeout(key)
    this.imagePullAttempts.delete(key)
  }

  private isRegularContainer(
    pod: Pod,
    status: NonNullable<Pod['status']['containerStatuses']>[number]
  ): boolean {
    return pod.spec.containers.some((container) => {
      return container.name === status.name
    })
  }

  private syncRuntimeForRunningPod(pod: Pod): Pod {
    const runtime = this.options.containerRuntime
    if (runtime == null) {
      return pod
    }
    const nodeName = pod.spec.nodeName
    if (nodeName == null || nodeName.length === 0) {
      return pod
    }
    const statuses = pod.status.containerStatuses ?? []
    let hasChanged = false
    const updatedStatuses = statuses.map((status) => {
      if (!this.isRegularContainer(pod, status)) {
        return status
      }
      if (status.stateDetails?.state !== 'Running') {
        return status
      }
      const running = runtime.listContainers({
        nodeName,
        namespace: pod.metadata.namespace,
        podName: pod.metadata.name,
        containerName: status.name,
        state: 'Running'
      })
      const record =
        running[0] ??
        runtime.startContainer({
          nodeName,
          namespace: pod.metadata.namespace,
          podName: pod.metadata.name,
          containerName: status.name,
          image: status.image
        })
      const nextStateDetails: ContainerRuntimeStateDetails = {
        ...status.stateDetails,
        state: 'Running',
        startedAt: record.startedAt
      }
      const nextStatus = {
        ...status,
        stateDetails: nextStateDetails,
        startedAt: record.startedAt,
        containerID: record.containerId
      }
      if (
        nextStatus.containerID !== status.containerID ||
        nextStatus.startedAt !== status.startedAt ||
        JSON.stringify(nextStatus.stateDetails) !== JSON.stringify(status.stateDetails)
      ) {
        hasChanged = true
      }
      return nextStatus
    })
    if (!hasChanged) {
      return pod
    }
    return {
      ...pod,
      status: {
        ...pod.status,
        containerStatuses: updatedStatuses
      }
    }
  }

  private stopRuntimeContainersForPod(
    pod: Pod,
    options: { reason: string; exitCode: number }
  ): Map<string, {
    containerId: string
    startedAt: string
    finishedAt?: string
    exitCode?: number
    reason?: string
  }> {
    const terminatedByName = new Map<
      string,
      {
        containerId: string
        startedAt: string
        finishedAt?: string
        exitCode?: number
        reason?: string
      }
    >()
    const runtime = this.options.containerRuntime
    if (runtime == null) {
      return terminatedByName
    }
    const nodeName = pod.spec.nodeName
    if (nodeName == null || nodeName.length === 0) {
      return terminatedByName
    }
    const runningContainers = runtime.listContainers({
      nodeName,
      namespace: pod.metadata.namespace,
      podName: pod.metadata.name,
      state: 'Running'
    })
    for (const record of runningContainers) {
      runtime.stopContainer({
        containerId: record.containerId,
        exitCode: options.exitCode,
        reason: options.reason
      })
      const terminated = runtime.getContainer(record.containerId)
      if (terminated != null) {
        terminatedByName.set(record.containerName, {
          containerId: terminated.containerId,
          startedAt: terminated.startedAt,
          finishedAt: terminated.finishedAt,
          exitCode: terminated.exitCode,
          reason: terminated.reason
        })
      }
    }
    return terminatedByName
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

  private computeImagePullBackoffMs(key: string): number {
    const configuredInitialMs = this.options.imagePullBackoffMs?.initialMs
    const configuredMaxMs = this.options.imagePullBackoffMs?.maxMs
    const initialMs = Math.max(
      1,
      Math.floor(configuredInitialMs ?? DEFAULT_IMAGE_PULL_BACKOFF.initialMs)
    )
    const maxMs = Math.max(
      initialMs,
      Math.floor(configuredMaxMs ?? DEFAULT_IMAGE_PULL_BACKOFF.maxMs)
    )
    const previousAttempts = this.imagePullAttempts.get(key) ?? 0
    const nextAttempts = previousAttempts + 1
    this.imagePullAttempts.set(key, nextAttempts)
    const exponentialDelay = initialMs * 2 ** (nextAttempts - 1)
    return Math.min(maxMs, exponentialDelay)
  }

  private getImagePullInitialDelayMs(): number {
    const configuredDelayMs = this.options.imagePullTimingMs?.initialPullMs
    return Math.max(
      0,
      Math.floor(configuredDelayMs ?? DEFAULT_IMAGE_PULL_TIMING.initialPullMs)
    )
  }

  private getImagePullRetryDelayMs(): number {
    const configuredDelayMs = this.options.imagePullTimingMs?.retryPullMs
    return Math.max(
      0,
      Math.floor(configuredDelayMs ?? DEFAULT_IMAGE_PULL_TIMING.retryPullMs)
    )
  }

  private getImagePullErrTransitionMs(): number {
    const configuredDelayMs = this.options.imagePullTimingMs?.errTransitionMs
    return Math.max(
      0,
      Math.floor(configuredDelayMs ?? DEFAULT_IMAGE_PULL_TIMING.errTransitionMs)
    )
  }

  private getCrashLoopErrorToBackoffMs(): number {
    const configuredDelayMs = this.options.crashLoopTimingMs?.errorToBackoffMs
    return Math.max(
      0,
      Math.floor(configuredDelayMs ?? DEFAULT_CRASH_LOOP_TIMING.errorToBackoffMs)
    )
  }

  private emitCrashLoopWaitingReasonForLatestPod(
    fallbackPod: Pod
  ): void {
    const latestCrashedPodResult = this.getState().findPod(
      fallbackPod.metadata.name,
      fallbackPod.metadata.namespace
    )
    const latestCrashedPod =
      latestCrashedPodResult.ok && latestCrashedPodResult.value != null
        ? latestCrashedPodResult.value
        : fallbackPod
    this.emitPodContainerWaitingReason(latestCrashedPod, 'CrashLoopBackOff')
  }

  private handleImagePullBackOff(key: string, pod: Pod): void {
    if (this.imagePullTimeouts.has(key)) {
      this.observe({
        action: 'skip',
        key,
        reason: 'ImagePullRetryActive'
      })
      return
    }

    this.observe({
      action: 'skip',
      key,
      reason: 'ImagePullBackOff'
    })
    this.clearPendingTimeout(key)
    this.clearRestartTimeout(key)
    this.restartAttempts.delete(key)

    const attempts = this.imagePullAttempts.get(key) ?? 0
    if (attempts === 0) {
      this.emitPodContainerCreating(pod)
    }
    const pullDelayMs =
      attempts === 0
        ? this.getImagePullInitialDelayMs()
        : this.getImagePullRetryDelayMs()

    const pullTimeoutId = setTimeout(() => {
      this.imagePullTimeouts.delete(key)
      const { namespace, name } = parsePodKey(key)
      const latestPodResult = this.getState().findPod(name, namespace)
      if (!latestPodResult.ok || latestPodResult.value == null) {
        return
      }
      const latestPod = latestPodResult.value
      if (!shouldProgressPod(latestPod)) {
        return
      }
      const latestReason = this.detectStartupIssueReason(latestPod)
      if (latestReason !== 'ImagePullBackOff') {
        this.clearImagePullState(key)
        this.enqueuePod(latestPod)
        return
      }

      this.emitPodStartupIssue(latestPod, 'ErrImagePull')

      const transitionDelayMs = this.getImagePullErrTransitionMs()
      const transitionTimeoutId = setTimeout(() => {
        this.imagePullTimeouts.delete(key)
        const transitionedPodResult = this.getState().findPod(name, namespace)
        if (!transitionedPodResult.ok || transitionedPodResult.value == null) {
          return
        }
        const transitionedPod = transitionedPodResult.value
        if (!shouldProgressPod(transitionedPod)) {
          return
        }
        const transitionedReason = this.detectStartupIssueReason(transitionedPod)
        if (transitionedReason !== 'ImagePullBackOff') {
          this.clearImagePullState(key)
          this.enqueuePod(transitionedPod)
          return
        }

        this.emitPodStartupIssue(transitionedPod, 'ImagePullBackOff')
        const backoffMs = this.computeImagePullBackoffMs(key)
        const retryTimeoutId = setTimeout(() => {
          this.imagePullTimeouts.delete(key)
          const retryPodResult = this.getState().findPod(name, namespace)
          if (!retryPodResult.ok || retryPodResult.value == null) {
            return
          }
          const retryPod = retryPodResult.value
          if (!shouldProgressPod(retryPod)) {
            return
          }
          this.enqueuePod(retryPod)
        }, backoffMs)
        this.imagePullTimeouts.set(key, retryTimeoutId)
      }, transitionDelayMs)
      this.imagePullTimeouts.set(key, transitionTimeoutId)
    }, pullDelayMs)
    this.imagePullTimeouts.set(key, pullTimeoutId)
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
      this.emitPodContainerTerminatedReason(pod, 'Error', {
        phase: 'Failed'
      })
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
    this.emitPodContainerTerminatedReason(pod, 'Error', {
      incrementRestartOnCrash: true
    })
    const delayMs = this.computeRestartBackoffMs(key)
    const errorPhaseMs = Math.min(this.getCrashLoopErrorToBackoffMs(), delayMs)
    const scheduleRestart = (remainingDelayMs: number): void => {
      const restartTimeoutId = setTimeout(() => {
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
        this.enqueuePod(latestPod)
      }, remainingDelayMs)
      this.restartTimeouts.set(key, restartTimeoutId)
    }

    if (errorPhaseMs <= 0) {
      this.emitCrashLoopWaitingReasonForLatestPod(pod)
      scheduleRestart(delayMs)
      return
    }

    const transitionTimeoutId = setTimeout(() => {
      const latestPodResult = this.getState().findPod(
        pod.metadata.name,
        pod.metadata.namespace
      )
      if (!latestPodResult.ok || latestPodResult.value == null) {
        this.restartTimeouts.delete(key)
        return
      }
      const latestPod = latestPodResult.value
      if (!shouldProgressPod(latestPod)) {
        this.restartTimeouts.delete(key)
        return
      }
      this.emitCrashLoopWaitingReasonForLatestPod(latestPod)
      const remainingDelayMs = Math.max(0, delayMs - errorPhaseMs)
      scheduleRestart(remainingDelayMs)
    }, errorPhaseMs)
    this.restartTimeouts.set(key, transitionTimeoutId)
  }

  private shouldCompleteSuccessfully(pod: Pod): boolean {
    const restartPolicy = pod.spec.restartPolicy ?? 'Always'
    if (restartPolicy === 'Always') {
      return false
    }
    if (pod.spec.containers.length === 0) {
      return false
    }
    for (const container of pod.spec.containers) {
      const imageValidation = this.imageRegistry.validateImage(container.image)
      if (!imageValidation.ok) {
        return false
      }
      const commandExitCode = getSimulatedCommandExitCode(container)
      if (commandExitCode != null) {
        if (commandExitCode !== 0) {
          return false
        }
        continue
      }
      if (imageValidation.value.behavior.defaultStatus !== 'Succeeded') {
        return false
      }
    }
    return true
  }

  private schedulePodSucceededTransition(key: string, pod: Pod): void {
    if (!this.shouldCompleteSuccessfully(pod)) {
      this.clearCompletionTimeout(key)
      return
    }
    if (this.completionTimeouts.has(key)) {
      return
    }
    const delayRange = this.options.completionDelayRangeMs
    if (delayRange == null) {
      return
    }
    const minDelayMs = Math.max(0, Math.floor(delayRange.minMs))
    const maxDelayMs = Math.max(minDelayMs, Math.floor(delayRange.maxMs))
    const delayMs = randomInRange(minDelayMs, maxDelayMs)
    const timeoutId = setTimeout(() => {
      this.completionTimeouts.delete(key)
      const { namespace, name } = parsePodKey(key)
      const latestPodResult = this.getState().findPod(name, namespace)
      if (!latestPodResult.ok || latestPodResult.value == null) {
        return
      }
      const latestPod = latestPodResult.value
      if (latestPod.status.phase === 'Succeeded' || latestPod.status.phase === 'Failed') {
        return
      }
      if (!this.shouldCompleteSuccessfully(latestPod)) {
        return
      }
      const podToComplete =
        latestPod.status.phase === 'Running' ? latestPod : pod
      this.emitPodContainerTerminatedReason(podToComplete, 'Completed', {
        phase: 'Succeeded'
      })
    }, delayMs)
    this.completionTimeouts.set(key, timeoutId)
  }

  private emitPodRunning(key: string, pod: Pod): void {
    const transitionTime = new Date().toISOString()
    const runningPod = reconcileInitContainers(pod)
    const runtimeSyncedPod = this.syncRuntimeForRunningPod(runningPod)
    const hostIP = buildPodHostIP(runtimeSyncedPod, this.getState())
    const updated: Pod = {
      ...runtimeSyncedPod,
      status: {
        ...runtimeSyncedPod.status,
        ...(runtimeSyncedPod.status.startTime == null
          ? { startTime: transitionTime }
          : {}),
        ...(hostIP != null ? { hostIP } : {}),
        ...(hostIP != null ? { hostIPs: ensureHostIPs(hostIP) } : {}),
        observedGeneration: runtimeSyncedPod.metadata.generation ?? 1,
        conditions: buildPodConditions(runtimeSyncedPod, transitionTime)
      }
    }
    this.emitEvent(
      createPodUpdatedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        updated,
        pod,
        this.options.eventSource ?? 'pod-lifecycle-controller'
      )
    )
    this.schedulePodSucceededTransition(key, updated)
  }

  private emitPodWaitingForVolume(pod: Pod, reason?: string): void {
    const waitingReason = reason ?? 'VolumesNotReady'
    const transitionTime = new Date().toISOString()
    const currentStatuses = pod.status.containerStatuses ?? []
    const updatedStatuses = currentStatuses.map((status) => ({
      ...status,
      ready: false,
      stateDetails: {
        state: 'Waiting' as const,
        reason: waitingReason
      },
      started: false,
      lastStateDetails:
        status.stateDetails ??
        ({
          state: 'Waiting',
          reason: 'ContainerCreating'
        } as ContainerRuntimeStateDetails),
      startedAt: undefined
    }))
    const hasChanged = updatedStatuses.some((updatedStatus, index) => {
      const previousStatus = currentStatuses[index]
      if (previousStatus == null) {
        return true
      }
      return (
        JSON.stringify(previousStatus.stateDetails) !==
        JSON.stringify(updatedStatus.stateDetails)
      )
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
    this.emitEvent(
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
      const commandExitCode = getSimulatedCommandExitCode(container)
      if (commandExitCode != null && commandExitCode !== 0) {
        return 'CrashLoopBackOff'
      }
      if (
        this.hasInvalidRuntimeArgs(
          container,
          imageValidation.value.behavior.runtimeValidation
        )
      ) {
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

  private emitPodContainerTerminatedReason(
    pod: Pod,
    terminatedReason: string,
    options?: {
      incrementRestartOnCrash?: boolean
      phase?: Pod['status']['phase']
    }
  ): void {
    const transitionTime = new Date().toISOString()
    const terminatedExitCode = terminatedReason === 'Completed' ? 0 : 1
    const terminatedRuntimeRecords = this.stopRuntimeContainersForPod(pod, {
      reason: terminatedReason,
      exitCode: terminatedExitCode
    })
    const currentStatuses = pod.status.containerStatuses ?? []
    const regularContainerNames = new Set(
      pod.spec.containers.map((container) => container.name)
    )
    const updatedStatuses = currentStatuses.map((status) => {
      if (!regularContainerNames.has(status.name)) {
        return status
      }
      const previousStateDetails =
        status.stateDetails ??
        ({
          state: 'Waiting',
          reason: 'ContainerCreating'
        } as ContainerRuntimeStateDetails)
      const terminatedRuntimeRecord = terminatedRuntimeRecords.get(status.name)
      return {
        ...status,
        ready: false,
        containerID: terminatedRuntimeRecord?.containerId ?? status.containerID,
        stateDetails: {
          state: 'Terminated' as const,
          reason: terminatedRuntimeRecord?.reason ?? terminatedReason,
          exitCode: terminatedRuntimeRecord?.exitCode ?? terminatedExitCode,
          startedAt: terminatedRuntimeRecord?.startedAt ?? status.startedAt,
          finishedAt: terminatedRuntimeRecord?.finishedAt ?? transitionTime
        },
        lastStateDetails: previousStateDetails,
        started: false,
        startedAt: undefined,
        ...(options?.incrementRestartOnCrash === true
          ? {
              // Keep the first observed restart timestamp for a crash loop series
              // so "RESTARTS (x ago)" keeps increasing instead of resetting each cycle.
              lastRestartAt: status.lastRestartAt ?? transitionTime,
              restartCount: (status.restartCount ?? 0) + 1
            }
          : {})
      }
    })
    const hasChanged = updatedStatuses.some((updatedStatus, index) => {
      const previousStatus = currentStatuses[index]
      if (previousStatus == null) {
        return true
      }
      if (
        JSON.stringify(previousStatus.stateDetails) !==
        JSON.stringify(updatedStatus.stateDetails)
      ) {
        return true
      }
      if (
        JSON.stringify(previousStatus.lastStateDetails) !==
        JSON.stringify(updatedStatus.lastStateDetails)
      ) {
        return true
      }
      if (previousStatus.restartCount !== updatedStatus.restartCount) {
        return true
      }
      return previousStatus.lastRestartAt !== updatedStatus.lastRestartAt
    })
    if (!hasChanged) {
      return
    }
    const phase = options?.phase ?? 'Pending'
    const updatedPod: Pod = {
      ...pod,
      status: {
        ...pod.status,
        phase,
        observedGeneration: pod.metadata.generation ?? 1,
        conditions: buildPodConditions(
          {
            ...pod,
            status: {
              ...pod.status,
              phase,
              containerStatuses: updatedStatuses
            }
          },
          transitionTime
        ),
        containerStatuses: updatedStatuses
      },
      ...(options?.incrementRestartOnCrash === true
        ? (() => {
            const firstContainer = pod.spec.containers[0]
            const exitCode =
              firstContainer != null
                ? getSimulatedCommandExitCode(firstContainer) ?? 1
                : 1
            const image = firstContainer?.image
            const existingLogs = pod._simulator.logs ?? []
            const crashLines = generateCrashLogLines(exitCode, image)
            return {
              _simulator: {
                ...pod._simulator,
                previousLogs: [...existingLogs, ...crashLines],
                logs: [] as string[]
              }
            }
          })()
        : {})
    }
    this.emitEvent(
      createPodUpdatedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        updatedPod,
        pod,
        this.options.eventSource ?? 'pod-lifecycle-controller'
      )
    )
  }

  private emitPodContainerWaitingReason(
    pod: Pod,
    waitingReason: string,
    options?: {
      incrementRestartOnCrash?: boolean
    }
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
      const previousStateDetails =
        status.stateDetails ??
        ({
          state: 'Waiting',
          reason: 'ContainerCreating'
        } as ContainerRuntimeStateDetails)
      return {
        ...status,
        ready: false,
        stateDetails: {
          state: 'Waiting' as const,
          reason: waitingReason
        },
        lastStateDetails: previousStateDetails,
        started: false,
        startedAt: undefined,
        ...(options?.incrementRestartOnCrash === true
          ? {
              lastRestartAt: transitionTime,
              restartCount: (status.restartCount ?? 0) + 1
            }
          : {})
      }
    })
    const hasChanged = updatedStatuses.some((updatedStatus, index) => {
      const previousStatus = currentStatuses[index]
      if (previousStatus == null) {
        return true
      }
      if (
        JSON.stringify(previousStatus.stateDetails) !==
        JSON.stringify(updatedStatus.stateDetails)
      ) {
        return true
      }
      if (
        JSON.stringify(previousStatus.lastStateDetails) !==
        JSON.stringify(updatedStatus.lastStateDetails)
      ) {
        return true
      }
      if (previousStatus.restartCount !== updatedStatus.restartCount) {
        return true
      }
      return previousStatus.lastRestartAt !== updatedStatus.lastRestartAt
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
      },
      ...(options?.incrementRestartOnCrash === true
        ? (() => {
            const firstContainer = pod.spec.containers[0]
            const exitCode =
              firstContainer != null
                ? getSimulatedCommandExitCode(firstContainer) ?? 1
                : 1
            const image = firstContainer?.image
            const existingLogs = pod._simulator.logs ?? []
            const crashLines = generateCrashLogLines(exitCode, image)
            return {
              _simulator: {
                ...pod._simulator,
                previousLogs: [...existingLogs, ...crashLines],
                logs: [] as string[]
              }
            }
          })()
        : {})
    }
    this.emitEvent(
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
  apiServer: ApiServerFacade,
  options: PodLifecycleControllerOptions = {}
): PodLifecycleController => {
  const controller = new PodLifecycleController(apiServer, options)
  controller.start()
  return controller
}
