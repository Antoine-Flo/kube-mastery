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

import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { EventBus } from '../../cluster/events/EventBus'
import { createDeploymentScaledEvent } from '../../cluster/events/types'
import type { ClusterEvent } from '../../cluster/events/types'
import type {
  Deployment,
  DeploymentStatus
} from '../../cluster/ressources/Deployment'
import { generateTemplateHash } from '../../cluster/ressources/Deployment'
import type { ReplicaSet } from '../../cluster/ressources/ReplicaSet'
import { createReplicaSet } from '../../cluster/ressources/ReplicaSet'
import {
  createOwnerRef,
  findOwnerByRef,
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

// ─── Constants ────────────────────────────────────────────────────────────

const WATCHED_EVENTS: ClusterEventType[] = [
  'DeploymentCreated',
  'DeploymentUpdated',
  'DeploymentDeleted',
  'ReplicaSetUpdated'
]

const DEPLOYMENT_REVISION_ANNOTATION = 'deployment.kubernetes.io/revision'

const DEFAULT_ROLLING_MAX_SURGE = '25%'
const DEFAULT_ROLLING_MAX_UNAVAILABLE = '25%'

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

const parseRevision = (value: string | undefined): number => {
  if (value == null) {
    return 0
  }
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

const computeNextRevision = (replicaSets: ReplicaSet[]): number => {
  let maxRevision = 0
  for (const replicaSet of replicaSets) {
    const revision = parseRevision(
      replicaSet.metadata.annotations?.[DEPLOYMENT_REVISION_ANNOTATION]
    )
    if (revision > maxRevision) {
      maxRevision = revision
    }
  }
  return maxRevision + 1
}

const sumReplicaSetReplicas = (replicaSets: ReplicaSet[]): number => {
  let total = 0
  for (const replicaSet of replicaSets) {
    total += replicaSet.spec.replicas ?? 0
  }
  return total
}

const sumReplicaSetAvailableReplicas = (replicaSets: ReplicaSet[]): number => {
  let total = 0
  for (const replicaSet of replicaSets) {
    total += replicaSet.status.availableReplicas ?? 0
  }
  return total
}

const sumReplicaSetUnavailableReplicas = (replicaSets: ReplicaSet[]): number => {
  let total = 0
  for (const replicaSet of replicaSets) {
    const statusReplicas = replicaSet.status.replicas ?? 0
    const availableReplicas = replicaSet.status.availableReplicas ?? 0
    total += Math.max(0, statusReplicas - availableReplicas)
  }
  return total
}

const parseIntOrPercent = (
  value: number | string | undefined,
  desiredReplicas: number,
  roundUp: boolean
): number => {
  if (typeof value === 'number') {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === 'string' && value.endsWith('%')) {
    const percent = Number.parseInt(value.slice(0, -1), 10)
    if (Number.isNaN(percent) || percent < 0) {
      return 0
    }
    const raw = (desiredReplicas * percent) / 100
    return roundUp ? Math.ceil(raw) : Math.floor(raw)
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed
    }
  }
  return 0
}

const resolveRollingUpdateLimits = (
  deploy: Deployment
): { maxSurge: number; maxUnavailable: number } => {
  const desiredReplicas = deploy.spec.replicas ?? 1
  const strategy = deploy.spec.strategy
  const maxSurgeValue =
    strategy?.rollingUpdate?.maxSurge ?? DEFAULT_ROLLING_MAX_SURGE
  const maxUnavailableValue =
    strategy?.rollingUpdate?.maxUnavailable ?? DEFAULT_ROLLING_MAX_UNAVAILABLE
  let maxSurge = parseIntOrPercent(maxSurgeValue, desiredReplicas, true)
  let maxUnavailable = parseIntOrPercent(
    maxUnavailableValue,
    desiredReplicas,
    false
  )

  if (maxSurge === 0 && maxUnavailable === 0 && desiredReplicas > 0) {
    maxSurge = 1
  }
  if (maxUnavailable > desiredReplicas) {
    maxUnavailable = desiredReplicas
  }

  return { maxSurge, maxUnavailable }
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
    annotations: deploy.metadata.annotations,
    ownerReferences: [createOwnerRef(deploy)]
  })
}

/**
 * Compute Deployment status from owned ReplicaSets
 */
const computeDeploymentStatus = (
  deployment: Deployment,
  ownedReplicaSets: ReplicaSet[],
  currentReplicaSet: ReplicaSet | undefined
): DeploymentStatus => {
  const desiredReplicas = deployment.spec.replicas ?? 1
  let totalReplicas = 0
  let readyReplicas = 0
  let availableReplicas = 0
  const updatedReplicas = currentReplicaSet?.status.replicas ?? 0

  for (const rs of ownedReplicaSets) {
    totalReplicas += rs.status.replicas || 0
    readyReplicas += rs.status.readyReplicas || 0
    availableReplicas += rs.status.availableReplicas || 0
  }

  const now = new Date().toISOString()
  const progressingConditionStatus: 'True' = 'True'
  const progressingReason =
    updatedReplicas < desiredReplicas
      ? 'ReplicaSetUpdating'
      : 'NewReplicaSetAvailable'
  const progressingMessage =
    updatedReplicas < desiredReplicas
      ? 'ReplicaSet is updating replicas.'
      : `ReplicaSet "${currentReplicaSet?.metadata.name ?? deployment.metadata.name}" has successfully progressed.`
  const availableConditionStatus =
    availableReplicas >= desiredReplicas ? 'True' : 'False'
  const availableReason =
    availableReplicas >= desiredReplicas
      ? 'MinimumReplicasAvailable'
      : 'MinimumReplicasUnavailable'
  const availableMessage =
    availableReplicas >= desiredReplicas
      ? 'Deployment has minimum availability.'
      : 'Deployment does not have minimum availability.'

  return {
    observedGeneration: deployment.metadata.generation ?? 1,
    replicas: totalReplicas,
    readyReplicas,
    availableReplicas,
    updatedReplicas,
    conditions: [
      {
        type: 'Progressing',
        status: progressingConditionStatus,
        reason: progressingReason,
        message: progressingMessage,
        lastTransitionTime: now,
        lastUpdateTime: now
      },
      {
        type: 'Available',
        status: availableConditionStatus,
        reason: availableReason,
        message: availableMessage,
        lastTransitionTime: now,
        lastUpdateTime: now
      }
    ]
  }
}

// ─── Controller ───────────────────────────────────────────────────────────

/**
 * Deployment Controller
 * Manages ReplicaSets for each Deployment
 */
export class DeploymentController implements ReconcilerController {
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
        this.enqueueDeployment(event.payload.deployment, event.type)
        break

      case 'DeploymentDeleted':
        // For deletion, we need to clean up owned ReplicaSets
        this.handleDeploymentDeleted(event.payload.deletedDeployment)
        break

      case 'ReplicaSetUpdated':
        // Find and enqueue the owning Deployment
        this.enqueueOwnerDeployment(event.payload.replicaSet, event.type)
        break
    }
  }

  /**
   * Enqueue a Deployment for reconciliation
   */
  private enqueueDeployment(
    deploy: Deployment,
    eventType?: ClusterEventType,
    reason?: string
  ): void {
    const key = makeKey(deploy.metadata.namespace, deploy.metadata.name)
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
    const deployments = state.getDeployments()
    for (const deployment of deployments) {
      this.enqueueDeployment(deployment, undefined, 'InitialSync')
    }
  }

  resyncAll(): void {
    this.initialSync()
  }

  /**
   * Find and enqueue the Deployment that owns this ReplicaSet
   */
  private enqueueOwnerDeployment(
    rs: ReplicaSet,
    eventType?: ClusterEventType
  ): void {
    const state = this.getState()
    const ownerDeploy = findOwnerByRef(rs, 'Deployment', () =>
      state.getDeployments(rs.metadata.namespace)
    )

    if (ownerDeploy) {
      this.enqueueDeployment(ownerDeploy, eventType, 'OwnerReference')
    } else {
      this.observe({
        action: 'skip',
        key: makeKey(rs.metadata.namespace, rs.metadata.name),
        eventType,
        reason: 'OwnerMissing'
      })
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
      this.apiServer.deleteResource(
        'ReplicaSet',
        rs.metadata.name,
        rs.metadata.namespace
      )
    }
  }

  /**
   * Reconcile a Deployment by key
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

    const deployResult = state.findDeployment(name, namespace)
    if (!deployResult.ok || !deployResult.value) {
      this.observe({
        action: 'skip',
        key,
        reason: 'NotFound'
      })
      return
    }

    const deploy = deployResult.value
    const ownedReplicaSets = getOwnedResources(
      deploy,
      state.getReplicaSets(namespace)
    )
    const currentRs = this.findCurrentReplicaSet(deploy, ownedReplicaSets)
    let deploymentForStatus = deploy

    if (currentRs) {
      const oldReplicaSets = ownedReplicaSets.filter((replicaSet) => {
        return replicaSet.metadata.name !== currentRs.metadata.name
      })
      this.reconcileExistingReplicaSet(deploy, currentRs, oldReplicaSets)
      deploymentForStatus = this.syncDeploymentRevisionAnnotation(
        deploy,
        currentRs,
        ownedReplicaSets
      )
    } else {
      this.createNewReplicaSet(deploy, ownedReplicaSets)
    }

    this.updateDeploymentStatus(deploymentForStatus, namespace)
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
    const nextRevision = computeNextRevision(oldReplicaSets)
    const nextRevisionAnnotationValue = String(nextRevision)
    const deploymentWithRevision: Deployment = {
      ...deploy,
      metadata: {
        ...deploy.metadata,
        annotations: {
          ...(deploy.metadata.annotations ?? {}),
          [DEPLOYMENT_REVISION_ANNOTATION]: nextRevisionAnnotationValue
        }
      }
    }
    const isInitialDeployment = oldReplicaSets.length === 0
    const desiredReplicas = deploy.spec.replicas ?? 1
    const rollingLimits = resolveRollingUpdateLimits(deploy)
    const oldReplicasTotal = sumReplicaSetReplicas(oldReplicaSets)
    const maxTotalReplicas = desiredReplicas + rollingLimits.maxSurge
    const initialRollingReplicas = Math.max(0, maxTotalReplicas - oldReplicasTotal)
    const initialReplicas = isInitialDeployment
      ? desiredReplicas
      : Math.min(desiredReplicas, initialRollingReplicas)

    const newRsBase = createReplicaSetFromDeployment(deploymentWithRevision)
    const newRs: ReplicaSet = {
      ...newRsBase,
      spec: {
        ...newRsBase.spec,
        replicas: initialReplicas
      },
      metadata: {
        ...newRsBase.metadata,
        annotations: {
          ...(newRsBase.metadata.annotations ?? {}),
          [DEPLOYMENT_REVISION_ANNOTATION]: nextRevisionAnnotationValue
        }
      }
    }
    this.apiServer.createResource('ReplicaSet', newRs, newRs.metadata.namespace)
    this.emitScalingReplicaSetEvent(
      deploy.metadata.namespace,
      deploy.metadata.name,
      newRs.metadata.name,
      0,
      initialReplicas
    )
    this.apiServer.updateResource(
      'Deployment',
      deploy.metadata.name,
      deploymentWithRevision,
      deploy.metadata.namespace
    )
    if (oldReplicaSets.length > 0) {
      this.enqueueDeployment(deploy, undefined, 'RollingUpdateProgress')
    }
  }

  /**
   * Scale down all ReplicaSets to 0
   */
  private scaleDownReplicaSets(
    deploy: Deployment,
    replicaSets: ReplicaSet[]
  ): void {
    for (const rs of replicaSets) {
      if (rs.spec.replicas === 0) {
        continue
      }

      const scaledDownRs: ReplicaSet = {
        ...rs,
        spec: { ...rs.spec, replicas: 0 }
      }
      this.apiServer.updateResource(
        'ReplicaSet',
        rs.metadata.name,
        scaledDownRs,
        rs.metadata.namespace
      )
      this.emitScalingReplicaSetEvent(
        deploy.metadata.namespace,
        deploy.metadata.name,
        rs.metadata.name,
        rs.spec.replicas ?? 0,
        0
      )
    }
  }

  /**
   * Sync Deployment revision annotation with the active ReplicaSet revision.
   */
  private syncDeploymentRevisionAnnotation(
    deploy: Deployment,
    currentRs: ReplicaSet,
    ownedReplicaSets: ReplicaSet[]
  ): Deployment {
    const currentRevision =
      currentRs.metadata.annotations?.[DEPLOYMENT_REVISION_ANNOTATION]
    const deploymentRevision =
      deploy.metadata.annotations?.[DEPLOYMENT_REVISION_ANNOTATION]
    const currentRevisionNumber = parseRevision(currentRevision)
    const deploymentRevisionNumber = parseRevision(deploymentRevision)
    let highestRevision = deploymentRevisionNumber
    for (const replicaSet of ownedReplicaSets) {
      const replicaSetRevision = parseRevision(
        replicaSet.metadata.annotations?.[DEPLOYMENT_REVISION_ANNOTATION]
      )
      if (replicaSetRevision > highestRevision) {
        highestRevision = replicaSetRevision
      }
    }

    const shouldPromoteRevision = currentRevisionNumber < highestRevision
    const targetRevision = shouldPromoteRevision
      ? String(highestRevision + 1)
      : currentRevision

    const nextReplicaSetAnnotations = {
      ...(currentRs.metadata.annotations ?? {}),
      ...(targetRevision != null && {
        [DEPLOYMENT_REVISION_ANNOTATION]: targetRevision
      })
    }
    const replicaSetNeedsUpdate =
      (targetRevision != null &&
        currentRs.metadata.annotations?.[DEPLOYMENT_REVISION_ANNOTATION] !==
          targetRevision)
    if (replicaSetNeedsUpdate) {
      const updatedCurrentReplicaSet: ReplicaSet = {
        ...currentRs,
        metadata: {
          ...currentRs.metadata,
          annotations: nextReplicaSetAnnotations
        }
      }
      this.apiServer.updateResource(
        'ReplicaSet',
        currentRs.metadata.name,
        updatedCurrentReplicaSet,
        currentRs.metadata.namespace
      )
    }

    const deploymentTargetRevision = targetRevision ?? currentRevision
    if (
      deploymentTargetRevision == null ||
      deploymentTargetRevision === deploymentRevision
    ) {
      return deploy
    }

    const updatedDeployment: Deployment = {
      ...deploy,
      metadata: {
        ...deploy.metadata,
        annotations: {
          ...(deploy.metadata.annotations ?? {}),
          [DEPLOYMENT_REVISION_ANNOTATION]: deploymentTargetRevision
        }
      }
    }
    this.apiServer.updateResource(
      'Deployment',
      deploy.metadata.name,
      updatedDeployment,
      deploy.metadata.namespace
    )
    return updatedDeployment
  }

  /**
   * Update ReplicaSet replicas if needed
   */
  private reconcileExistingReplicaSet(
    deploy: Deployment,
    currentRs: ReplicaSet,
    oldReplicaSets: ReplicaSet[]
  ): void {
    const strategyType = deploy.spec.strategy?.type ?? 'RollingUpdate'
    if (strategyType === 'Recreate') {
      this.reconcileRecreateStrategy(deploy, currentRs, oldReplicaSets)
      return
    }

    this.reconcileRollingUpdateStrategy(deploy, currentRs, oldReplicaSets)
  }

  private reconcileRecreateStrategy(
    deploy: Deployment,
    currentRs: ReplicaSet,
    oldReplicaSets: ReplicaSet[]
  ): void {
    const desiredReplicas = deploy.spec.replicas ?? 1
    const oldReplicasTotal = sumReplicaSetReplicas(oldReplicaSets)
    if (oldReplicasTotal > 0) {
      this.scaleDownReplicaSets(deploy, oldReplicaSets)
      this.enqueueDeployment(deploy, undefined, 'RecreateScaleDown')
      return
    }

    if (currentRs.spec.replicas === desiredReplicas) {
      return
    }

    const scaledCurrentReplicaSet: ReplicaSet = {
      ...currentRs,
      spec: { ...currentRs.spec, replicas: desiredReplicas }
    }
    this.apiServer.updateResource(
      'ReplicaSet',
      currentRs.metadata.name,
      scaledCurrentReplicaSet,
      currentRs.metadata.namespace
    )
    this.emitScalingReplicaSetEvent(
      deploy.metadata.namespace,
      deploy.metadata.name,
      currentRs.metadata.name,
      currentRs.spec.replicas ?? 0,
      desiredReplicas
    )
  }

  private reconcileRollingUpdateStrategy(
    deploy: Deployment,
    currentRs: ReplicaSet,
    oldReplicaSets: ReplicaSet[]
  ): void {
    const desiredReplicas = deploy.spec.replicas ?? 1
    const rollingLimits = resolveRollingUpdateLimits(deploy)
    const oldReplicasTotal = sumReplicaSetReplicas(oldReplicaSets)
    const currentReplicas = currentRs.spec.replicas ?? 0
    const totalReplicas = oldReplicasTotal + currentReplicas
    const maxTotalReplicas = desiredReplicas + rollingLimits.maxSurge
    const minAvailableReplicas = Math.max(
      0,
      desiredReplicas - rollingLimits.maxUnavailable
    )
    const oldAvailableReplicas = sumReplicaSetAvailableReplicas(oldReplicaSets)
    const oldUnavailableReplicas =
      sumReplicaSetUnavailableReplicas(oldReplicaSets)
    const currentAvailableReplicas = currentRs.status.availableReplicas ?? 0
    const totalAvailableReplicas =
      oldAvailableReplicas + currentAvailableReplicas

    const scaleUpCapacity = Math.max(0, maxTotalReplicas - totalReplicas)
    const scaleUpDelta = Math.min(
      Math.max(0, desiredReplicas - currentReplicas),
      scaleUpCapacity
    )
    const targetCurrentReplicas = currentReplicas + scaleUpDelta
    const canScaleDownOldReplicaSets =
      currentAvailableReplicas >= targetCurrentReplicas
    if (targetCurrentReplicas !== currentReplicas) {
      const scaledCurrentReplicaSet: ReplicaSet = {
        ...currentRs,
        spec: { ...currentRs.spec, replicas: targetCurrentReplicas }
      }
      this.apiServer.updateResource(
        'ReplicaSet',
        currentRs.metadata.name,
        scaledCurrentReplicaSet,
        currentRs.metadata.namespace
      )
      this.emitScalingReplicaSetEvent(
        deploy.metadata.namespace,
        deploy.metadata.name,
        currentRs.metadata.name,
        currentReplicas,
        targetCurrentReplicas
      )
    }

    const totalAfterScaleUp = oldReplicasTotal + targetCurrentReplicas
    const maxScaleDownByReplicaBudget = Math.max(
      0,
      totalAfterScaleUp - minAvailableReplicas
    )
    const maxScaleDownByAvailability = Math.max(
      0,
      totalAvailableReplicas - minAvailableReplicas
    )
    const maxScaleDownRespectingAvailability = Math.min(
      maxScaleDownByReplicaBudget,
      maxScaleDownByAvailability
    )
    const maxScaleDown = Math.min(
      oldReplicasTotal,
      Math.max(maxScaleDownRespectingAvailability, oldUnavailableReplicas)
    )
    const targetOldTotalReplicas = Math.max(0, oldReplicasTotal - maxScaleDown)
    const canScaleDownUnavailableReplicaSets = oldUnavailableReplicas > 0
    if (
      (canScaleDownOldReplicaSets || canScaleDownUnavailableReplicaSets) &&
      targetOldTotalReplicas < oldReplicasTotal
    ) {
      this.scaleDownReplicaSetsToTotal(
        deploy,
        oldReplicaSets,
        targetOldTotalReplicas
      )
    }

    const hasPendingProgress =
      targetCurrentReplicas < desiredReplicas || targetOldTotalReplicas > 0
    if (hasPendingProgress) {
      this.enqueueDeployment(deploy, undefined, 'RollingUpdateProgress')
    }
  }

  private scaleDownReplicaSetsToTotal(
    deploy: Deployment,
    replicaSets: ReplicaSet[],
    targetTotalReplicas: number
  ): void {
    const sortedReplicaSets = [...replicaSets].sort((left, right) => {
      const leftRevision = parseRevision(
        left.metadata.annotations?.[DEPLOYMENT_REVISION_ANNOTATION]
      )
      const rightRevision = parseRevision(
        right.metadata.annotations?.[DEPLOYMENT_REVISION_ANNOTATION]
      )
      return rightRevision - leftRevision
    })

    let remainingReplicas = sumReplicaSetReplicas(sortedReplicaSets)
    for (const replicaSet of sortedReplicaSets) {
      if (remainingReplicas <= targetTotalReplicas) {
        break
      }
      const replicaSetReplicas = replicaSet.spec.replicas ?? 0
      if (replicaSetReplicas === 0) {
        continue
      }

      const removableReplicas = Math.min(
        replicaSetReplicas,
        remainingReplicas - targetTotalReplicas
      )
      const targetReplicas = replicaSetReplicas - removableReplicas
      const scaledDownReplicaSet: ReplicaSet = {
        ...replicaSet,
        spec: { ...replicaSet.spec, replicas: targetReplicas }
      }
      this.apiServer.updateResource(
        'ReplicaSet',
        replicaSet.metadata.name,
        scaledDownReplicaSet,
        replicaSet.metadata.namespace
      )
      this.emitScalingReplicaSetEvent(
        deploy.metadata.namespace,
        deploy.metadata.name,
        replicaSet.metadata.name,
        replicaSetReplicas,
        targetReplicas
      )
      remainingReplicas -= removableReplicas
    }
  }

  private emitScalingReplicaSetEvent(
    namespace: string,
    deploymentName: string,
    replicaSetName: string,
    fromReplicas: number,
    toReplicas: number
  ): void {
    if (fromReplicas === toReplicas) {
      return
    }
    this.apiServer.emitEvent(
      createDeploymentScaledEvent(
        namespace,
        deploymentName,
        replicaSetName,
        fromReplicas,
        toReplicas,
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
    const currentReplicaSet = this.findCurrentReplicaSet(
      deploy,
      ownedReplicaSets
    )
    const newStatus = computeDeploymentStatus(
      deploy,
      ownedReplicaSets,
      currentReplicaSet
    )

    if (
      statusEquals(deploy.status, newStatus, [
        'observedGeneration',
        'replicas',
        'readyReplicas',
        'availableReplicas',
        'updatedReplicas'
      ])
    ) {
      this.observe({
        action: 'skip',
        key: makeKey(deploy.metadata.namespace, deploy.metadata.name),
        reason: 'NoStatusChange'
      })
      return
    }

    const updatedDeploy: Deployment = {
      ...deploy,
      status: newStatus
    }
    this.apiServer.updateResource(
      'Deployment',
      deploy.metadata.name,
      updatedDeploy,
      deploy.metadata.namespace
    )
  }

  private observe(input: {
    action: 'enqueue' | 'reconcile' | 'skip'
    key: string
    reason?: string
    eventType?: ClusterEventType
  }): void {
    reportControllerObservation(this.options, {
      controller: 'DeploymentController',
      action: input.action,
      key: input.key,
      reason: input.reason,
      eventType: input.eventType
    })
  }
}

/**
 * Create and start a Deployment controller
 */
export const createDeploymentController = (
  apiServer: ApiServerFacade,
  options: ControllerResyncOptions = {}
): DeploymentController => {
  const controller = new DeploymentController(apiServer, options)
  controller.start()
  return controller
}
