import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { SimNetworkRuntime } from '../../../network/SimNetworkRuntime'
import { RESOURCE_ALIAS_MAP } from '../resources'
import type { ParsedCommand } from '../types'
import { executeRuntimeNetworkCommand } from './internal/runtimeCommand'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL EXEC HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Simulates command execution inside a container

const buildEnterContainerDirective = (
  podName: string,
  containerName: string,
  namespace: string
): string => {
  return `ENTER_CONTAINER:${namespace}:${podName}:${containerName}`
}

const buildShellCommandDirective = (
  podName: string,
  containerName: string,
  namespace: string,
  command: string
): string => {
  return `SHELL_COMMAND:${namespace}:${podName}:${containerName}:${encodeURIComponent(command)}`
}

const buildProcessCommandDirective = (
  processName: string,
  processAction: string,
  podName: string,
  containerName: string,
  namespace: string
): string => {
  return `PROCESS_COMMAND:${processName}:${processAction}:${namespace}:${podName}:${containerName}`
}

const pickPreferredPodName = (
  candidates: Array<{
    metadata: { name: string }
    status: { phase: string }
  }>
): string | undefined => {
  if (candidates.length === 0) {
    return undefined
  }
  const runningCandidates = candidates.filter((candidate) => {
    return candidate.status.phase === 'Running'
  })
  const pool = runningCandidates.length > 0 ? runningCandidates : candidates
  const sorted = [...pool].sort((left, right) => {
    return left.metadata.name.localeCompare(right.metadata.name)
  })
  return sorted[0]?.metadata.name
}

const resolvePodNameFromTarget = (
  apiServer: ApiServerFacade,
  namespace: string,
  target: string
): string => {
  if (!target.includes('/')) {
    return target
  }
  const [resourceToken, resourceName] = target.split('/', 2)
  if (resourceName == null || resourceName.length === 0) {
    return target
  }
  const canonicalResource = RESOURCE_ALIAS_MAP[resourceToken]
  if (canonicalResource === 'pods') {
    return resourceName
  }
  const state = apiServer.snapshotState()
  if (canonicalResource === 'deployments') {
    const replicaSetNames = new Set(
      state.replicaSets.items
        .filter((replicaSet) => {
          if (replicaSet.metadata.namespace !== namespace) {
            return false
          }
          const ownerReferences = replicaSet.metadata.ownerReferences ?? []
          return ownerReferences.some((ownerReference) => {
            return (
              ownerReference.kind === 'Deployment' &&
              ownerReference.name === resourceName
            )
          })
        })
        .map((replicaSet) => replicaSet.metadata.name)
    )
    const podCandidates = state.pods.items.filter((pod) => {
      if (pod.metadata.namespace !== namespace) {
        return false
      }
      const ownerReferences = pod.metadata.ownerReferences ?? []
      return ownerReferences.some((ownerReference) => {
        return (
          ownerReference.kind === 'ReplicaSet' &&
          replicaSetNames.has(ownerReference.name)
        )
      })
    })
    const resolvedByOwner = pickPreferredPodName(podCandidates)
    if (resolvedByOwner != null) {
      return resolvedByOwner
    }
    const resolvedByLabel = pickPreferredPodName(
      state.pods.items.filter((pod) => {
        if (pod.metadata.namespace !== namespace) {
          return false
        }
        return pod.metadata.labels?.app === resourceName
      })
    )
    return resolvedByLabel ?? target
  }
  if (canonicalResource === 'replicasets') {
    const podCandidates = state.pods.items.filter((pod) => {
      if (pod.metadata.namespace !== namespace) {
        return false
      }
      const ownerReferences = pod.metadata.ownerReferences ?? []
      return ownerReferences.some((ownerReference) => {
        return (
          ownerReference.kind === 'ReplicaSet' &&
          ownerReference.name === resourceName
        )
      })
    })
    return pickPreferredPodName(podCandidates) ?? target
  }
  return target
}

/**
 * Handle kubectl exec command
 * Simulates command execution in a pod container
 */
export const handleExec = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  networkRuntime?: SimNetworkRuntime
): string => {
  const state = apiServer.snapshotState()
  // Validate pod name is provided
  if (!parsed.name) {
    return 'Error: pod name is required'
  }

  // Validate command is provided
  if (!parsed.execCommand || parsed.execCommand.length === 0) {
    return 'Error: command must be specified after --'
  }

  const namespace = parsed.namespace || 'default'
  const podName = resolvePodNameFromTarget(apiServer, namespace, parsed.name)

  // Find the pod
  const pod = state.pods.items.find(
    (p) => p.metadata.name === podName && p.metadata.namespace === namespace
  )

  if (!pod) {
    return `Error from server (NotFound): pods "${podName}" not found`
  }

  // Check pod is running
  if (pod.status.phase !== 'Running') {
    return `Error: pod "${podName}" is not running (current phase: ${pod.status.phase})`
  }

  // Multi-container support: determine which container to use
  const regularContainers = pod.spec.containers
  const containerFlagValue = parsed.flags.c || parsed.flags.container

  let containerName: string

  if (containerFlagValue) {
    // Container specified via -c flag - validate it exists
    const targetContainer = regularContainers.find(
      (c) => c.name === containerFlagValue
    )

    if (!targetContainer) {
      const availableNames = regularContainers.map((c) => c.name).join(', ')
      return `Error: container ${containerFlagValue} not found in pod ${podName}. Available containers: ${availableNames}`
    }

    containerName = containerFlagValue as string
  } else if (regularContainers.length > 1) {
    // Multiple containers but no -c flag specified
    const containerNames = regularContainers.map((c) => c.name).join(', ')
    return `Error: a container name must be specified for pod ${podName}, choose one of: [${containerNames}]`
  } else if (regularContainers.length === 1) {
    // Single container - use it automatically
    containerName = regularContainers[0].name
  } else {
    return `Error: pod ${podName} has no containers`
  }

  // Execute command
  const command = parsed.execCommand[0]
  const args = parsed.execCommand

  // Shell commands - enter interactive mode
  if (
    command === 'sh' ||
    command === 'bash' ||
    command === '/bin/sh' ||
    command === '/bin/bash'
  ) {
    // This will be handled by the main dispatcher to enter container mode
    return buildEnterContainerDirective(podName, containerName, namespace)
  }

  const runtimeNetworkResult = executeRuntimeNetworkCommand(
    parsed.execCommand,
    namespace,
    networkRuntime
  )
  if (runtimeNetworkResult != null) {
    if (!runtimeNetworkResult.ok) {
      return runtimeNetworkResult.error
    }
    return runtimeNetworkResult.value
  }

  if (command === 'nginx') {
    if (parsed.execCommand[1] === '-s' && parsed.execCommand[2] === 'stop') {
      return buildProcessCommandDirective(
        'nginx',
        'stop',
        podName,
        containerName,
        namespace
      )
    }
  }
  if (command === 'kill' && parsed.execCommand[1] === '1') {
    return buildProcessCommandDirective(
      'pid1',
      'kill',
      podName,
      containerName,
      namespace
    )
  }

  // For all other commands, let the shell executor handle them
  // This will be processed by the main dispatcher
  const fullCommand = args.join(' ')
  return buildShellCommandDirective(
    podName,
    containerName,
    namespace,
    fullCommand
  )
}
