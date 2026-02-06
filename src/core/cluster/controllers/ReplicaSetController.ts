// ═══════════════════════════════════════════════════════════════════════════
// REPLICASET CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
// Watches ReplicaSet and Pod events, enqueues keys to work queue,
// and reconciles to ensure correct number of pods are running.
// Follows Kubernetes controller pattern: watch -> enqueue -> reconcile

import type { EventBus } from '../events/EventBus'
import type { ClusterEvent } from '../events/types'
import { createPodCreatedEvent, createPodDeletedEvent, createReplicaSetUpdatedEvent } from '../events/types'
import type { Container, Pod } from '../ressources/Pod'
import { createPod } from '../ressources/Pod'
import type { ReplicaSet, ReplicaSetStatus } from '../ressources/ReplicaSet'
import { selectorMatchesLabels } from '../ressources/ReplicaSet'
import {
  createOwnerRef,
  findOwnerByRef,
  generateSuffix,
  getOwnedResources,
  statusEquals,
  subscribeToEvents
} from './helpers'
import type { ClusterEventType, Controller, ControllerState } from './types'
import { createWorkQueue, type WorkQueue } from './WorkQueue'

// ─── Constants ────────────────────────────────────────────────────────────

const WATCHED_EVENTS: ClusterEventType[] = [
  'ReplicaSetCreated',
  'ReplicaSetUpdated',
  'ReplicaSetDeleted',
  'PodCreated',
  'PodDeleted'
]

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Create a resource key from namespace and name
 */
const makeKey = (namespace: string, name: string): string => `${namespace}/${name}`

/**
 * Parse a resource key into namespace and name
 */
const parseKey = (key: string): { namespace: string; name: string } => {
  const [namespace, name] = key.split('/')
  return { namespace, name }
}

/**
 * Convert PodTemplateSpec containers to Pod containers
 */
const convertTemplateContainers = (
  templateContainers: ReplicaSet['spec']['template']['spec']['containers']
): Container[] => {
  return templateContainers.map((container) => ({
    name: container.name,
    image: container.image,
    ...(container.command && { command: container.command }),
    ...(container.args && { args: container.args }),
    ...(container.ports && { ports: container.ports })
  }))
}

/**
 * Create a Pod from ReplicaSet template with proper ownerReference
 */
const createPodFromTemplate = (rs: ReplicaSet): Pod => {
  const podName = `${rs.metadata.name}-${generateSuffix()}`
  const templateLabels = rs.spec.template.metadata?.labels || {}

  return createPod({
    name: podName,
    namespace: rs.metadata.namespace,
    labels: {
      ...templateLabels,
      'pod-template-hash': rs.metadata.name.split('-').pop() || ''
    },
    containers: convertTemplateContainers(rs.spec.template.spec.containers),
    phase: 'Running',
    ownerReferences: [createOwnerRef(rs)]
  })
}

/**
 * Compute ReplicaSet status from owned pods
 */
const computeReplicaSetStatus = (ownedPods: Pod[]): ReplicaSetStatus => {
  const readyPods = ownedPods.filter((p) => p.status.phase === 'Running')

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
export class ReplicaSetController implements Controller {
  private eventBus: EventBus
  private getState: () => ControllerState
  private workQueue: WorkQueue
  private unsubscribe: (() => void) | null = null

  constructor(eventBus: EventBus, getState: () => ControllerState) {
    this.eventBus = eventBus
    this.getState = getState
    this.workQueue = createWorkQueue({ processDelay: 0 })
  }

  /**
   * Start watching for events and processing the work queue
   */
  start(): void {
    // Subscribe to events - they will enqueue keys
    this.unsubscribe = subscribeToEvents(this.eventBus, WATCHED_EVENTS, (event) => this.handleEvent(event))

    // Start processing the work queue
    this.workQueue.start((key) => this.reconcile(key))
  }

  /**
   * Stop watching for events and processing the work queue
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
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
        this.enqueueReplicaSet(event.payload.replicaSet)
        break

      case 'ReplicaSetDeleted':
        // For deletion, we need to clean up owned pods
        // Enqueue with a special marker or handle inline
        this.handleReplicaSetDeleted(event.payload.deletedReplicaSet)
        break

      case 'PodCreated':
      case 'PodDeleted':
        // Find and enqueue the owning ReplicaSet
        const pod = event.type === 'PodCreated' ? event.payload.pod : event.payload.deletedPod
        this.enqueueOwnerReplicaSet(pod)
        break
    }
  }

  /**
   * Enqueue a ReplicaSet for reconciliation
   */
  private enqueueReplicaSet(rs: ReplicaSet): void {
    const key = makeKey(rs.metadata.namespace, rs.metadata.name)
    this.workQueue.add(key)
  }

  /**
   * Find and enqueue the ReplicaSet that owns this pod
   */
  private enqueueOwnerReplicaSet(pod: Pod): void {
    const state = this.getState()
    const ownerRs = findOwnerByRef(pod, 'ReplicaSet', () => state.getReplicaSets(pod.metadata.namespace))

    if (ownerRs) {
      this.enqueueReplicaSet(ownerRs)
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
      this.eventBus.emit(createPodDeletedEvent(pod.metadata.name, pod.metadata.namespace, pod, 'replicaset-controller'))
    }
  }

  /**
   * Reconcile a ReplicaSet by key
   * This is idempotent: reads current state and converges to desired state
   */
  reconcile(key: string): void {
    const { namespace, name } = parseKey(key)
    const state = this.getState()

    // Get the current ReplicaSet from state
    const rsResult = state.findReplicaSet(name, namespace)
    if (!rsResult.ok || !rsResult.value) {
      // ReplicaSet was deleted, nothing to reconcile
      return
    }

    const rs = rsResult.value

    // Get all pods in namespace: owned by this ReplicaSet and matching its selector
    const allPods = state.getPods(namespace)
    const ownedPods = getOwnedResources(rs, allPods).filter((pod) =>
      selectorMatchesLabels(rs.spec.selector, pod.metadata.labels)
    )

    // Reconcile replica count
    const desiredReplicas = rs.spec.replicas ?? 1
    const currentReplicas = ownedPods.length

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
      const podsToRemove = ownedPods.slice(0, podsToDelete)

      for (const pod of podsToRemove) {
        this.eventBus.emit(
          createPodDeletedEvent(pod.metadata.name, pod.metadata.namespace, pod, 'replicaset-controller')
        )
      }
    }

    // Update ReplicaSet status if changed
    const newStatus = computeReplicaSetStatus(ownedPods)
    if (!statusEquals(rs.status, newStatus, ['replicas', 'readyReplicas', 'availableReplicas'])) {
      const updatedRs: ReplicaSet = {
        ...rs,
        status: newStatus
      }
      this.eventBus.emit(
        createReplicaSetUpdatedEvent(rs.metadata.name, rs.metadata.namespace, updatedRs, rs, 'replicaset-controller')
      )
    }
  }
}

/**
 * Create and start a ReplicaSet controller
 */
export const createReplicaSetController = (
  eventBus: EventBus,
  getState: () => ControllerState
): ReplicaSetController => {
  const controller = new ReplicaSetController(eventBus, getState)
  controller.start()
  return controller
}
