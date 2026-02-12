// ═══════════════════════════════════════════════════════════════════════════
// EMULATED ENVIRONMENT MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Manages emulated environment lifecycle: create, switch, destroy
// Handles memory cleanup and auto-save logic

import { createClusterState } from '../cluster/ClusterState'
import {
  initializeControllers,
  initializeScheduler
} from '../cluster/controllers/initializers'
import { createEventBus, type EventBus } from '../cluster/events/EventBus'
import { createPodStartupSimulator } from '../cluster/podStartupSimulator'
import type { AppEvent } from '../events/AppEvent'
import { createHostFileSystem } from '../filesystem/debianFileSystem'
import { saveSandboxEnvironment } from '../storage/indexedDBAdapter'
import { ShellContextStack } from '../terminal/core/ShellContext'
import type {
  CreateEmulatedEnvironmentOptions,
  EmulatedEnvironment
} from './EmulatedEnvironment'

// ═══════════════════════════════════════════════════════════════════════════
// DEBOUNCE HELPER
// ═══════════════════════════════════════════════════════════════════════════

const debounce = <T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMULATED ENVIRONMENT MANAGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new emulated environment from a record or in demo mode
 */
export function createEmulatedEnvironment(
  options: CreateEmulatedEnvironmentOptions = {}
): EmulatedEnvironment {
  const {
    userId,
    filesystemState: providedFilesystemState,
    clusterStateData: providedClusterStateData,
    enableAutoSave = false,
    onStateChange,
    autoSaveDelay = 2000
  } = options

  let fileSystemState
  let eventBus: EventBus
  let clusterState
  let storageMode: 'indexeddb' | 'none' = 'none'

  if (providedFilesystemState && providedClusterStateData) {
    // Mode with provided data (for lessons)
    storageMode = userId ? 'indexeddb' : 'none'
    fileSystemState = providedFilesystemState
    eventBus = createEventBus()
    clusterState = createClusterState(providedClusterStateData, eventBus)
  } else {
    storageMode = 'none'
    fileSystemState = createHostFileSystem()
    eventBus = createEventBus()
    clusterState = createClusterState(eventBus)
  }

  const shellContextStack = new ShellContextStack(fileSystemState)

  // Initialize controllers for Deployment -> ReplicaSet -> Pod lifecycle
  initializeControllers(eventBus, clusterState)

  // Initialize scheduler to assign pods to nodes
  initializeScheduler(eventBus, clusterState)

  // Transition Pending -> Running after random delay (kubelet-like)
  const podStartupSimulator = createPodStartupSimulator(
    eventBus,
    () => clusterState,
    { startupDelayMs: 1500 }
  )
  podStartupSimulator.start()

  // Setup auto-save if enabled
  let unsubscribeAutoSave: (() => void) | undefined

  if (enableAutoSave) {
    if (storageMode === 'indexeddb' && userId) {
      // Auto-save to IndexedDB
      const saveToIndexedDB = debounce(async () => {
        if (!userId) {
          return
        }

        const result = await saveSandboxEnvironment(
          userId,
          fileSystemState,
          clusterState.toJSON()
        )
        if (!result.ok) {
          throw new Error(`Failed to save environment: ${result.error}`)
        }
      }, autoSaveDelay)

      // Listen to all events and save to IndexedDB
      unsubscribeAutoSave = eventBus.subscribeAll((event: AppEvent) => {
        saveToIndexedDB()
        if (onStateChange) {
          onStateChange()
        }
      })
    }
  }

  return {
    emulatedEnvironmentId: undefined,
    filesystemId: undefined,
    clusterId: undefined,
    clusterState,
    fileSystemState,
    eventBus,
    shellContextStack,
    unsubscribeAutoSave,
    podStartupSimulator
  }
}

/**
 * Destroy an emulated environment and clean up all resources
 * This should be called before switching environments or on unmount
 */
export function destroyEmulatedEnvironment(
  emulatedEnvironment: EmulatedEnvironment
): void {
  // Unsubscribe from auto-save
  if (emulatedEnvironment.unsubscribeAutoSave) {
    emulatedEnvironment.unsubscribeAutoSave()
    emulatedEnvironment.unsubscribeAutoSave = undefined
  }

  // Stop pod startup simulator (clears pending timeouts)
  if (emulatedEnvironment.podStartupSimulator) {
    emulatedEnvironment.podStartupSimulator.stop()
    emulatedEnvironment.podStartupSimulator = undefined
  }

  // Note: We don't explicitly clean up clusterState, fileSystemState, eventBus, or shellContextStack
  // as they will be garbage collected when the emulated environment object is no longer referenced.
  // If these objects have cleanup methods in the future, call them here.
}
