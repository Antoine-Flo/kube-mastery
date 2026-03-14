// ═══════════════════════════════════════════════════════════════════════════
// EMULATED ENVIRONMENT TYPES
// ═══════════════════════════════════════════════════════════════════════════
// An EmulatedEnvironment represents a complete environment: cluster state + filesystem
// This is what gets loaded into the terminal and needs to be managed.

import type { ApiServerFacade } from '../api/ApiServerFacade'
import type { ControlPlaneRuntime } from '../control-plane/ControllerManager'
import type { FileSystemState } from '../filesystem/FileSystem'
import type { SimNetworkRuntime } from '../network/SimNetworkRuntime'
import type { SimVolumeRuntime } from '../volumes/SimVolumeRuntime'
import { ShellContextStack } from '../terminal/core/ShellContext'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Represents a complete emulated environment (cluster + filesystem)
 * This is the unit of work that gets loaded into the terminal
 */
export interface EmulatedEnvironment {
  /** Filesystem state */
  fileSystemState: FileSystemState

  /** API facade (apiserver + watch + store) */
  apiServer: ApiServerFacade

  /** Shell context stack for terminal navigation */
  shellContextStack: ShellContextStack

  /** Auto-save unsubscribe function (if auto-save is enabled) */
  unsubscribeAutoSave?: () => void

  /** Pod IP allocation unsubscribe function */
  unsubscribePodIpAllocation?: () => void

  /** Control-plane runtime to stop on destroy */
  controlPlaneRuntime?: ControlPlaneRuntime

  /** Simulated network runtime */
  networkRuntime?: SimNetworkRuntime

  /** Simulated volumes runtime */
  volumeRuntime?: SimVolumeRuntime
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
