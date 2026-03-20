// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULER CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
// Reconciles unscheduled pods by assigning an eligible node.

import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { EventBus } from '../../cluster/events/EventBus'
import type { ClusterEvent } from '../../cluster/events/types'
import { createPodBoundEvent } from '../../cluster/events/types'
import type { Node } from '../../cluster/ressources/Node'
import type { Pod } from '../../cluster/ressources/Pod'
import { isNodeEligibleForPod } from '../../cluster/scheduler/SimSchedulingPredicates'
import {
  startPeriodicResync,
  subscribeToEvents
} from '../controller-runtime/helpers'
import { createControllerStateFromApi } from '../controller-runtime/stateFromApi'
import type {
  ClusterEventType,
  ControllerState,
  ControllerResyncOptions,
  ReconcilerController
} from '../controller-runtime/types'
import {
  createWorkQueue,
  type WorkQueue
} from '../controller-runtime/WorkQueue'

export interface SchedulerControllerOptions extends ControllerResyncOptions {
  schedulingDelayRangeMs?: {
    minMs: number
    maxMs: number
  }
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

const needsScheduling = (pod: Pod): boolean => {
  return pod.spec.nodeName == null || pod.spec.nodeName.length === 0
}

const randomInRange = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export class SchedulerController implements ReconcilerController {
  private apiServer: ApiServerFacade
  private eventBus: EventBus
  private emitEvent: ApiServerFacade['emitEvent']
  private getState: () => ControllerState
  private workQueue: WorkQueue
  private unsubscribe: (() => void) | null = null
  private stopPeriodicResync: () => void = () => {}
  private options: SchedulerControllerOptions
  private nextNodeIndex = 0
  private pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    apiServer: ApiServerFacade,
    options: SchedulerControllerOptions = {}
  ) {
    this.apiServer = apiServer
    this.eventBus = apiServer.getEventBus()
    this.emitEvent = apiServer.emitEvent
    this.getState = () => createControllerStateFromApi(apiServer)
    this.options = options
    this.workQueue = createWorkQueue({ processDelay: 0 })
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
    for (const timeoutId of this.pendingTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.pendingTimeouts.clear()
  }

  initialSync(): void {
    const pods = this.getState().getPods()
    for (const pod of pods) {
      if (!needsScheduling(pod)) {
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
    const podResult = this.getState().findPod(name, namespace)
    if (!podResult.ok || podResult.value == null) {
      this.clearPendingTimeout(key)
      return
    }
    const pod = podResult.value
    if (!needsScheduling(pod)) {
      this.clearPendingTimeout(key)
      return
    }
    if (this.pendingTimeouts.has(key)) {
      return
    }

    const delayRange = this.options.schedulingDelayRangeMs
    if (delayRange == null) {
      this.bindOnce(pod)
      return
    }

    const minDelayMs = Math.max(0, Math.floor(delayRange.minMs))
    const maxDelayMs = Math.max(minDelayMs, Math.floor(delayRange.maxMs))
    if (maxDelayMs === 0) {
      this.bindOnce(pod)
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
      if (!needsScheduling(latestPod)) {
        return
      }
      this.bindOnce(latestPod)
    }, delayMs)
    this.pendingTimeouts.set(key, timeoutId)
  }

  private handleEvent(event: ClusterEvent): void {
    if (event.type === 'PodDeleted') {
      const deleted = event.payload.deletedPod
      this.clearPendingTimeout(
        makePodKey(deleted.metadata.namespace, deleted.metadata.name)
      )
      return
    }
    if (event.type !== 'PodCreated' && event.type !== 'PodUpdated') {
      return
    }
    const pod = event.payload.pod
    if (!needsScheduling(pod)) {
      return
    }
    if (event.metadata?.source === 'scheduler-controller') {
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

  private bindOnce(pod: Pod): void {
    const nodes = this.getState().getNodes()
    const feasibleNodes = this.findFeasibleNodes(nodes, pod)
    if (feasibleNodes.length === 0) {
      return
    }
    const selectedNode = this.selectNode(feasibleNodes)
    if (selectedNode == null) {
      return
    }

    const updatedPod: Pod = {
      ...pod,
      spec: {
        ...pod.spec,
        nodeName: selectedNode.metadata.name
      },
      status: {
        ...pod.status
      }
    }

    this.apiServer.updateResource(
      'Pod',
      pod.metadata.name,
      updatedPod,
      pod.metadata.namespace
    )
    this.emitEvent(
      createPodBoundEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        selectedNode.metadata.name,
        updatedPod,
        pod,
        'scheduler-controller'
      )
    )
  }

  private findFeasibleNodes(nodes: Node[], pod: Pod): Node[] {
    return nodes.filter((node) => {
      return isNodeEligibleForPod(pod, node)
    })
  }

  private selectNode(feasibleNodes: Node[]): Node | null {
    if (feasibleNodes.length === 0) {
      return null
    }
    const node = feasibleNodes[this.nextNodeIndex % feasibleNodes.length]
    this.nextNodeIndex = (this.nextNodeIndex + 1) % feasibleNodes.length
    return node
  }
}

export const createSchedulerController = (
  apiServer: ApiServerFacade,
  options: SchedulerControllerOptions = {}
): SchedulerController => {
  const controller = new SchedulerController(apiServer, options)
  controller.start()
  return controller
}
