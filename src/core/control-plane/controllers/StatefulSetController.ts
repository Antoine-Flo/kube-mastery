import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { EventBus } from '../../cluster/events/EventBus'
import type { ClusterEvent } from '../../cluster/events/types'
import type {
  StatefulSet,
  StatefulSetStatus
} from '../../cluster/ressources/StatefulSet'
import type { Pod } from '../../cluster/ressources/Pod'
import { createPod } from '../../cluster/ressources/Pod'
import { generateTemplateHash } from '../../cluster/ressources/Deployment'
import { selectorMatchesLabels } from '../../cluster/ressources/ReplicaSet'
import {
  createOwnerRef,
  getOwnedResources,
  reportControllerObservation,
  startPeriodicResync,
  statusEquals,
  subscribeToEvents
} from '../controller-runtime/helpers'
import { createControllerStateFromApi } from '../controller-runtime/stateFromApi'
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
import {
  convertTemplateContainers,
  convertTemplateInitContainers
} from './podTemplateConverters'

const WATCHED_EVENTS: ClusterEventType[] = [
  'StatefulSetCreated',
  'StatefulSetUpdated',
  'StatefulSetDeleted',
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

const getPodOrdinal = (statefulSetName: string, podName: string): number => {
  if (!podName.startsWith(`${statefulSetName}-`)) {
    return -1
  }
  const ordinalToken = podName.slice(statefulSetName.length + 1)
  const parsedOrdinal = Number.parseInt(ordinalToken, 10)
  if (Number.isNaN(parsedOrdinal) || parsedOrdinal < 0) {
    return -1
  }
  return parsedOrdinal
}

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

const createPodForOrdinal = (
  statefulSet: StatefulSet,
  ordinal: number,
  templateHash: string
): Pod => {
  const templateLabels = statefulSet.spec.template.metadata?.labels ?? {}
  const podName = `${statefulSet.metadata.name}-${ordinal}`
  const initContainers = convertTemplateInitContainers(
    statefulSet.spec.template.spec.initContainers
  )

  return createPod({
    name: podName,
    namespace: statefulSet.metadata.namespace,
    labels: {
      ...templateLabels
    },
    annotations: {
      ...(statefulSet.spec.template.metadata?.annotations ?? {}),
      [CONTROLLER_REVISION_HASH_ANNOTATION]: templateHash
    },
    nodeSelector: statefulSet.spec.template.spec.nodeSelector,
    tolerations: statefulSet.spec.template.spec.tolerations,
    ...(initContainers != null && { initContainers }),
    containers: convertTemplateContainers(
      statefulSet.spec.template.spec.containers
    ),
    ...(statefulSet.spec.template.spec.volumes != null && {
      volumes: statefulSet.spec.template.spec.volumes
    }),
    ownerReferences: [createOwnerRef(statefulSet)],
    phase: 'Pending'
  })
}

const computeStatefulSetStatus = (
  ownedPods: Pod[],
  desiredReplicas: number,
  templateHash: string
): StatefulSetStatus => {
  const readyReplicas = ownedPods.filter((pod) => isPodReady(pod)).length
  const updatedReplicas = ownedPods.filter((pod) => {
    return (
      pod.metadata.annotations?.[CONTROLLER_REVISION_HASH_ANNOTATION] ===
      templateHash
    )
  }).length

  return {
    replicas: desiredReplicas,
    readyReplicas,
    currentReplicas: ownedPods.length,
    updatedReplicas
  }
}

export class StatefulSetController implements ReconcilerController {
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
    if (this.unsubscribe != null) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.stopPeriodicResync()
    this.stopPeriodicResync = () => {}
    this.workQueue.stop()
  }

  initialSync(): void {
    const state = this.getState()
    const statefulSets = state.getStatefulSets()
    for (const statefulSet of statefulSets) {
      this.enqueueStatefulSet(statefulSet, undefined, 'InitialSync')
    }
  }

  resyncAll(): void {
    this.initialSync()
  }

  private handleEvent(event: ClusterEvent): void {
    if (
      event.type === 'StatefulSetCreated' ||
      event.type === 'StatefulSetUpdated'
    ) {
      this.enqueueStatefulSet(event.payload.statefulSet, event.type)
      return
    }

    if (event.type === 'PodCreated' || event.type === 'PodUpdated') {
      this.enqueueOwnerStatefulSet(event.payload.pod, event.type)
      return
    }

    if (event.type === 'PodDeleted') {
      this.enqueueOwnerStatefulSet(event.payload.deletedPod, event.type)
    }
  }

  private enqueueStatefulSet(
    statefulSet: StatefulSet,
    eventType?: ClusterEventType,
    reason?: string
  ): void {
    const key = makeKey(
      statefulSet.metadata.namespace,
      statefulSet.metadata.name
    )
    this.workQueue.add(key)
    this.observe({
      action: 'enqueue',
      key,
      eventType,
      reason
    })
  }

  private enqueueOwnerStatefulSet(
    pod: Pod,
    eventType?: ClusterEventType
  ): void {
    const ownerReference = pod.metadata.ownerReferences?.find((owner) => {
      return owner.kind === 'StatefulSet'
    })
    if (ownerReference == null) {
      return
    }

    const state = this.getState()
    const statefulSetResult = state.findStatefulSet(
      ownerReference.name,
      pod.metadata.namespace
    )
    if (!statefulSetResult.ok || statefulSetResult.value == null) {
      return
    }
    this.enqueueStatefulSet(
      statefulSetResult.value,
      eventType,
      'OwnerReference'
    )
  }

  reconcile(key: string): void {
    this.observe({
      action: 'reconcile',
      key,
      reason: 'Start'
    })

    const { namespace, name } = parseKey(key)
    const state = this.getState()
    const statefulSetResult = state.findStatefulSet(name, namespace)
    if (!statefulSetResult.ok || statefulSetResult.value == null) {
      this.observe({
        action: 'skip',
        key,
        reason: 'NotFound'
      })
      return
    }

    const statefulSet = statefulSetResult.value
    const desiredReplicas = statefulSet.spec.replicas ?? 1
    const templateHash = generateTemplateHash(statefulSet.spec.template).slice(
      0,
      10
    )

    const namespacePods = state.getPods(namespace)
    const ownedPods = getOwnedResources(statefulSet, namespacePods).filter(
      (pod) => {
        return selectorMatchesLabels(
          statefulSet.spec.selector,
          pod.metadata.labels
        )
      }
    )
    const podByOrdinal = new Map<number, Pod>()
    for (const pod of ownedPods) {
      const ordinal = getPodOrdinal(
        statefulSet.metadata.name,
        pod.metadata.name
      )
      if (ordinal < 0) {
        continue
      }
      if (!podByOrdinal.has(ordinal)) {
        podByOrdinal.set(ordinal, pod)
      } else {
        this.apiServer.deleteResource(
          'Pod',
          pod.metadata.name,
          pod.metadata.namespace
        )
      }
    }

    for (let ordinal = 0; ordinal < desiredReplicas; ordinal++) {
      const existingPod = podByOrdinal.get(ordinal)
      if (existingPod == null) {
        const pod = createPodForOrdinal(statefulSet, ordinal, templateHash)
        this.apiServer.createResource('Pod', pod, pod.metadata.namespace)
        continue
      }

      const existingHash =
        existingPod.metadata.annotations?.[CONTROLLER_REVISION_HASH_ANNOTATION]
      if (existingHash !== templateHash) {
        const isTerminating = existingPod.metadata.deletionTimestamp != null
        if (!isTerminating) {
          this.apiServer.deleteResource(
            'Pod',
            existingPod.metadata.name,
            existingPod.metadata.namespace
          )
        }
        // StatefulSet replacement is ordered: create the new Pod only
        // after the previous Pod for this ordinal has fully disappeared.
        continue
      }
    }

    for (const pod of ownedPods) {
      const ordinal = getPodOrdinal(
        statefulSet.metadata.name,
        pod.metadata.name
      )
      if (ordinal >= desiredReplicas) {
        this.apiServer.deleteResource(
          'Pod',
          pod.metadata.name,
          pod.metadata.namespace
        )
      }
    }

    const latestPods = this.getState()
      .getPods(namespace)
      .filter((pod) => {
        const ownerReferences = pod.metadata.ownerReferences ?? []
        return ownerReferences.some((ownerReference) => {
          return (
            ownerReference.kind === 'StatefulSet' &&
            ownerReference.name === statefulSet.metadata.name
          )
        })
      })

    const newStatus = computeStatefulSetStatus(
      latestPods,
      desiredReplicas,
      templateHash
    )
    if (
      statusEquals(statefulSet.status, newStatus, [
        'replicas',
        'readyReplicas',
        'currentReplicas',
        'updatedReplicas'
      ])
    ) {
      this.observe({
        action: 'skip',
        key,
        reason: 'NoStatusChange'
      })
      return
    }

    const updatedStatefulSet: StatefulSet = {
      ...statefulSet,
      status: newStatus
    }
    this.apiServer.updateResource(
      'StatefulSet',
      statefulSet.metadata.name,
      updatedStatefulSet,
      statefulSet.metadata.namespace
    )
  }

  private observe(input: {
    action: 'enqueue' | 'reconcile' | 'skip'
    key: string
    reason?: string
    eventType?: ClusterEventType
  }): void {
    reportControllerObservation(this.options, {
      controller: 'StatefulSetController',
      action: input.action,
      key: input.key,
      reason: input.reason,
      eventType: input.eventType
    })
  }
}

export const createStatefulSetController = (
  apiServer: ApiServerFacade,
  options: ControllerResyncOptions = {}
): StatefulSetController => {
  const controller = new StatefulSetController(apiServer, options)
  controller.start()
  return controller
}
