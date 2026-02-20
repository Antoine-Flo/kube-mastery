// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
//
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │                         DEPLOYMENT CONTROLLER                           │
//  └─────────────────────────────────────────────────────────────────────────┘
//
//  Events watched:
//    DeploymentCreated ──┐
//    DeploymentUpdated ──┼──► WorkQueue.add(key) ──► reconcile(key)
//    ReplicaSetUpdated ──┘
//
//  Reconcile loop:
//    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
//    │  Deployment  │ owns │  ReplicaSet  │ owns │     Pods     │
//    │  replicas: 3 │─────►│  replicas: 3 │─────►│ (managed by  │
//    │              │      │              │      │ RS controller)│
//    └──────────────┘      └──────────────┘      └──────────────┘
//
//  Actions:
//    - No RS exists     → Create new ReplicaSet
//    - RS exists        → Update replicas if needed
//    - Template changed → Create new RS, scale down old ones
//    - RS status change → Update Deployment status
//
// ═══════════════════════════════════════════════════════════════════════════

import type { EventBus } from '../events/EventBus'
import type { ClusterEvent } from '../events/types'
import {
  createDeploymentUpdatedEvent,
  createReplicaSetCreatedEvent,
  createReplicaSetDeletedEvent,
  createReplicaSetUpdatedEvent
} from '../events/types'
import type { Deployment, DeploymentStatus } from '../ressources/Deployment'
import { generateTemplateHash } from '../ressources/Deployment'
import type { ReplicaSet } from '../ressources/ReplicaSet'
import { createReplicaSet } from '../ressources/ReplicaSet'
import {
  createOwnerRef,
  findOwnerByRef,
  getOwnedResources,
  startPeriodicResync,
  statusEquals,
  subscribeToEvents
} from './helpers'
import type {
  ClusterEventType,
  ControllerResyncOptions,
  ControllerState,
  ReconcilerController
} from './types'
import { createWorkQueue, type WorkQueue } from './WorkQueue'

// ─── Constants ────────────────────────────────────────────────────────────

const WATCHED_EVENTS: ClusterEventType[] = [
  'DeploymentCreated',
  'DeploymentUpdated',
  'DeploymentDeleted',
  'ReplicaSetUpdated'
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
 * Generate ReplicaSet name from Deployment and template hash
 */
const generateReplicaSetName = (
  deploymentName: string,
  templateHash: string
): string => {
  return `${deploymentName}-${templateHash.substring(0, 10)}`
}

/**
 * Create ReplicaSet from Deployment spec with proper ownerReference
 */
const createReplicaSetFromDeployment = (deploy: Deployment): ReplicaSet => {
  const templateHash = generateTemplateHash(deploy.spec.template)
  const rsName = generateReplicaSetName(deploy.metadata.name, templateHash)

  // Build labels
  const labels: Record<string, string> = {
    ...(deploy.metadata.labels || {}),
    ...(deploy.spec.selector.matchLabels || {}),
    'pod-template-hash': templateHash.substring(0, 10)
  }

  // Build template labels
  const templateLabels: Record<string, string> = {
    ...(deploy.spec.template.metadata?.labels || {}),
    ...(deploy.spec.selector.matchLabels || {}),
    'pod-template-hash': templateHash.substring(0, 10)
  }

  return createReplicaSet({
    name: rsName,
    namespace: deploy.metadata.namespace,
    replicas: deploy.spec.replicas ?? 1,
    selector: {
      matchLabels: templateLabels
    },
    template: {
      ...deploy.spec.template,
      metadata: {
        ...deploy.spec.template.metadata,
        labels: templateLabels
      }
    },
    labels,
    ownerReferences: [createOwnerRef(deploy)]
  })
}

/**
 * Compute Deployment status from owned ReplicaSets
 */
const computeDeploymentStatus = (
  ownedReplicaSets: ReplicaSet[]
): DeploymentStatus => {
  let totalReplicas = 0
  let readyReplicas = 0
  let availableReplicas = 0
  let updatedReplicas = 0

  for (const rs of ownedReplicaSets) {
    totalReplicas += rs.status.replicas || 0
    readyReplicas += rs.status.readyReplicas || 0
    availableReplicas += rs.status.availableReplicas || 0
    updatedReplicas += rs.status.replicas || 0
  }

  return {
    replicas: totalReplicas,
    readyReplicas,
    availableReplicas,
    updatedReplicas
  }
}

// ─── Controller ───────────────────────────────────────────────────────────

/**
 * Deployment Controller
 * Manages ReplicaSets for each Deployment
 */
export class DeploymentController implements ReconcilerController {
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
   * Handle incoming cluster events by enqueueing the relevant Deployment key
   */
  private handleEvent(event: ClusterEvent): void {
    switch (event.type) {
      case 'DeploymentCreated':
      case 'DeploymentUpdated':
        // Enqueue the Deployment itself
        this.enqueueDeployment(event.payload.deployment)
        break

      case 'DeploymentDeleted':
        // For deletion, we need to clean up owned ReplicaSets
        this.handleDeploymentDeleted(event.payload.deletedDeployment)
        break

      case 'ReplicaSetUpdated':
        // Find and enqueue the owning Deployment
        this.enqueueOwnerDeployment(event.payload.replicaSet)
        break
    }
  }

  /**
   * Enqueue a Deployment for reconciliation
   */
  private enqueueDeployment(deploy: Deployment): void {
    const key = makeKey(deploy.metadata.namespace, deploy.metadata.name)
    this.workQueue.add(key)
  }

  initialSync(): void {
    const state = this.getState()
    const deployments = state.getDeployments()
    for (const deployment of deployments) {
      this.enqueueDeployment(deployment)
    }
  }

  resyncAll(): void {
    this.initialSync()
  }

  /**
   * Find and enqueue the Deployment that owns this ReplicaSet
   */
  private enqueueOwnerDeployment(rs: ReplicaSet): void {
    const state = this.getState()
    const ownerDeploy = findOwnerByRef(rs, 'Deployment', () =>
      state.getDeployments(rs.metadata.namespace)
    )

    if (ownerDeploy) {
      this.enqueueDeployment(ownerDeploy)
    }
  }

  /**
   * Handle Deployment deletion - delete all owned ReplicaSets
   */
  private handleDeploymentDeleted(deploy: Deployment): void {
    const state = this.getState()
    const allReplicaSets = state.getReplicaSets(deploy.metadata.namespace)
    const ownedReplicaSets = getOwnedResources(deploy, allReplicaSets)

    for (const rs of ownedReplicaSets) {
      this.eventBus.emit(
        createReplicaSetDeletedEvent(
          rs.metadata.name,
          rs.metadata.namespace,
          rs,
          'deployment-controller'
        )
      )
    }
  }

  /**
   * Reconcile a Deployment by key
   * This is idempotent: reads current state and converges to desired state
   */
  reconcile(key: string): void {
    const { namespace, name } = parseKey(key)
    const state = this.getState()

    const deployResult = state.findDeployment(name, namespace)
    if (!deployResult.ok || !deployResult.value) {
      return
    }

    const deploy = deployResult.value
    const ownedReplicaSets = getOwnedResources(
      deploy,
      state.getReplicaSets(namespace)
    )
    const currentRs = this.findCurrentReplicaSet(deploy, ownedReplicaSets)

    if (currentRs) {
      this.reconcileExistingReplicaSet(deploy, currentRs)
    } else {
      this.createNewReplicaSet(deploy, ownedReplicaSets)
    }

    this.updateDeploymentStatus(deploy, namespace)
  }

  /**
   * Find the ReplicaSet matching the current template
   */
  private findCurrentReplicaSet(
    deploy: Deployment,
    ownedReplicaSets: ReplicaSet[]
  ): ReplicaSet | undefined {
    const templateHash = generateTemplateHash(deploy.spec.template)
    const expectedRsName = generateReplicaSetName(
      deploy.metadata.name,
      templateHash
    )
    return ownedReplicaSets.find((rs) => rs.metadata.name === expectedRsName)
  }

  /**
   * Create a new ReplicaSet and scale down old ones
   */
  private createNewReplicaSet(
    deploy: Deployment,
    oldReplicaSets: ReplicaSet[]
  ): void {
    const newRs = createReplicaSetFromDeployment(deploy)
    this.eventBus.emit(
      createReplicaSetCreatedEvent(newRs, 'deployment-controller')
    )
    this.scaleDownReplicaSets(oldReplicaSets)
  }

  /**
   * Scale down all ReplicaSets to 0
   */
  private scaleDownReplicaSets(replicaSets: ReplicaSet[]): void {
    for (const rs of replicaSets) {
      if (rs.spec.replicas === 0) continue

      const scaledDownRs: ReplicaSet = {
        ...rs,
        spec: { ...rs.spec, replicas: 0 }
      }
      this.eventBus.emit(
        createReplicaSetUpdatedEvent(
          rs.metadata.name,
          rs.metadata.namespace,
          scaledDownRs,
          rs,
          'deployment-controller'
        )
      )
    }
  }

  /**
   * Update ReplicaSet replicas if needed
   */
  private reconcileExistingReplicaSet(
    deploy: Deployment,
    currentRs: ReplicaSet
  ): void {
    const desiredReplicas = deploy.spec.replicas ?? 1
    if (currentRs.spec.replicas === desiredReplicas) {
      return
    }

    const updatedRs: ReplicaSet = {
      ...currentRs,
      spec: { ...currentRs.spec, replicas: desiredReplicas }
    }
    this.eventBus.emit(
      createReplicaSetUpdatedEvent(
        currentRs.metadata.name,
        currentRs.metadata.namespace,
        updatedRs,
        currentRs,
        'deployment-controller'
      )
    )
  }

  /**
   * Update Deployment status from owned ReplicaSets
   */
  private updateDeploymentStatus(deploy: Deployment, namespace: string): void {
    const state = this.getState()
    const ownedReplicaSets = getOwnedResources(
      deploy,
      state.getReplicaSets(namespace)
    )
    const newStatus = computeDeploymentStatus(ownedReplicaSets)

    if (
      statusEquals(deploy.status, newStatus, [
        'replicas',
        'readyReplicas',
        'availableReplicas'
      ])
    ) {
      return
    }

    const updatedDeploy: Deployment = {
      ...deploy,
      status: newStatus
    }
    this.eventBus.emit(
      createDeploymentUpdatedEvent(
        deploy.metadata.name,
        deploy.metadata.namespace,
        updatedDeploy,
        deploy,
        'deployment-controller'
      )
    )
  }
}

/**
 * Create and start a Deployment controller
 */
export const createDeploymentController = (
  eventBus: EventBus,
  getState: () => ControllerState,
  options: ControllerResyncOptions = {}
): DeploymentController => {
  const controller = new DeploymentController(eventBus, getState, options)
  controller.start()
  return controller
}
