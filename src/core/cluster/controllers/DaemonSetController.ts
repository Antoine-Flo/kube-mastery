// ═══════════════════════════════════════════════════════════════════════════
// DAEMONSET CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
// Reconciles DaemonSet resources to one Pod per node.

import type { EventBus } from '../events/EventBus'
import type { ClusterEvent } from '../events/types'
import {
  createDaemonSetUpdatedEvent,
  createPodCreatedEvent,
  createPodDeletedEvent
} from '../events/types'
import type { DaemonSet, DaemonSetStatus } from '../ressources/DaemonSet'
import type { Node } from '../ressources/Node'
import type { Pod } from '../ressources/Pod'
import { createPod } from '../ressources/Pod'
import { selectorMatchesLabels } from '../ressources/ReplicaSet'
import {
  createOwnerRef,
  findOwnerByRef,
  generateSuffix,
  getOwnedResources,
  startPeriodicResync,
  statusEquals,
  subscribeToEvents
} from './helpers'
import {
  convertTemplateContainers,
  convertTemplateInitContainers
} from './podTemplateConverters'
import type {
  ClusterEventType,
  ControllerResyncOptions,
  ControllerState,
  ReconcilerController
} from './types'
import { createWorkQueue, type WorkQueue } from './WorkQueue'

const WATCHED_EVENTS: ClusterEventType[] = [
  'DaemonSetCreated',
  'DaemonSetUpdated',
  'DaemonSetDeleted',
  'PodCreated',
  'PodUpdated',
  'PodDeleted'
]

const makeKey = (namespace: string, name: string): string => {
  return `${namespace}/${name}`
}

const parseKey = (key: string): { namespace: string; name: string } => {
  const [namespace, name] = key.split('/')
  return { namespace, name }
}

const createPodFromTemplate = (daemonSet: DaemonSet, node: Node): Pod => {
  const podName = `${daemonSet.metadata.name}-${generateSuffix()}`
  const templateLabels = daemonSet.spec.template.metadata?.labels || {}
  const initContainers = convertTemplateInitContainers(
    daemonSet.spec.template.spec.initContainers
  )

  return createPod({
    name: podName,
    namespace: daemonSet.metadata.namespace,
    nodeName: node.metadata.name,
    labels: {
      ...templateLabels
    },
    annotations: daemonSet.spec.template.metadata?.annotations,
    nodeSelector: daemonSet.spec.template.spec.nodeSelector,
    tolerations: daemonSet.spec.template.spec.tolerations,
    ...(initContainers && { initContainers }),
    containers: convertTemplateContainers(
      daemonSet.spec.template.spec.containers
    ),
    ...(daemonSet.spec.template.spec.volumes && {
      volumes: daemonSet.spec.template.spec.volumes
    }),
    ownerReferences: [createOwnerRef(daemonSet)],
    phase: 'Pending'
  })
}

const computeDaemonSetStatus = (
  ownedPods: Pod[],
  desiredNumberScheduled: number
): DaemonSetStatus => {
  const currentNumberScheduled = ownedPods.length
  const numberReady = ownedPods.filter(
    (pod) => pod.status.phase === 'Running'
  ).length

  return {
    currentNumberScheduled,
    desiredNumberScheduled,
    numberReady
  }
}

export class DaemonSetController implements ReconcilerController {
  private eventBus: EventBus
  private getState: () => ControllerState
  private workQueue: WorkQueue
  private unsubscribe: (() => void) | null = null
  private stopPeriodicResync: () => void = () => {}
  private options: ControllerResyncOptions

  constructor(
    eventBus: EventBus,
    getState: () => ControllerState,
    options: ControllerResyncOptions = {}
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

    this.workQueue.start((key) => this.reconcile(key))
    this.initialSync()
    this.stopPeriodicResync = startPeriodicResync(
      this.options.resyncIntervalMs,
      () => this.resyncAll()
    )
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.stopPeriodicResync()
    this.stopPeriodicResync = () => {}
    this.workQueue.stop()
  }

  private handleEvent(event: ClusterEvent): void {
    if (
      event.type === 'DaemonSetCreated' ||
      event.type === 'DaemonSetUpdated'
    ) {
      this.enqueueDaemonSet(event.payload.daemonSet)
      return
    }

    if (event.type === 'DaemonSetDeleted') {
      this.handleDaemonSetDeleted(event.payload.deletedDaemonSet)
      return
    }

    if (event.type === 'PodCreated' || event.type === 'PodUpdated') {
      this.enqueueOwnerDaemonSet(event.payload.pod)
      return
    }

    if (event.type === 'PodDeleted') {
      this.enqueueOwnerDaemonSet(event.payload.deletedPod)
    }
  }

  private enqueueDaemonSet(daemonSet: DaemonSet): void {
    const key = makeKey(daemonSet.metadata.namespace, daemonSet.metadata.name)
    this.workQueue.add(key)
  }

  initialSync(): void {
    const state = this.getState()
    const daemonSets = state.getDaemonSets()
    for (const daemonSet of daemonSets) {
      this.enqueueDaemonSet(daemonSet)
    }
  }

  resyncAll(): void {
    this.initialSync()
  }

  private enqueueOwnerDaemonSet(pod: Pod): void {
    const state = this.getState()
    const ownerDaemonSet = findOwnerByRef(pod, 'DaemonSet', () =>
      state.getDaemonSets(pod.metadata.namespace)
    )
    if (ownerDaemonSet) {
      this.enqueueDaemonSet(ownerDaemonSet)
    }
  }

  private handleDaemonSetDeleted(daemonSet: DaemonSet): void {
    const state = this.getState()
    const allPods = state.getPods(daemonSet.metadata.namespace)
    const ownedPods = getOwnedResources(daemonSet, allPods)
    for (const pod of ownedPods) {
      this.eventBus.emit(
        createPodDeletedEvent(
          pod.metadata.name,
          pod.metadata.namespace,
          pod,
          'daemonset-controller'
        )
      )
    }
  }

  reconcile(key: string): void {
    const { namespace, name } = parseKey(key)
    const state = this.getState()
    const daemonSetResult = state.findDaemonSet(name, namespace)
    if (!daemonSetResult.ok || daemonSetResult.value == null) {
      return
    }

    const daemonSet = daemonSetResult.value
    const allNodes = state.getNodes()
    const allPods = state.getPods(namespace)

    const ownedPods = getOwnedResources(daemonSet, allPods).filter((pod) => {
      return selectorMatchesLabels(daemonSet.spec.selector, pod.metadata.labels)
    })

    const nodesByName = new Map<string, Node>()
    for (const node of allNodes) {
      nodesByName.set(node.metadata.name, node)
    }

    const podsByNode = new Map<string, Pod[]>()
    for (const pod of ownedPods) {
      const nodeName = pod.spec.nodeName
      if (!nodeName) {
        continue
      }
      const existing = podsByNode.get(nodeName)
      if (existing) {
        existing.push(pod)
      } else {
        podsByNode.set(nodeName, [pod])
      }
    }

    for (const node of allNodes) {
      const podsForNode = podsByNode.get(node.metadata.name) ?? []
      if (podsForNode.length === 0) {
        const pod = createPodFromTemplate(daemonSet, node)
        this.eventBus.emit(createPodCreatedEvent(pod, 'daemonset-controller'))
      } else if (podsForNode.length > 1) {
        const podsToDelete = podsForNode.slice(1)
        for (const podToDelete of podsToDelete) {
          this.eventBus.emit(
            createPodDeletedEvent(
              podToDelete.metadata.name,
              podToDelete.metadata.namespace,
              podToDelete,
              'daemonset-controller'
            )
          )
        }
      }
    }

    for (const pod of ownedPods) {
      const nodeName = pod.spec.nodeName
      if (!nodeName) {
        continue
      }
      if (!nodesByName.has(nodeName)) {
        this.eventBus.emit(
          createPodDeletedEvent(
            pod.metadata.name,
            pod.metadata.namespace,
            pod,
            'daemonset-controller'
          )
        )
      }
    }

    const desiredNumberScheduled = allNodes.length
    const newStatus = computeDaemonSetStatus(ownedPods, desiredNumberScheduled)
    if (
      statusEquals(daemonSet.status, newStatus, [
        'currentNumberScheduled',
        'desiredNumberScheduled',
        'numberReady'
      ])
    ) {
      return
    }

    const updatedDaemonSet: DaemonSet = {
      ...daemonSet,
      status: newStatus
    }
    this.eventBus.emit(
      createDaemonSetUpdatedEvent(
        daemonSet.metadata.name,
        daemonSet.metadata.namespace,
        updatedDaemonSet,
        daemonSet,
        'daemonset-controller'
      )
    )
  }
}

export const createDaemonSetController = (
  eventBus: EventBus,
  getState: () => ControllerState,
  options: ControllerResyncOptions = {}
): DaemonSetController => {
  const controller = new DaemonSetController(eventBus, getState, options)
  controller.start()
  return controller
}
