// ═══════════════════════════════════════════════════════════════════════════
// EMULATED ENVIRONMENT MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Manages emulated environment lifecycle: create, switch, destroy
// Handles memory cleanup and auto-save logic

import {
  createApiServerFacade,
  type ApiServerFacade
} from '../api/ApiServerFacade'
import {
  startControlPlaneRuntime,
  type ControlPlaneRuntime
} from '../control-plane/ControllerManager'
import { initializeSimPodIpAllocation } from '../cluster/ipAllocator/SimPodIpAllocationService'
import {
  createBootstrapKubeconfig,
  createSimulatorBootstrapConfig
} from '../cluster/systemBootstrap'
import { createFileSystem, type FileSystemState } from '../filesystem/FileSystem'
import { createHostFileSystem } from '../filesystem/debianFileSystem'
import { initializeSimNetworkRuntime } from '../network/SimNetworkRuntime'
import { initializeSimVolumeRuntime } from '../volumes/SimVolumeRuntime'
import { saveSandboxEnvironment } from '../storage/indexedDBAdapter'
import { ShellContextStack } from '../terminal/core/ShellContext'
import { CONFIG } from '../../config'
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

const KUBECONFIG_DIRECTORY = '/home/kube/.kube'
const KUBECONFIG_PATH = '/home/kube/.kube/config'

const ensureKubeconfigFile = (
  fileSystemState: FileSystemState,
  kubeconfigContent: string
): void => {
  const fileSystem = createFileSystem(fileSystemState, undefined, {
    mutable: true
  })
  const existingKubeconfig = fileSystem.readFile(KUBECONFIG_PATH)
  if (existingKubeconfig.ok) {
    return
  }
  const createDirectoryResult = fileSystem.createDirectory(
    KUBECONFIG_DIRECTORY,
    true
  )
  if (!createDirectoryResult.ok) {
    return
  }
  fileSystem.writeFile(KUBECONFIG_PATH, kubeconfigContent)
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

  let fileSystemState: FileSystemState
  let apiServer: ApiServerFacade
  let controlPlaneRuntime: ControlPlaneRuntime
  const storageMode: 'indexeddb' | 'none' =
    providedFilesystemState != null && userId != null ? 'indexeddb' : 'none'
  const bootstrapConfig = createSimulatorBootstrapConfig()
  const kubeconfigClusterName =
    bootstrapConfig.clusterName ?? CONFIG.cluster.simulatorClusterName
  fileSystemState =
    providedFilesystemState ??
    createHostFileSystem({
      kubeconfigContent: createBootstrapKubeconfig(kubeconfigClusterName)
    })
  ensureKubeconfigFile(
    fileSystemState,
    createBootstrapKubeconfig(kubeconfigClusterName)
  )
  apiServer = createApiServerFacade({
    bootstrap: bootstrapConfig
  })
  const eventBus = apiServer.getEventBus()

  const shellContextStack = new ShellContextStack(fileSystemState)
  const volumeRuntime = initializeSimVolumeRuntime(apiServer)
  const networkRuntime = initializeSimNetworkRuntime(apiServer)

  const resyncConfig = CONFIG.runtime.simRuntimeResyncIntervalMs
  controlPlaneRuntime = startControlPlaneRuntime(apiServer, {
    deployment: { resyncIntervalMs: resyncConfig.deployment },
    daemonSet: { resyncIntervalMs: resyncConfig.daemonSet },
    replicaSet: { resyncIntervalMs: resyncConfig.replicaSet },
    scheduler: {
      schedulingDelayRangeMs: CONFIG.runtime.simPodSchedulingDelayRangeMs,
      resyncIntervalMs: resyncConfig.scheduler
    },
    podLifecycle: {
      pendingDelayRangeMs: CONFIG.runtime.simPodPendingDelayRangeMs,
      completionDelayRangeMs: CONFIG.runtime.simPodCompletionDelayRangeMs,
      resyncIntervalMs: resyncConfig.podLifecycle,
      volumeReadinessProbe: (pod) => {
        return (
          volumeRuntime.state.getPodReadiness(
            pod.metadata.namespace,
            pod.metadata.name
          ) ?? { ready: true }
        )
      }
    }
  })

  // Keep pod IP allocation unique and stable across lifecycle events
  const unsubscribePodIpAllocation = initializeSimPodIpAllocation(apiServer)

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
          apiServer.snapshotState()
        )
        if (!result.ok) {
          throw new Error(`Failed to save environment: ${result.error}`)
        }
      }, autoSaveDelay)

      // Listen to all events and save to IndexedDB
      unsubscribeAutoSave = eventBus.subscribeAll(() => {
        saveToIndexedDB()
        if (onStateChange) {
          onStateChange()
        }
      })
    }
  }

  return {
    fileSystemState,
    apiServer,
    shellContextStack,
    unsubscribeAutoSave,
    unsubscribePodIpAllocation,
    controlPlaneRuntime,
    networkRuntime,
    volumeRuntime
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

  emulatedEnvironment.controlPlaneRuntime?.stop()
  emulatedEnvironment.controlPlaneRuntime = undefined
  emulatedEnvironment.networkRuntime?.controller.stop()
  emulatedEnvironment.volumeRuntime?.volumeBindingController.stop()
  emulatedEnvironment.volumeRuntime?.podVolumeController.stop()
  emulatedEnvironment.volumeRuntime = undefined
  emulatedEnvironment.apiServer.stop()

  // Note: We don't explicitly clean up clusterState, fileSystemState, eventBus, or shellContextStack
  // as they will be garbage collected when the emulated environment object is no longer referenced.
  // If these objects have cleanup methods in the future, call them here.
}
