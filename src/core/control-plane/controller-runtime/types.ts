// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLER TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Shared types for all Kubernetes controllers

import type { DaemonSet } from '../../cluster/ressources/DaemonSet'
import type { Deployment } from '../../cluster/ressources/Deployment'
import type { Node } from '../../cluster/ressources/Node'
import type { PersistentVolume } from '../../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../../cluster/ressources/PersistentVolumeClaim'
import type { OwnerReference } from '../../cluster/ressources/Pod'
import type { Pod } from '../../cluster/ressources/Pod'
import type { ReplicaSet } from '../../cluster/ressources/ReplicaSet'

// ─── Kubernetes Resource with Owner References ───────────────────────────

/**
 * Base interface for resources that can have owners
 */
export interface OwnedResource {
  metadata: {
    name: string
    namespace: string
    ownerReferences?: OwnerReference[]
  }
}

/**
 * Base interface for resources that can own other resources
 */
export interface OwnerResource {
  metadata: {
    name: string
    namespace: string
  }
  kind: string
  apiVersion: string
}

// ─── Controller State Interface ──────────────────────────────────────────

/**
 * Unified state accessor for all controllers
 * Each controller uses the methods it needs from this interface
 */
export interface ControllerState {
  // Deployments
  getDeployments: (namespace?: string) => Deployment[]
  findDeployment: (
    name: string,
    namespace: string
  ) => { ok: boolean; value?: Deployment }

  // DaemonSets
  getDaemonSets: (namespace?: string) => DaemonSet[]
  findDaemonSet: (
    name: string,
    namespace: string
  ) => { ok: boolean; value?: DaemonSet }

  // ReplicaSets
  getReplicaSets: (namespace?: string) => ReplicaSet[]
  findReplicaSet: (
    name: string,
    namespace: string
  ) => { ok: boolean; value?: ReplicaSet }

  // Pods
  getPods: (namespace?: string) => Pod[]
  findPod: (name: string, namespace: string) => { ok: boolean; value?: Pod }

  // Nodes (used by Scheduler)
  getNodes: () => Node[]

  // Volumes
  getPersistentVolumes: () => PersistentVolume[]
  findPersistentVolume: (name: string) => {
    ok: boolean
    value?: PersistentVolume
  }
  getPersistentVolumeClaims: (namespace?: string) => PersistentVolumeClaim[]
  findPersistentVolumeClaim: (
    name: string,
    namespace: string
  ) => { ok: boolean; value?: PersistentVolumeClaim }
}

// ─── Controller Interface ────────────────────────────────────────────────

/**
 * Base interface for all controllers
 *
 * Controllers follow the Kubernetes reconciliation pattern:
 * - Events trigger enqueueing a key (namespace/name) to a work queue
 * - The reconcile() method is called asynchronously with each key
 * - reconcile() reads current state and converges to desired state
 */
export interface Controller {
  /** Start watching events and processing the work queue */
  start(): void
  /** Stop watching events and processing the work queue */
  stop(): void
  /** Reconcile a resource by key (namespace/name). Must be idempotent. */
  reconcile(key: string): void
}

export interface ReconcilerController extends Controller {
  /**
   * Queue all existing resources handled by this controller.
   * Called on startup to avoid missing resources created before subscriptions.
   */
  initialSync(): void
  /**
   * Re-enqueue all resources to recover from event loss or ordering races.
   */
  resyncAll(): void
}

export interface ControllerResyncOptions {
  resyncIntervalMs?: number
  observer?: ControllerObserver
}

export interface ControllerObservation {
  controller: string
  action: 'enqueue' | 'reconcile' | 'skip'
  key: string
  reason?: string
  eventType?: ClusterEventType
  timestamp: string
}

export type ControllerObserver = (observation: ControllerObservation) => void

// ─── Event Types for Controllers ─────────────────────────────────────────

export type ClusterEventType =
  | 'PodCreated'
  | 'PodDeleted'
  | 'PodUpdated'
  | 'ReplicaSetCreated'
  | 'ReplicaSetDeleted'
  | 'ReplicaSetUpdated'
  | 'DeploymentCreated'
  | 'DeploymentDeleted'
  | 'DeploymentUpdated'
  | 'DaemonSetCreated'
  | 'DaemonSetDeleted'
  | 'DaemonSetUpdated'
  | 'PersistentVolumeCreated'
  | 'PersistentVolumeDeleted'
  | 'PersistentVolumeUpdated'
  | 'PersistentVolumeClaimCreated'
  | 'PersistentVolumeClaimDeleted'
  | 'PersistentVolumeClaimUpdated'
