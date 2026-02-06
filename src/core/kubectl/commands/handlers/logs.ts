import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { ParsedCommand } from '../types'
import { generateLogs } from '../../../cluster/logGenerator'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL LOGS HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Retrieves and displays pod logs with support for --tail and --follow flags

const DEFAULT_LOG_COUNT = 50

/**
 * Handle kubectl logs command
 * Supports:
 * - kubectl logs <pod>
 * - kubectl logs <pod> -n <namespace>
 * - kubectl logs <pod> --tail=20
 * - kubectl logs <pod> -f/--follow
 */
export const handleLogs = (state: ClusterStateData, parsed: ParsedCommand): string => {
  // Validate pod name is provided
  if (!parsed.name) {
    return 'Error: pod name is required'
  }

  const namespace = parsed.namespace || 'default'
  const podName = parsed.name

  // Find the pod
  const pod = state.pods.items.find((p) => p.metadata.name === podName && p.metadata.namespace === namespace)

  if (!pod) {
    return `Error from server (NotFound): pods "${podName}" not found`
  }

  // Multi-container support: determine which container to use
  const regularContainers = pod.spec.containers
  const containerName = parsed.flags.c || parsed.flags.container

  let targetContainer

  if (containerName) {
    // Container specified via -c flag
    // Check both init and regular containers
    const allContainers = [...(pod.spec.initContainers || []), ...regularContainers]
    targetContainer = allContainers.find((c) => c.name === containerName)

    if (!targetContainer) {
      const availableNames = allContainers.map((c) => c.name).join(', ')
      return `Error: container ${containerName} not found in pod ${podName}. Available containers: ${availableNames}`
    }
  } else if (regularContainers.length > 1) {
    // Multiple containers but no -c flag specified
    const containerNames = regularContainers.map((c) => c.name).join(', ')
    return `Error: a container name must be specified for pod ${podName}, choose one of: [${containerNames}]`
  } else if (regularContainers.length === 1) {
    // Single container - use it automatically
    targetContainer = regularContainers[0]
  } else {
    return `Error: pod ${podName} has no containers`
  }

  // Get or generate logs
  let logs = pod._simulator.logs || []

  if (logs.length === 0) {
    // Generate logs based on target container image
    logs = generateLogs(targetContainer.image, DEFAULT_LOG_COUNT)
  }

  // Apply --tail flag if present
  const tailValue = parsed.flags.tail
  if (tailValue !== undefined) {
    const tailCount = parseInt(tailValue as string, 10)

    if (isNaN(tailCount) || tailCount < 0) {
      return 'Error: --tail value must be a positive number'
    }

    if (tailCount === 0) {
      logs = []
    } else {
      logs = logs.slice(-tailCount)
    }
  }

  // Format logs
  let output = logs.join('\n')

  // Apply --follow flag if present
  const isFollow = parsed.flags.f === true || parsed.flags.follow === true
  if (isFollow && logs.length > 0) {
    output += '\n(following logs - press Ctrl+C to stop)'
  }

  return output
}
