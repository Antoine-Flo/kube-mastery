// ═══════════════════════════════════════════════════════════════════════════
// DAEMONSET CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
// Reconciles DaemonSet resources to one Pod per node.

import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { EventBus } from '../../cluster/events/EventBus'
import type { ClusterEvent } from '../../cluster/events/types'
import type {
  DaemonSet,
  DaemonSetStatus
} from '../../cluster/ressources/DaemonSet'
import type { Node } from '../../cluster/ressources/Node'
import type { Pod } from '../../cluster/ressources/Pod'
import { createPod } from '../../cluster/ressources/Pod'
import { generateTemplateHash } from '../../cluster/ressources/Deployment'
import { selectorMatchesLabels } from '../../cluster/ressources/ReplicaSet'
import {
  createOwnerRef,
  findOwnerByRef,
  generateSuffix,
  getOwnedResources,
  reportControllerObservation,
  startPeriodicResync,
  statusEquals,
  subscribeToEvents
} from '../controller-runtime/helpers'
import { createControllerStateFromApi } from '../controller-runtime/stateFromApi'
import {
  convertTemplateContainers,
  convertTemplateInitContainers
} from './podTemplateConverters'
import type {
  ClusterEventType,
  ControllerResyncOptions,
  ControllerState,
  ReconcilerController
} from '../controller-runtime/types'
import {
  createWorkQueue,
  type WorkQueue
} from '../controller-runtime/WorkQueue'

const WATCHED_EVENTS: ClusterEventType[] = [
  'DaemonSetCreated',
  'DaemonSetUpdated',
  'DaemonSetDeleted',
  'PodCreated',
  'PodUpdated',
  'PodDeleted'
]

const CONTROLLER_REVISION_HASH_ANNOTATION = 'controller-revision-hash'

const makeKey = (namespace: string, name: string): string => {
  return `${namespace}/${name}`
}

const parseKey = (key: string): { namespace: string; name: string } => {
  const [namespace, name] = key.split('/')
  return { namespace, name }
}

const createPodFromTemplate = (
  daemonSet: DaemonSet,
  node: Node,
  templateHash: string
): Pod => {
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
    annotations: {
      ...(daemonSet.spec.template.metadata?.annotations ?? {}),
      [CONTROLLER_REVISION_HASH_ANNOTATION]: templateHash
    },
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
  const isPodReady = (pod: Pod): boolean => {
    const conditions = pod.status.conditions ?? []
    const readyCondition = conditions.find((condition) => {
      return condition.type === 'Ready'
    })
    if (readyCondition != null) {
      return readyCondition.status === 'True'
    }
    return pod.status.phase === 'Running'
  }
  const currentNumberScheduled = ownedPods.length
  const numberReady = ownedPods.filter((pod) => isPodReady(pod)).length

  return {
    currentNumberScheduled,
    desiredNumberScheduled,
    numberReady
  }
}

export class DaemonSetController implements ReconcilerController {
  private apiServer: ApiServerFacade
  private eventBus: EventBus
  private getState: () => ControllerState
  private workQueue: WorkQueue
  private unsubscribe: (() => void) | null = null
  private stopPeriodicResync: () => void = () => {}
  private options: ControllerResyncOptions

  constructor(
    apiServer: ApiServerFacade,
    options: ControllerResyncOptions = {}
  ) {
    this.apiServer = apiServer
    this.eventBus = apiServer.getEventBus()
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
      this.enqueueDaemonSet(event.payload.daemonSet, event.type)
      return
    }

    if (event.type === 'DaemonSetDeleted') {
      this.handleDaemonSetDeleted(event.payload.deletedDaemonSet)
      return
    }

    if (event.type === 'PodCreated' || event.type === 'PodUpdated') {
      this.enqueueOwnerDaemonSet(event.payload.pod, event.type)
      this.enqueueMatchingDaemonSets(event.payload.pod, event.type)
      return
    }

    if (event.type === 'PodDeleted') {
      this.enqueueOwnerDaemonSet(event.payload.deletedPod, event.type)
      this.enqueueMatchingDaemonSets(event.payload.deletedPod, event.type)
    }
  }

  private enqueueDaemonSet(
    daemonSet: DaemonSet,
    eventType?: ClusterEventType,
    reason?: string
  ): void {
    const key = makeKey(daemonSet.metadata.namespace, daemonSet.metadata.name)
    this.workQueue.add(key)
    this.observe({
      action: 'enqueue',
      key,
      eventType,
      reason
    })
  }

  initialSync(): void {
    const state = this.getState()
    const daemonSets = state.getDaemonSets()
    for (const daemonSet of daemonSets) {
      this.enqueueDaemonSet(daemonSet, undefined, 'InitialSync')
    }
  }

  resyncAll(): void {
    this.initialSync()
  }

  private enqueueOwnerDaemonSet(pod: Pod, eventType?: ClusterEventType): void {
    const state = this.getState()
    const ownerDaemonSet = findOwnerByRef(pod, 'DaemonSet', () =>
      state.getDaemonSets(pod.metadata.namespace)
    )
    if (ownerDaemonSet) {
      this.enqueueDaemonSet(ownerDaemonSet, eventType, 'OwnerReference')
    } else {
      this.observe({
        action: 'skip',
        key: makeKey(pod.metadata.namespace, pod.metadata.name),
        eventType,
        reason: 'OwnerMissing'
      })
    }
  }

  private enqueueMatchingDaemonSets(
    pod: Pod,
    eventType?: ClusterEventType
  ): void {
    const state = this.getState()
    const daemonSets = state.getDaemonSets(pod.metadata.namespace)
    for (const daemonSet of daemonSets) {
      if (selectorMatchesLabels(daemonSet.spec.selector, pod.metadata.labels)) {
        this.enqueueDaemonSet(daemonSet, eventType, 'SelectorMatch')
      }
    }
  }

  private handleDaemonSetDeleted(daemonSet: DaemonSet): void {
    const state = this.getState()
    const allPods = state.getPods(daemonSet.metadata.namespace)
    const ownedPods = getOwnedResources(daemonSet, allPods)
    for (const pod of ownedPods) {
      this.apiServer.deleteResource(
        'Pod',
        pod.metadata.name,
        pod.metadata.namespace
      )
    }
  }

  reconcile(key: string): void {
    this.observe({
      action: 'reconcile',
      key,
      reason: 'Start'
    })
    const { namespace, name } = parseKey(key)
    const state = this.getState()
    const daemonSetResult = state.findDaemonSet(name, namespace)
    if (!daemonSetResult.ok || daemonSetResult.value == null) {
      this.observe({
        action: 'skip',
        key,
        reason: 'NotFound'
      })
      return
    }

    const daemonSet = daemonSetResult.value
    const allNodes = state.getNodes()
    const allPods = state.getPods(namespace)
    const templateHash = generateTemplateHash(daemonSet.spec.template).slice(
      0,
      10
    )

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
        const pod = createPodFromTemplate(daemonSet, node, templateHash)
        this.apiServer.createResource('Pod', pod, pod.metadata.namespace)
      } else if (podsForNode.length > 1) {
        const podsToDelete = podsForNode.slice(1)
        for (const podToDelete of podsToDelete) {
          this.apiServer.deleteResource(
            'Pod',
            podToDelete.metadata.name,
            podToDelete.metadata.namespace
          )
        }
      } else {
        const pod = podsForNode[0]
        const podHash =
          pod.metadata.annotations?.[CONTROLLER_REVISION_HASH_ANNOTATION]
        if (podHash !== templateHash) {
          this.apiServer.deleteResource(
            'Pod',
            pod.metadata.name,
            pod.metadata.namespace
          )
          const replacementPod = createPodFromTemplate(
            daemonSet,
            node,
            templateHash
          )
          this.apiServer.createResource(
            'Pod',
            replacementPod,
            replacementPod.metadata.namespace
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
        this.apiServer.deleteResource(
          'Pod',
          pod.metadata.name,
          pod.metadata.namespace
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
      this.observe({
        action: 'skip',
        key,
        reason: 'NoStatusChange'
      })
      return
    }

    const updatedDaemonSet: DaemonSet = {
      ...daemonSet,
      status: newStatus
    }
    this.apiServer.updateResource(
      'DaemonSet',
      daemonSet.metadata.name,
      updatedDaemonSet,
      daemonSet.metadata.namespace
    )
  }

  private observe(input: {
    action: 'enqueue' | 'reconcile' | 'skip'
    key: string
    reason?: string
    eventType?: ClusterEventType
  }): void {
    reportControllerObservation(this.options, {
      controller: 'DaemonSetController',
      action: input.action,
      key: input.key,
      reason: input.reason,
      eventType: input.eventType
    })
  }
}

export const createDaemonSetController = (
  apiServer: ApiServerFacade,
  options: ControllerResyncOptions = {}
): DaemonSetController => {
  const controller = new DaemonSetController(apiServer, options)
  controller.start()
  return controller
}
