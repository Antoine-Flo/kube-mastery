// ═══════════════════════════════════════════════════════════════════════════
// EMULATED ENVIRONMENT TYPES
// ═══════════════════════════════════════════════════════════════════════════
// An EmulatedEnvironment represents a complete environment: cluster state + filesystem
// This is what gets loaded into the terminal and needs to be managed.

import type { ClusterState } from '../cluster/ClusterState'
import type { RuntimeControllers } from '../cluster/controllers/initializers'
import type { EventBus } from '../cluster/events/EventBus'
import type { FileSystemState } from '../filesystem/FileSystem'
import { ShellContextStack } from '../terminal/core/ShellContext'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Represents a complete emulated environment (cluster + filesystem)
 * This is the unit of work that gets loaded into the terminal
 */
export interface EmulatedEnvironment {
  /** Emulated environment ID (always undefined now, kept for compatibility) */
  emulatedEnvironmentId: string | undefined

  /** Filesystem ID (always undefined now, kept for compatibility) */
  filesystemId: string | undefined

  /** Cluster ID (always undefined now, kept for compatibility) */
  clusterId: string | undefined

  /** Kubernetes cluster state */
  clusterState: ClusterState

  /** Filesystem state */
  fileSystemState: FileSystemState

  /** Event bus for cluster events */
  eventBus: EventBus

  /** Shell context stack for terminal navigation */
  shellContextStack: ShellContextStack

  /** Auto-save unsubscribe function (if auto-save is enabled) */
  unsubscribeAutoSave?: () => void

  /** Pod IP allocation unsubscribe function */
  unsubscribePodIpAllocation?: () => void

  /** Runtime controllers to stop on destroy */
  runtimeControllers?: RuntimeControllers
}

/**
 * Options for creating an emulated environment
 * Supports IndexedDB mode for persistence or no persistence
 */
export interface CreateEmulatedEnvironmentOptions {
  /** User ID for IndexedDB mode */
  userId?: string
  /** Filesystem state */
  filesystemState?: FileSystemState
  /** Enable auto-save (requires userId for IndexedDB) */
  enableAutoSave?: boolean
  /** Callback when state changes (for tracking dirty state) */
  onStateChange?: () => void
  /** Auto-save debounce delay in ms */
  autoSaveDelay?: number
}
