import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
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
export const handleLogs = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const state = apiServer.snapshotState()
  // Validate pod name is provided
  if (!parsed.name) {
    return error('error: pod name is required')
  }

  const namespace = parsed.namespace || 'default'
  const podName = parsed.name

  const hasNamespaces = state.namespaces.items.length > 0
  if (hasNamespaces) {
    const namespaceExists = state.namespaces.items.some((item) => {
      return item.metadata.name === namespace
    })
    if (!namespaceExists) {
      return error(
        `error: error from server (NotFound): namespaces "${namespace}" not found in namespace "${namespace}"`
      )
    }
  }

  // Find the pod
  const pod = state.pods.items.find(
    (p) => p.metadata.name === podName && p.metadata.namespace === namespace
  )

  if (!pod) {
    return error(
      `error: error from server (NotFound): pods "${podName}" not found in namespace "${namespace}"`
    )
  }

  // Multi-container support: determine which container to use
  const regularContainers = pod.spec.containers
  const containerName = parsed.flags.c || parsed.flags.container

  let targetContainer

  if (containerName) {
    // Container specified via -c flag
    // Check both init and regular containers
    const allContainers = [
      ...(pod.spec.initContainers || []),
      ...regularContainers
    ]
    targetContainer = allContainers.find((c) => c.name === containerName)

    if (!targetContainer) {
      return error(
        `error: container ${containerName} is not valid for pod ${podName}`
      )
    }
  } else if (regularContainers.length > 1) {
    // Multiple containers but no -c flag specified
    const containerNames = regularContainers.map((c) => c.name).join(', ')
    return error(
      `error: a container name must be specified for pod ${podName}, choose one of: [${containerNames}]`
    )
  } else if (regularContainers.length === 1) {
    // Single container - use it automatically
    targetContainer = regularContainers[0]
  } else {
    return error(`error: pod ${podName} has no containers`)
  }

  // Get or generate logs
  let logs = pod._simulator.logs || []
  const tailValue = parsed.flags.tail
  let parsedTailCount: number | undefined

  if (tailValue !== undefined) {
    const tailText = String(tailValue)
    const validInteger = /^-?\d+$/.test(tailText)
    if (!validInteger) {
      return error(
        `error: invalid argument "${tailText}" for "--tail" flag: strconv.ParseInt: parsing "${tailText}": invalid syntax\nSee 'kubectl logs --help' for usage.`
      )
    }
    parsedTailCount = parseInt(tailText, 10)
  }

  if (logs.length === 0) {
    const generatedCount =
      parsedTailCount !== undefined && parsedTailCount > 0
        ? parsedTailCount
        : DEFAULT_LOG_COUNT
    // Generate logs based on target container image
    logs = generateLogs(targetContainer.image, generatedCount, {
      namespace,
      podName,
      containerName: targetContainer.name
    })
  }

  // Apply --tail flag if present
  if (parsedTailCount !== undefined) {
    if (parsedTailCount === 0) {
      logs = []
    } else if (parsedTailCount > 0) {
      logs = logs.slice(-parsedTailCount)
    }
  }

  // Format logs
  const output = logs.join('\n')
  return success(output)
}
