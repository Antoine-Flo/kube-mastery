// ═══════════════════════════════════════════════════════════════════════════
// REPLICASET CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
// Watches ReplicaSet and Pod events, enqueues keys to work queue,
// and reconciles to ensure correct number of pods are running.
// Follows Kubernetes controller pattern: watch -> enqueue -> reconcile

import type { EventBus } from '../events/EventBus'
import type { ClusterEvent } from '../events/types'
import {
  createPodCreatedEvent,
  createPodDeletedEvent,
  createReplicaSetUpdatedEvent
} from '../events/types'
import type { Pod } from '../ressources/Pod'
import { createPod } from '../ressources/Pod'
import type { ReplicaSet, ReplicaSetStatus } from '../ressources/ReplicaSet'
import { selectorMatchesLabels } from '../ressources/ReplicaSet'
import {
  createOwnerRef,
  findOwnerByRef,
  generateSuffix,
  getOwnedResources,
  reportControllerObservation,
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

// ─── Constants ────────────────────────────────────────────────────────────

const WATCHED_EVENTS: ClusterEventType[] = [
  'ReplicaSetCreated',
  'ReplicaSetUpdated',
  'ReplicaSetDeleted',
  'PodCreated',
  'PodUpdated',
  'PodDeleted'
]

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Create a resource key from namespace and name
 */
const makeKey = (namespace: string, name: string): string =>
  `${namespace}/${name}`

/**
 * Parse a resource key into namespace and name
 */
const parseKey = (key: string): { namespace: string; name: string } => {
  const [namespace, name] = key.split('/')
  return { namespace, name }
}

/**
 * Create a Pod from ReplicaSet template with proper ownerReference
 */
const createPodFromTemplate = (rs: ReplicaSet): Pod => {
  const podName = `${rs.metadata.name}-${generateSuffix()}`
  const templateLabels = rs.spec.template.metadata?.labels || {}
  const initContainers = convertTemplateInitContainers(
    rs.spec.template.spec.initContainers
  )

  return createPod({
    name: podName,
    namespace: rs.metadata.namespace,
    labels: {
      ...templateLabels,
      'pod-template-hash': rs.metadata.name.split('-').pop() || ''
    },
    nodeSelector: rs.spec.template.spec.nodeSelector,
    tolerations: rs.spec.template.spec.tolerations,
    ...(initContainers && { initContainers }),
    containers: convertTemplateContainers(rs.spec.template.spec.containers),
    ...(rs.spec.template.spec.volumes && {
      volumes: rs.spec.template.spec.volumes
    }),
    phase: 'Pending',
    ownerReferences: [createOwnerRef(rs)]
  })
}

/**
 * Compute ReplicaSet status from owned pods
 */
const isPodReady = (pod: Pod): boolean => {
  const conditions = pod.status.conditions ?? []
  const readyCondition = conditions.find((condition) => condition.type === 'Ready')
  if (readyCondition != null) {
    return readyCondition.status === 'True'
  }
  return pod.status.phase === 'Running'
}

const isTerminalPod = (pod: Pod): boolean => {
  return pod.status.phase === 'Succeeded' || pod.status.phase === 'Failed'
}

const computeReplicaSetStatus = (ownedPods: Pod[]): ReplicaSetStatus => {
  const readyPods = ownedPods.filter((pod) => isPodReady(pod))

  return {
    replicas: ownedPods.length,
    readyReplicas: readyPods.length,
    availableReplicas: readyPods.length,
    fullyLabeledReplicas: ownedPods.length
  }
}

// ─── Controller ───────────────────────────────────────────────────────────

/**
 * ReplicaSet Controller
 * Ensures the correct number of pods are running for each ReplicaSet
 */
export class ReplicaSetController implements ReconcilerController {
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

  /**
   * Start watching for events and processing the work queue
   */
  start(): void {
    // Subscribe to events - they will enqueue keys
    this.unsubscribe = subscribeToEvents(
      this.eventBus,
      WATCHED_EVENTS,
      (event) => this.handleEvent(event)
    )

    // Start processing the work queue
    this.workQueue.start((key) => this.reconcile(key))

    this.initialSync()
    this.stopPeriodicResync = startPeriodicResync(
      this.options.resyncIntervalMs,
      () => this.resyncAll()
    )
  }

  /**
   * Stop watching for events and processing the work queue
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.stopPeriodicResync()
    this.stopPeriodicResync = () => {}
    this.workQueue.stop()
  }

  /**
   * Handle incoming cluster events by enqueueing the relevant ReplicaSet key
   */
  private handleEvent(event: ClusterEvent): void {
    switch (event.type) {
      case 'ReplicaSetCreated':
      case 'ReplicaSetUpdated':
        // Enqueue the ReplicaSet itself
        this.enqueueReplicaSet(event.payload.replicaSet, event.type)
        break

      case 'ReplicaSetDeleted':
        // For deletion, we need to clean up owned pods
        // Enqueue with a special marker or handle inline
        this.handleReplicaSetDeleted(event.payload.deletedReplicaSet)
        break

      case 'PodCreated':
      case 'PodUpdated':
      case 'PodDeleted':
        // Find and enqueue the owning ReplicaSet
        const pod =
          event.type === 'PodCreated'
            ? event.payload.pod
            : event.type === 'PodUpdated'
              ? event.payload.pod
            : event.payload.deletedPod
        this.enqueueOwnerReplicaSet(pod, event.type)
        this.enqueueMatchingReplicaSets(pod, event.type)
        break
    }
  }

  /**
   * Enqueue a ReplicaSet for reconciliation
   */
  private enqueueReplicaSet(
    rs: ReplicaSet,
    eventType?: ClusterEventType,
    reason?: string
  ): void {
    const key = makeKey(rs.metadata.namespace, rs.metadata.name)
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
    const replicaSets = state.getReplicaSets()
    for (const replicaSet of replicaSets) {
      this.enqueueReplicaSet(replicaSet, undefined, 'InitialSync')
    }
  }

  resyncAll(): void {
    this.initialSync()
  }

  /**
   * Find and enqueue the ReplicaSet that owns this pod
   */
  private enqueueOwnerReplicaSet(
    pod: Pod,
    eventType?: ClusterEventType
  ): void {
    const state = this.getState()
    const ownerRs = findOwnerByRef(pod, 'ReplicaSet', () =>
      state.getReplicaSets(pod.metadata.namespace)
    )

    if (ownerRs) {
      this.enqueueReplicaSet(ownerRs, eventType, 'OwnerReference')
    } else {
      this.observe({
        action: 'skip',
        key: makeKey(pod.metadata.namespace, pod.metadata.name),
        eventType,
        reason: 'OwnerMissing'
      })
    }
  }

  /**
   * Enqueue all ReplicaSets in the pod namespace whose selector matches pod labels.
   * This allows reconciliation for "orphan" pods that still match a ReplicaSet selector.
   */
  private enqueueMatchingReplicaSets(
    pod: Pod,
    eventType?: ClusterEventType
  ): void {
    const state = this.getState()
    const replicaSets = state.getReplicaSets(pod.metadata.namespace)
    for (const replicaSet of replicaSets) {
      if (
        selectorMatchesLabels(replicaSet.spec.selector, pod.metadata.labels)
      ) {
        this.enqueueReplicaSet(replicaSet, eventType, 'SelectorMatch')
      }
    }
  }

  /**
   * Handle ReplicaSet deletion - delete all owned pods
   */
  private handleReplicaSetDeleted(rs: ReplicaSet): void {
    const state = this.getState()
    const allPods = state.getPods(rs.metadata.namespace)
    const ownedPods = getOwnedResources(rs, allPods)

    for (const pod of ownedPods) {
      this.eventBus.emit(
        createPodDeletedEvent(
          pod.metadata.name,
          pod.metadata.namespace,
          pod,
          'replicaset-controller'
        )
      )
    }
  }

  /**
   * Reconcile a ReplicaSet by key
   * This is idempotent: reads current state and converges to desired state
   */
  reconcile(key: string): void {
    this.observe({
      action: 'reconcile',
      key,
      reason: 'Start'
    })
    const { namespace, name } = parseKey(key)
    const state = this.getState()

    // Get the current ReplicaSet from state
    const rsResult = state.findReplicaSet(name, namespace)
    if (!rsResult.ok || !rsResult.value) {
      // ReplicaSet was deleted, nothing to reconcile
      this.observe({
        action: 'skip',
        key,
        reason: 'NotFound'
      })
      return
    }

    const rs = rsResult.value

    // Get all pods in namespace matching this ReplicaSet selector.
    // We reconcile against all matching pods (owned or not), like Kubernetes does for selector overlap.
    const allPods = state.getPods(namespace)
    const matchingPods = allPods.filter((pod) =>
      selectorMatchesLabels(rs.spec.selector, pod.metadata.labels)
    )
    const activeMatchingPods = matchingPods.filter((pod) => !isTerminalPod(pod))
    const ownedPods = getOwnedResources(rs, activeMatchingPods)
    const ownedPodNames = new Set(
      ownedPods.map((pod) => `${pod.metadata.namespace}/${pod.metadata.name}`)
    )
    const unownedMatchingPods = activeMatchingPods.filter((pod) => {
      const podKey = `${pod.metadata.namespace}/${pod.metadata.name}`
      return !ownedPodNames.has(podKey)
    })

    // Reconcile replica count
    const desiredReplicas = rs.spec.replicas ?? 1
    const currentReplicas = activeMatchingPods.length

    if (currentReplicas < desiredReplicas) {
      // Create missing pods
      const podsToCreate = desiredReplicas - currentReplicas
      for (let i = 0; i < podsToCreate; i++) {
        const pod = createPodFromTemplate(rs)
        this.eventBus.emit(createPodCreatedEvent(pod, 'replicaset-controller'))
      }
    } else if (currentReplicas > desiredReplicas) {
      // Delete excess pods
      const podsToDelete = currentReplicas - desiredReplicas
      // Prefer deleting non-owned matching pods first (e.g. "intruder" pods),
      // then owned pods if needed.
      const podsToRemove = [...unownedMatchingPods, ...ownedPods].slice(
        0,
        podsToDelete
      )

      for (const pod of podsToRemove) {
        this.eventBus.emit(
          createPodDeletedEvent(
            pod.metadata.name,
            pod.metadata.namespace,
            pod,
            'replicaset-controller'
          )
        )
      }
    }

    // Update ReplicaSet status if changed
    const newStatus = computeReplicaSetStatus(activeMatchingPods)
    if (
      !statusEquals(rs.status, newStatus, [
        'replicas',
        'readyReplicas',
        'availableReplicas'
      ])
    ) {
      const updatedRs: ReplicaSet = {
        ...rs,
        status: newStatus
      }
      this.eventBus.emit(
        createReplicaSetUpdatedEvent(
          rs.metadata.name,
          rs.metadata.namespace,
          updatedRs,
          rs,
          'replicaset-controller'
        )
      )
    } else {
      this.observe({
        action: 'skip',
        key,
        reason: 'NoStatusChange'
      })
    }
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
      controller: 'ReplicaSetController',
      action: input.action,
      key: input.key,
      reason: input.reason,
      eventType: input.eventType
    })
  }
}

/**
 * Create and start a ReplicaSet controller
 */
export const createReplicaSetController = (
  eventBus: EventBus,
  getState: () => ControllerState,
  options: ControllerResyncOptions = {}
): ReplicaSetController => {
  const controller = new ReplicaSetController(eventBus, getState, options)
  controller.start()
  return controller
}
