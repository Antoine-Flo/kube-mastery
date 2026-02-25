// ═══════════════════════════════════════════════════════════════════════════
// EMULATED ENVIRONMENT MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Manages emulated environment lifecycle: create, switch, destroy
// Handles memory cleanup and auto-save logic

import { createClusterState } from '../cluster/ClusterState'
import {
  initializeControllers,
  stopRuntimeControllers
} from '../cluster/controllers/initializers'
import { createEventBus, type EventBus } from '../cluster/events/EventBus'
import { initializeSimPodIpAllocation } from '../cluster/ipAllocator/SimPodIpAllocationService'
import type { AppEvent } from '../events/AppEvent'
import { createHostFileSystem } from '../filesystem/debianFileSystem'
import { initializeSimNetworkRuntime } from '../network/SimNetworkRuntime'
import { saveSandboxEnvironment } from '../storage/indexedDBAdapter'
import { ShellContextStack } from '../terminal/core/ShellContext'
import {
  getSimulatorBootstrapConfig,
  getRuntimeControllerResyncConfig,
  SIM_POD_PENDING_DELAY_RANGE_MS,
  SIM_POD_SCHEDULING_DELAY_RANGE_MS
} from '../../config/runtimeConfig'
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
    enableAutoSave = false,
    onStateChange,
    autoSaveDelay = 2000
  } = options

  let fileSystemState
  let eventBus: EventBus
  let clusterState
  let storageMode: 'indexeddb' | 'none' = 'none'
  const bootstrapConfig = getSimulatorBootstrapConfig()

  if (providedFilesystemState) {
    storageMode = userId ? 'indexeddb' : 'none'
    fileSystemState = providedFilesystemState
    eventBus = createEventBus()
    clusterState = createClusterState(eventBus, {
      bootstrap: bootstrapConfig
    })
  } else {
    storageMode = 'none'
    fileSystemState = createHostFileSystem()
    eventBus = createEventBus()
    clusterState = createClusterState(eventBus, {
      bootstrap: bootstrapConfig
    })
  }

  const shellContextStack = new ShellContextStack(fileSystemState)
  const networkRuntime = initializeSimNetworkRuntime(eventBus, clusterState)

  const resyncConfig = getRuntimeControllerResyncConfig()
  const controllers = initializeControllers(eventBus, clusterState, {
    deployment: { resyncIntervalMs: resyncConfig.deployment },
    daemonSet: { resyncIntervalMs: resyncConfig.daemonSet },
    replicaSet: { resyncIntervalMs: resyncConfig.replicaSet },
    scheduler: {
      schedulingDelayRangeMs: SIM_POD_SCHEDULING_DELAY_RANGE_MS,
      resyncIntervalMs: resyncConfig.scheduler
    },
    podLifecycle: {
      pendingDelayRangeMs: SIM_POD_PENDING_DELAY_RANGE_MS,
      resyncIntervalMs: resyncConfig.podLifecycle
    }
  })

  // Keep pod IP allocation unique and stable across lifecycle events
  const unsubscribePodIpAllocation = initializeSimPodIpAllocation(
    eventBus,
    clusterState
  )

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
    unsubscribePodIpAllocation,
    runtimeControllers: controllers,
    networkRuntime
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

  if (emulatedEnvironment.unsubscribePodIpAllocation) {
    emulatedEnvironment.unsubscribePodIpAllocation()
    emulatedEnvironment.unsubscribePodIpAllocation = undefined
  }

  stopRuntimeControllers(emulatedEnvironment.runtimeControllers)
  emulatedEnvironment.runtimeControllers = undefined
  emulatedEnvironment.networkRuntime?.controller.stop()
  emulatedEnvironment.networkRuntime = undefined

  // Note: We don't explicitly clean up clusterState, fileSystemState, eventBus, or shellContextStack
  // as they will be garbage collected when the emulated environment object is no longer referenced.
  // If these objects have cleanup methods in the future, call them here.
}
