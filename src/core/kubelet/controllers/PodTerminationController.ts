import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { EventBus } from '../../cluster/events/EventBus'
import type { ClusterEvent } from '../../cluster/events/types'
import {
  getPodDeletionGracePeriodSeconds,
  isPodTerminating,
  type Pod
} from '../../cluster/ressources/Pod'
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
import type { ContainerProcessRuntime } from '../../runtime/ContainerProcessRuntime'
import { hasRunningPodProcessRuntime } from './podLifecycle/runtimeTerminationService'

export interface PodTerminationControllerOptions extends ControllerResyncOptions {
  defaultGracePeriodSeconds?: number
  minVisibleTerminatingMs?: number
  processCheckIntervalMs?: number
  eventSource?: string
  processRuntime?: ContainerProcessRuntime
}

const WATCHED_EVENTS: ClusterEventType[] = ['PodUpdated', 'PodDeleted']
const DEFAULT_GRACE_PERIOD_SECONDS = 30
const DEFAULT_MIN_VISIBLE_TERMINATING_MS = 1500
const DEFAULT_PROCESS_CHECK_INTERVAL_MS = 500

const makePodKey = (namespace: string, name: string): string => {
  return `${namespace}/${name}`
}

const parsePodKey = (key: string): { namespace: string; name: string } => {
  const [namespace, name] = key.split('/')
  return { namespace, name }
}

const createControllerStateAccessor = (
  apiServer: ApiServerFacade
): (() => ControllerState) => {
  return () => {
    return createControllerStateFromApi(apiServer)
  }
}

const getPodDeletionDeadlineMs = (
  pod: Pod,
  defaultGracePeriodSeconds: number,
  minVisibleTerminatingMs: number
): number | undefined => {
  if (!isPodTerminating(pod)) {
    return undefined
  }
  const deletionTimestamp = pod.metadata.deletionTimestamp
  if (deletionTimestamp == null) {
    return undefined
  }
  const deletionStartedAtMs = new Date(deletionTimestamp).getTime()
  if (Number.isNaN(deletionStartedAtMs)) {
    return Date.now()
  }
  const gracePeriodSeconds = getPodDeletionGracePeriodSeconds(
    pod,
    defaultGracePeriodSeconds
  )
  const graceDeadlineMs = deletionStartedAtMs + gracePeriodSeconds * 1000
  const minVisibleDeadlineMs = deletionStartedAtMs + minVisibleTerminatingMs
  return Math.max(graceDeadlineMs, minVisibleDeadlineMs)
}

const getPodMinVisibleDeadlineMs = (
  pod: Pod,
  minVisibleTerminatingMs: number
): number | undefined => {
  if (!isPodTerminating(pod)) {
    return undefined
  }
  const deletionTimestamp = pod.metadata.deletionTimestamp
  if (deletionTimestamp == null) {
    return undefined
  }
  const deletionStartedAtMs = new Date(deletionTimestamp).getTime()
  if (Number.isNaN(deletionStartedAtMs)) {
    return Date.now()
  }
  return deletionStartedAtMs + minVisibleTerminatingMs
}

export class PodTerminationController implements ReconcilerController {
  private eventBus: EventBus
  private getState: () => ControllerState
  private workQueue: WorkQueue
  private unsubscribe: (() => void) | null = null
  private stopPeriodicResync: () => void = () => {}
  private options: PodTerminationControllerOptions
  private finalizeTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private finalizeDeadlines = new Map<string, number>()
  private finalizePodDeletion: ApiServerFacade['finalizePodDeletion']

  constructor(
    apiServer: ApiServerFacade,
    options: PodTerminationControllerOptions = {}
  ) {
    this.eventBus = apiServer.getEventBus()
    this.getState = createControllerStateAccessor(apiServer)
    this.options = options
    this.workQueue = createWorkQueue({ processDelay: 0 })
    this.finalizePodDeletion = apiServer.finalizePodDeletion
  }

  start(): void {
    this.unsubscribe = subscribeToEvents(
      this.eventBus,
      WATCHED_EVENTS,
      (event) => this.handleEvent(event)
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
    this.stopPeriodicResync()
    this.stopPeriodicResync = () => {}
    this.workQueue.stop()
    for (const timeoutId of this.finalizeTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.finalizeTimeouts.clear()
    this.finalizeDeadlines.clear()
  }

  initialSync(): void {
    const state = this.getState()
    const pods = state.getPods()
    for (const pod of pods) {
      if (!isPodTerminating(pod)) {
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
    const podResult = this.getState().findPod(name, namespace)
    if (!podResult.ok || podResult.value == null) {
      this.clearFinalizeTimeout(key)
      this.observe({
        action: 'skip',
        key,
        reason: 'PodNotFound'
      })
      return
    }
    const pod = podResult.value
    if (!isPodTerminating(pod)) {
      this.clearFinalizeTimeout(key)
      this.observe({
        action: 'skip',
        key,
        reason: 'PodNotTerminating'
      })
      return
    }

    const defaultGracePeriodSeconds = Math.max(
      0,
      Math.floor(
        this.options.defaultGracePeriodSeconds ?? DEFAULT_GRACE_PERIOD_SECONDS
      )
    )
    const minVisibleTerminatingMs = Math.max(
      0,
      Math.floor(
        this.options.minVisibleTerminatingMs ?? DEFAULT_MIN_VISIBLE_TERMINATING_MS
      )
    )
    const deadlineMs = getPodDeletionDeadlineMs(
      pod,
      defaultGracePeriodSeconds,
      minVisibleTerminatingMs
    )
    const minVisibleDeadlineMs = getPodMinVisibleDeadlineMs(
      pod,
      minVisibleTerminatingMs
    )
    const hasRunningProcess = hasRunningPodProcessRuntime(
      pod,
      this.options.processRuntime
    )
    const nowMs = Date.now()
    const canFinalizeEarly =
      hasRunningProcess === false &&
      minVisibleDeadlineMs != null &&
      minVisibleDeadlineMs <= nowMs

    if (canFinalizeEarly) {
      this.clearFinalizeTimeout(key)
      this.finalizePodDeletion(name, namespace, {
        source: this.options.eventSource ?? 'pod-termination-controller'
      })
      return
    }

    if (deadlineMs == null || deadlineMs <= nowMs) {
      this.clearFinalizeTimeout(key)
      this.finalizePodDeletion(name, namespace, {
        source: this.options.eventSource ?? 'pod-termination-controller'
      })
      return
    }
    const processCheckIntervalMs = Math.max(
      1,
      Math.floor(
        this.options.processCheckIntervalMs ?? DEFAULT_PROCESS_CHECK_INTERVAL_MS
      )
    )
    const nextCheckDeadlineMs = hasRunningProcess
      ? Math.min(deadlineMs, nowMs + processCheckIntervalMs)
      : minVisibleDeadlineMs ?? deadlineMs
    this.scheduleFinalizeAt(key, nextCheckDeadlineMs)
  }

  private scheduleFinalizeAt(key: string, deadlineMs: number): void {
    const existingDeadlineMs = this.finalizeDeadlines.get(key)
    if (existingDeadlineMs != null && existingDeadlineMs === deadlineMs) {
      return
    }
    this.clearFinalizeTimeout(key)
    const delayMs = Math.max(0, deadlineMs - Date.now())
    const timeoutId = setTimeout(() => {
      this.finalizeTimeouts.delete(key)
      this.finalizeDeadlines.delete(key)
      // Reconcile again at deadline, then decide whether to finalize now
      // or schedule another check (e.g. process still running).
      this.workQueue.add(key)
    }, delayMs)
    this.finalizeTimeouts.set(key, timeoutId)
    this.finalizeDeadlines.set(key, deadlineMs)
  }

  private clearFinalizeTimeout(key: string): void {
    const timeoutId = this.finalizeTimeouts.get(key)
    if (timeoutId == null) {
      this.finalizeDeadlines.delete(key)
      return
    }
    clearTimeout(timeoutId)
    this.finalizeTimeouts.delete(key)
    this.finalizeDeadlines.delete(key)
  }

  private handleEvent(event: ClusterEvent): void {
    if (event.type === 'PodDeleted') {
      const key = makePodKey(event.payload.namespace, event.payload.name)
      this.clearFinalizeTimeout(key)
      return
    }
    if (event.type !== 'PodUpdated') {
      return
    }
    const pod = event.payload.pod
    if (!isPodTerminating(pod)) {
      return
    }
    this.enqueuePod(pod, event.type)
  }

  private enqueuePod(pod: Pod, eventType?: ClusterEventType): void {
    const key = makePodKey(pod.metadata.namespace, pod.metadata.name)
    this.observe({
      action: 'enqueue',
      key,
      reason: eventType == null ? 'Sync' : 'Event',
      eventType
    })
    this.workQueue.add(key)
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
      controller: 'PodTerminationController',
      action: input.action,
      key: input.key,
      reason: input.reason,
      eventType: input.eventType
    })
  }
}

export const createPodTerminationController = (
  apiServer: ApiServerFacade,
  options: PodTerminationControllerOptions = {}
): PodTerminationController => {
  const controller = new PodTerminationController(apiServer, options)
  controller.start()
  return controller
}
