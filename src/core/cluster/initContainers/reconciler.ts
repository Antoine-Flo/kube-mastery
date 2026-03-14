// ═══════════════════════════════════════════════════════════════════════════
// INIT CONTAINER RECONCILER
// ═══════════════════════════════════════════════════════════════════════════
// Orchestrates init container execution in sequential order
// Pure function that processes all init containers and updates pod state

import type { Pod } from '../ressources/Pod'
import { executeInitContainer } from './executor'
import { createImageRegistry } from '../../containers/registry/ImageRegistry'

// ─── Helper Functions ────────────────────────────────────────────────────

/**
 * Check if image is valid in registry
 */
const isImageValid = (image: string): boolean => {
  const registry = createImageRegistry()
  const result = registry.validateImage(image)
  return result.ok
}

/**
 * Update container status in pod
 */
const updateContainerStatus = (
  pod: Pod,
  containerName: string,
  updates: {
    stateDetails?: {
      state: 'Waiting' | 'Running' | 'Terminated'
      reason?: string
      exitCode?: number
      startedAt?: string
      finishedAt?: string
    }
    ready?: boolean
    started?: boolean
    startedAt?: string
    lastStateDetails?: {
      state: 'Waiting' | 'Running' | 'Terminated'
      reason?: string
      exitCode?: number
      startedAt?: string
      finishedAt?: string
    }
  }
): Pod => {
  const updatedStatuses = pod.status.containerStatuses?.map((cs) => {
    if (cs.name === containerName) {
      return {
        ...cs,
        ...updates
      }
    }
    return cs
  })

  return {
    ...pod,
    status: {
      ...pod.status,
      containerStatuses: updatedStatuses
    }
  }
}

/**
 * Update pod phase
 */
const updatePodPhase = (
  pod: Pod,
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown'
): Pod => {
  return {
    ...pod,
    status: {
      ...pod.status,
      phase
    }
  }
}

/**
 * Mark all regular containers as Running
 */
const startRegularContainers = (pod: Pod): Pod => {
  let updatedPod = pod
  const startedAt = new Date().toISOString()

  // Find regular containers from _simulator
  const regularContainerNames = Object.entries(pod._simulator.containers)
    .filter(([_, container]) => container.containerType === 'regular')
    .map(([name]) => name)

  for (const containerName of regularContainerNames) {
    const currentStatus = updatedPod.status.containerStatuses?.find(
      (status) => {
        return status.name === containerName
      }
    )
    updatedPod = updateContainerStatus(updatedPod, containerName, {
      stateDetails: {
        state: 'Running',
        startedAt
      },
      ready: true,
      started: true,
      startedAt,
      lastStateDetails:
        currentStatus?.stateDetails ??
        {
          state: 'Waiting',
          reason: 'ContainerCreating'
        }
    })
  }

  return updatedPod
}

// ─── Main Reconciler ─────────────────────────────────────────────────────

/**
 * Reconcile init containers and return updated pod
 * Processes init containers sequentially, stopping on first failure
 */
export const reconcileInitContainers = (pod: Pod): Pod => {
  // No init containers - just start regular containers
  if (!pod.spec.initContainers || pod.spec.initContainers.length === 0) {
    const updatedPod = startRegularContainers(pod)
    return updatePodPhase(updatedPod, 'Running')
  }

  let currentPod = pod

  // Process each init container sequentially
  for (const initContainer of pod.spec.initContainers) {
    // Validate image
    if (!isImageValid(initContainer.image)) {
      const finishedAt = new Date().toISOString()
      // Mark init container as Terminated (failed)
      currentPod = updateContainerStatus(currentPod, initContainer.name, {
        stateDetails: {
          state: 'Terminated',
          reason: 'ImagePullBackOff',
          exitCode: 1,
          finishedAt
        },
        started: false
      })

      // Mark pod as Failed
      return updatePodPhase(currentPod, 'Failed')
    }

    // Get current filesystem for this init container from _simulator
    const containerSimulator =
      currentPod._simulator.containers[initContainer.name]
    if (!containerSimulator) {
      // Should not happen, but handle gracefully
      return updatePodPhase(currentPod, 'Failed')
    }

    // Execute init container
    const result = executeInitContainer(
      initContainer,
      containerSimulator.fileSystem
    )

    if (!result.ok) {
      const finishedAt = new Date().toISOString()
      // Execution failed - mark as Terminated and fail pod
      currentPod = updateContainerStatus(currentPod, initContainer.name, {
        stateDetails: {
          state: 'Terminated',
          reason: 'InitContainerFailed',
          exitCode: 1,
          finishedAt
        },
        started: false
      })

      return updatePodPhase(currentPod, 'Failed')
    }

    // Success - update filesystem in _simulator and mark as Terminated (success)
    const finishedAt = new Date().toISOString()
    currentPod = {
      ...updateContainerStatus(currentPod, initContainer.name, {
        stateDetails: {
          state: 'Terminated',
          reason: 'Completed',
          exitCode: 0,
          finishedAt
        },
        started: false
      }),
      _simulator: {
        ...currentPod._simulator,
        containers: {
          ...currentPod._simulator.containers,
          [initContainer.name]: {
            ...containerSimulator,
            fileSystem: result.value
          }
        }
      }
    }
  }

  // All init containers succeeded - start regular containers
  currentPod = startRegularContainers(currentPod)

  return updatePodPhase(currentPod, 'Running')
}
