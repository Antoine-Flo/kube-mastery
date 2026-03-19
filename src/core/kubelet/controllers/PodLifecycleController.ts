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
import type { ContainerProcessRuntime } from '../../runtime/ContainerProcessRuntime'
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
import {
  buildTerminatedContainerStatuses,
  buildWaitingContainerStatuses,
  hasContainerStatusChanged
} from './podLifecycle/statusBuilders'
import { syncRunningPodRuntimeState } from './podLifecycle/runtimeSyncService'
import {
  clearPodProcessRuntimeState,
  hasRunningPodProcessRuntime,
  signalPodProcessRuntime,
  terminatePodRuntimeContainers
} from './podLifecycle/runtimeTerminationService'
import { PodLifecycleTimeoutRegistry } from './podLifecycle/PodLifecycleTimeoutRegistry'
import { buildReconcileDecision } from './podLifecycle/reconcileDecisionEngine'

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
  processRuntime?: ContainerProcessRuntime
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
  private timeoutRegistry = new PodLifecycleTimeoutRegistry()

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
    this.timeoutRegistry.clearAll()
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
    const pod = podResult.ok ? podResult.value : undefined
    const decision = buildReconcileDecision({
      pod: pod ?? undefined,
      hasPendingTimeout: this.timeoutRegistry.hasTimeout('pending', key),
      shouldProgressPod,
      volumeReadinessProbe: this.options.volumeReadinessProbe,
      detectStartupIssueReason: (value) => this.detectStartupIssueReason(value)
    })
    this.applyReconcileDecision(key, namespace, name, decision)
  }

  private applyReconcileDecision(
    key: string,
    namespace: string,
    name: string,
    decision: ReturnType<typeof buildReconcileDecision>
  ): void {
    if (decision.type === 'NotFound') {
      this.observe({
        action: 'skip',
        key,
        reason: 'NotFound'
      })
      this.clearPendingTimeout(key)
      this.clearCompletionTimeout(key)
      this.clearRestartTimeout(key)
      this.timeoutRegistry.deleteAttempt('restart', key)
      this.clearImagePullState(key)
      return
    }

    const pod = decision.pod
    if (decision.type === 'Terminating') {
      this.handleTerminatingPod(key, pod)
      return
    }
    if (decision.type === 'NotSchedulable') {
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
    if (decision.type === 'VolumeBlocked') {
      this.observe({
        action: 'skip',
        key,
        reason: 'VolumeNotReady'
      })
      this.clearPendingTimeout(key)
      this.emitPodWaitingForVolume(pod, decision.reason)
      this.clearImagePullTimeout(key)
      return
    }
    if (decision.type === 'StartupIssue') {
      if (decision.reason === 'ImagePullBackOff') {
        this.handleImagePullBackOff(key, pod)
        return
      }
      if (decision.reason === 'CrashLoopBackOff') {
        this.clearImagePullState(key)
        this.handleCrashLoopBackOff(key, pod)
        return
      }
      this.observe({
        action: 'skip',
        key,
        reason: decision.reason
      })
      this.clearPendingTimeout(key)
      this.emitPodStartupIssue(pod, decision.reason)
      return
    }
    if (decision.type === 'AlreadyPending') {
      this.clearImagePullState(key)
      this.clearRestartTimeout(key)
      this.timeoutRegistry.deleteAttempt('restart', key)
      this.observe({
        action: 'skip',
        key,
        reason: 'AlreadyPending'
      })
      return
    }

    this.clearImagePullState(key)
    this.clearRestartTimeout(key)
    this.timeoutRegistry.deleteAttempt('restart', key)
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
      this.timeoutRegistry.deleteTimeout('pending', key)
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
      this.emitPodRunning(key, latestPod)
    }, delayMs)
    this.timeoutRegistry.setTimeout('pending', key, timeoutId)
  }

  private handleEvent(event: ClusterEvent): void {
    if (event.type === 'PodDeleted') {
      const pod = event.payload.deletedPod
      const isForceDeletion = this.isForcedPodDeletion(pod)
      this.signalPodProcesses(pod, isForceDeletion ? 'SIGKILL' : 'SIGTERM')
      this.stopRuntimeContainersForPod(pod, {
        reason: isForceDeletion ? 'Killed' : 'PodDeleted',
        exitCode: isForceDeletion ? 137 : 0
      })
      this.clearProcessRuntimeStateForPod(pod)
      const key = makePodKey(pod.metadata.namespace, pod.metadata.name)
      this.clearPendingTimeout(key)
      this.clearCompletionTimeout(key)
      this.clearRestartTimeout(key)
      this.timeoutRegistry.deleteAttempt('restart', key)
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
    const timeoutId = this.timeoutRegistry.getTimeout('pending', key)
    if (timeoutId == null) {
      return
    }
    this.timeoutRegistry.clearTimeout('pending', key)
  }

  private clearCompletionTimeout(key: string): void {
    const timeoutId = this.timeoutRegistry.getTimeout('completion', key)
    if (timeoutId == null) {
      return
    }
    this.timeoutRegistry.clearTimeout('completion', key)
  }

  private clearRestartTimeout(key: string): void {
    const timeoutId = this.timeoutRegistry.getTimeout('restart', key)
    if (timeoutId == null) {
      return
    }
    this.timeoutRegistry.clearTimeout('restart', key)
  }

  private clearImagePullTimeout(key: string): void {
    const timeoutId = this.timeoutRegistry.getTimeout('imagePull', key)
    if (timeoutId == null) {
      return
    }
    this.timeoutRegistry.clearTimeout('imagePull', key)
  }

  private clearImagePullState(key: string): void {
    this.clearImagePullTimeout(key)
    this.timeoutRegistry.deleteAttempt('imagePull', key)
  }

  private hasProcessCommand(container: Pod['spec']['containers'][number]): boolean {
    if (container.command != null && container.command.length > 0) {
      return true
    }
    if (container.args != null && container.args.length > 0) {
      return true
    }
    return false
  }

  private getProcessRuntimeIdentity(
    pod: Pod,
    containerName: string
  ): {
    nodeName: string
    namespace: string
    podName: string
    containerName: string
  } | null {
    const nodeName = pod.spec.nodeName
    if (nodeName == null || nodeName.length === 0) {
      return null
    }
    return {
      nodeName,
      namespace: pod.metadata.namespace,
      podName: pod.metadata.name,
      containerName
    }
  }

  private clearProcessRuntimeStateForPod(pod: Pod): void {
    clearPodProcessRuntimeState(pod, this.options.processRuntime)
  }

  private signalPodProcesses(
    pod: Pod,
    signal: 'SIGTERM' | 'SIGKILL'
  ): void {
    signalPodProcessRuntime(pod, this.options.processRuntime, signal)
  }

  private syncRuntimeForRunningPod(pod: Pod): Pod {
    return syncRunningPodRuntimeState(pod, {
      containerRuntime: this.options.containerRuntime,
      processRuntime: this.options.processRuntime
    })
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
    return terminatePodRuntimeContainers(pod, this.options.containerRuntime, {
      reason: options.reason,
      exitCode: options.exitCode
    })
  }

  private computeRestartBackoffMs(key: string): number {
    const configuredInitialMs = this.options.restartBackoffMs?.initialMs
    const configuredMaxMs = this.options.restartBackoffMs?.maxMs
    const initialMs = Math.max(
      1,
      Math.floor(configuredInitialMs ?? DEFAULT_RESTART_BACKOFF.initialMs)
    )
    const maxMs = Math.max(initialMs, Math.floor(configuredMaxMs ?? DEFAULT_RESTART_BACKOFF.maxMs))
    const previousAttempts = this.timeoutRegistry.getAttempt('restart', key) ?? 0
    const nextAttempts = previousAttempts + 1
    this.timeoutRegistry.setAttempt('restart', key, nextAttempts)
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
    const previousAttempts = this.timeoutRegistry.getAttempt('imagePull', key) ?? 0
    const nextAttempts = previousAttempts + 1
    this.timeoutRegistry.setAttempt('imagePull', key, nextAttempts)
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
    if (this.timeoutRegistry.hasTimeout('imagePull', key)) {
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
    this.timeoutRegistry.deleteAttempt('restart', key)

    const attempts = this.timeoutRegistry.getAttempt('imagePull', key) ?? 0
    if (attempts === 0) {
      this.emitPodContainerCreating(pod)
    }
    const pullDelayMs =
      attempts === 0
        ? this.getImagePullInitialDelayMs()
        : this.getImagePullRetryDelayMs()

    const pullTimeoutId = setTimeout(() => {
      this.timeoutRegistry.deleteTimeout('imagePull', key)
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
        this.timeoutRegistry.deleteTimeout('imagePull', key)
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
          this.timeoutRegistry.deleteTimeout('imagePull', key)
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
        this.timeoutRegistry.setTimeout('imagePull', key, retryTimeoutId)
      }, transitionDelayMs)
      this.timeoutRegistry.setTimeout('imagePull', key, transitionTimeoutId)
    }, pullDelayMs)
    this.timeoutRegistry.setTimeout('imagePull', key, pullTimeoutId)
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

    if (this.timeoutRegistry.hasTimeout('restart', key)) {
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
        this.timeoutRegistry.deleteTimeout('restart', key)
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
      this.timeoutRegistry.setTimeout('restart', key, restartTimeoutId)
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
        this.timeoutRegistry.deleteTimeout('restart', key)
        return
      }
      const latestPod = latestPodResult.value
      if (!shouldProgressPod(latestPod)) {
        this.timeoutRegistry.deleteTimeout('restart', key)
        return
      }
      this.emitCrashLoopWaitingReasonForLatestPod(latestPod)
      const remainingDelayMs = Math.max(0, delayMs - errorPhaseMs)
      scheduleRestart(remainingDelayMs)
    }, errorPhaseMs)
    this.timeoutRegistry.setTimeout('restart', key, transitionTimeoutId)
  }

  private shouldCompleteSuccessfully(pod: Pod): boolean {
    const restartPolicy = pod.spec.restartPolicy ?? 'Always'
    if (restartPolicy === 'Always') {
      return false
    }
    if (pod.spec.containers.length === 0) {
      return false
    }
    const processRuntime = this.options.processRuntime
    const nodeName = pod.spec.nodeName
    const canUseProcessRuntime =
      processRuntime != null && nodeName != null && nodeName.length > 0
    for (const container of pod.spec.containers) {
      if (canUseProcessRuntime && this.hasProcessCommand(container)) {
        const identity = this.getProcessRuntimeIdentity(pod, container.name)
        if (identity == null) {
          return false
        }
        const processRecord = processRuntime.ensureMainProcess({
          ...identity,
          command: container.command,
          args: container.args
        })
        if (processRecord.state === 'Running') {
          return false
        }
        const processExitCode = processRecord.exitCode ?? 0
        if (processExitCode !== 0) {
          return false
        }
        continue
      }
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

  private handleTerminatingPod(key: string, pod: Pod): void {
    this.observe({
      action: 'skip',
      key,
      reason: 'Terminating'
    })
    this.clearPendingTimeout(key)
    this.clearCompletionTimeout(key)
    this.clearRestartTimeout(key)
    this.timeoutRegistry.deleteAttempt('restart', key)
    this.clearImagePullState(key)
    this.signalPodProcesses(pod, 'SIGTERM')
    const hasRunningProcess = hasRunningPodProcessRuntime(
      pod,
      this.options.processRuntime
    )
    if (hasRunningProcess) {
      return
    }
    this.stopRuntimeContainersForPod(pod, {
      reason: 'Terminated',
      exitCode: 143
    })
  }

  private isForcedPodDeletion(pod: Pod): boolean {
    const configuredGracePeriod = pod.metadata.deletionGracePeriodSeconds
    if (configuredGracePeriod === 0) {
      return true
    }
    const deletionTimestamp = pod.metadata.deletionTimestamp
    if (deletionTimestamp == null) {
      return false
    }
    if (configuredGracePeriod == null || configuredGracePeriod <= 0) {
      return false
    }
    const deletionStartMs = Date.parse(deletionTimestamp)
    if (Number.isNaN(deletionStartMs)) {
      return false
    }
    const graceDeadlineMs = deletionStartMs + configuredGracePeriod * 1000
    return Date.now() >= graceDeadlineMs
  }

  private schedulePodSucceededTransition(key: string, pod: Pod): void {
    if (!this.shouldCompleteSuccessfully(pod)) {
      this.clearCompletionTimeout(key)
      return
    }
    if (this.timeoutRegistry.hasTimeout('completion', key)) {
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
      this.timeoutRegistry.deleteTimeout('completion', key)
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
    this.timeoutRegistry.setTimeout('completion', key, timeoutId)
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
    const updatedStatuses = buildTerminatedContainerStatuses(
      currentStatuses,
      regularContainerNames,
      transitionTime,
      terminatedReason,
      terminatedExitCode,
      terminatedRuntimeRecords,
      {
        incrementRestartOnCrash: options?.incrementRestartOnCrash
      }
    )
    const hasChanged = updatedStatuses.some((updatedStatus, index) => {
      const previousStatus = currentStatuses[index]
      return hasContainerStatusChanged(previousStatus, updatedStatus)
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
            const existingLogEntries = pod._simulator.logEntries ?? []
            const crashLines = generateCrashLogLines(exitCode, image)
            const crashLogEntries = crashLines.map((line) => {
              return {
                timestamp: transitionTime,
                line
              }
            })
            return {
              _simulator: {
                ...pod._simulator,
                previousLogs: [...existingLogs, ...crashLines],
                previousLogEntries: [...existingLogEntries, ...crashLogEntries],
                logEntries: [],
                logStreamState: undefined,
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
    const updatedStatuses = buildWaitingContainerStatuses(
      currentStatuses,
      regularContainerNames,
      waitingReason,
      transitionTime,
      {
        incrementRestartOnCrash: options?.incrementRestartOnCrash
      }
    )
    const hasChanged = updatedStatuses.some((updatedStatus, index) => {
      const previousStatus = currentStatuses[index]
      return hasContainerStatusChanged(previousStatus, updatedStatus)
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
            const existingLogEntries = pod._simulator.logEntries ?? []
            const crashLines = generateCrashLogLines(exitCode, image)
            const crashLogEntries = crashLines.map((line) => {
              return {
                timestamp: transitionTime,
                line
              }
            })
            return {
              _simulator: {
                ...pod._simulator,
                previousLogs: [...existingLogs, ...crashLines],
                previousLogEntries: [...existingLogEntries, ...crashLogEntries],
                logEntries: [],
                logStreamState: undefined,
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
