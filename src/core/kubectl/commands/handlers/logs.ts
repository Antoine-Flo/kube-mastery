import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { Pod, PodLogEntry } from '../../../cluster/ressources/Pod'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import { getSimulatedCommandExitCode } from '../../../cluster/containerCommand'
import {
  appendLogEntriesUntil,
  generateCrashLogLines,
  generateLogs
} from '../../../cluster/logGenerator'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL LOGS HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Retrieves and displays pod logs with support for --tail and --follow flags

const DEFAULT_LOG_COUNT = 50

const parseTailCount = (tailValue: string | boolean | undefined): ExecutionResult => {
  if (tailValue === undefined) {
    return success('')
  }
  const tailText = String(tailValue)
  const validInteger = /^-?\d+$/.test(tailText)
  if (!validInteger) {
    return error(
      `error: invalid argument "${tailText}" for "--tail" flag: strconv.ParseInt: parsing "${tailText}": invalid syntax\nSee 'kubectl logs --help' for usage.`
    )
  }
  return success(tailText)
}

const parseSinceDurationMs = (
  sinceValue: string | boolean | undefined
): ExecutionResult => {
  if (sinceValue === undefined) {
    return success('')
  }
  const sinceText = String(sinceValue).trim()
  const segmentRegex = /(\d+)([smh])/g
  let totalMs = 0
  let consumed = 0
  let match = segmentRegex.exec(sinceText)

  while (match != null) {
    const amountText = match[1]
    const unit = match[2]
    const amount = Number.parseInt(amountText, 10)
    if (!Number.isFinite(amount)) {
      return error(
        `error: invalid argument "${sinceText}" for "--since" flag: time: invalid duration "${sinceText}"\nSee 'kubectl logs --help' for usage.`
      )
    }
    if (unit === 's') {
      totalMs += amount * 1000
    } else if (unit === 'm') {
      totalMs += amount * 60 * 1000
    } else if (unit === 'h') {
      totalMs += amount * 60 * 60 * 1000
    }
    consumed += match[0].length
    match = segmentRegex.exec(sinceText)
  }

  if (consumed !== sinceText.length || totalMs <= 0) {
    return error(
      `error: invalid argument "${sinceText}" for "--since" flag: time: invalid duration "${sinceText}"\nSee 'kubectl logs --help' for usage.`
    )
  }
  return success(String(totalMs))
}

const parseTimestampFromLogLine = (line: string, fallbackYear: number): number => {
  const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/)
  if (isoMatch != null) {
    return Date.parse(isoMatch[1])
  }

  const nginxMatch = line.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (nginxMatch != null) {
    const parsed = Date.parse(
      `${nginxMatch[1]}-${nginxMatch[2]}-${nginxMatch[3]}T${nginxMatch[4]}:${nginxMatch[5]}:${nginxMatch[6]}Z`
    )
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  const kubeMatch = line.match(/^[IWE](\d{2})(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{6})/)
  if (kubeMatch != null) {
    const parsed = Date.parse(
      `${fallbackYear}-${kubeMatch[1]}-${kubeMatch[2]}T${kubeMatch[3]}:${kubeMatch[4]}:${kubeMatch[5]}Z`
    )
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  const redisMatch = line.match(
    /^\d+:[A-Z] (\d{1,2}) ([A-Z][a-z]{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.\d+)?/
  )
  if (redisMatch != null) {
    const parsed = Date.parse(
      `${redisMatch[1]} ${redisMatch[2]} ${redisMatch[3]} ${redisMatch[4]}:${redisMatch[5]}:${redisMatch[6]} UTC`
    )
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return Number.NaN
}

const getPodBaseTimeMs = (pod: Pod, nowMs: number): number => {
  const startTimeText = pod.status.startTime
  if (startTimeText != null) {
    const parsedStartTime = Date.parse(startTimeText)
    if (!Number.isNaN(parsedStartTime)) {
      return parsedStartTime
    }
  }
  const creationTimestampText = pod.metadata.creationTimestamp
  const parsedCreationTimestamp = Date.parse(creationTimestampText)
  if (!Number.isNaN(parsedCreationTimestamp)) {
    return parsedCreationTimestamp
  }
  return nowMs - 60 * 1000
}

const mapLegacyLogsToEntries = (
  lines: string[],
  fallbackBaseTimeMs: number
): PodLogEntry[] => {
  if (lines.length === 0) {
    return []
  }
  const fallbackYear = new Date(fallbackBaseTimeMs).getUTCFullYear()
  const baseStartMs = fallbackBaseTimeMs - lines.length * 1000
  const entries: PodLogEntry[] = []

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const parsedTimestamp = parseTimestampFromLogLine(line, fallbackYear)
    const timestampMs =
      Number.isNaN(parsedTimestamp) === false
        ? parsedTimestamp
        : baseStartMs + (index + 1) * 1000
    entries.push({
      timestamp: new Date(timestampMs).toISOString(),
      line
    })
  }
  return entries
}

const applySinceAndTailFilters = (
  entries: PodLogEntry[],
  nowMs: number,
  sinceDurationMs?: number,
  tailCount?: number
): PodLogEntry[] => {
  let filteredEntries = entries
  if (sinceDurationMs != null) {
    const cutoffMs = nowMs - sinceDurationMs
    filteredEntries = filteredEntries.filter((entry) => {
      const timestampMs = Date.parse(entry.timestamp)
      if (Number.isNaN(timestampMs)) {
        return false
      }
      return timestampMs >= cutoffMs
    })
  }

  if (tailCount != null) {
    if (tailCount === 0) {
      return []
    }
    if (tailCount > 0) {
      return filteredEntries.slice(-tailCount)
    }
  }
  return filteredEntries
}

/**
 * Handle kubectl logs command
 * Supports:
 * - kubectl logs <pod>
 * - kubectl logs <pod> -n <namespace>
 * - kubectl logs <pod> --tail=20
 * - kubectl logs <pod> -f/--follow
 * - kubectl logs <pod> --previous (logs from the last terminated instance)
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

  const usePrevious = parsed.flags.previous === true
  const nowMs = Date.now()
  const tailParseResult = parseTailCount(parsed.flags.tail)
  if (!tailParseResult.ok) {
    return tailParseResult
  }
  const sinceParseResult = parseSinceDurationMs(parsed.flags.since)
  if (!sinceParseResult.ok) {
    return sinceParseResult
  }

  const parsedTailCount =
    tailParseResult.value.length > 0 ? Number.parseInt(tailParseResult.value, 10) : undefined
  const parsedSinceDurationMs =
    sinceParseResult.value.length > 0
      ? Number.parseInt(sinceParseResult.value, 10)
      : undefined

  if (usePrevious) {
    const containerStatus = pod.status.containerStatuses?.find(
      (s) => s.name === targetContainer.name
    )
    const restartCount = containerStatus?.restartCount ?? 0
    if (restartCount === 0) {
      const containerID = containerStatus?.containerID ?? 'unknown'
      return error(`unable to retrieve container logs for ${containerID}`)
    }
  }

  let sourceEntries: PodLogEntry[] = []
  let sourceLines: string[] = []

  if (usePrevious) {
    sourceEntries =
      pod._simulator.previousLogEntries ??
      mapLegacyLogsToEntries(
        pod._simulator.previousLogs ?? [],
        getPodBaseTimeMs(pod, nowMs)
      )
    sourceLines = sourceEntries.map((entry) => entry.line)
  } else {
    const baseTimeMs = getPodBaseTimeMs(pod, nowMs)
    const legacyCurrentLines = pod._simulator.logs ?? []
    const currentEntries =
      pod._simulator.logEntries ??
      mapLegacyLogsToEntries(legacyCurrentLines, baseTimeMs)
    const shouldAppendContinuously =
      pod._simulator.logStreamState != null ||
      pod._simulator.logEntries != null ||
      legacyCurrentLines.length === 0
    const minimumTotalEntries =
      currentEntries.length === 0 && parsedSinceDurationMs == null
        ? parsedTailCount != null && parsedTailCount > 0
          ? parsedTailCount
          : DEFAULT_LOG_COUNT
        : 0

    const appendResult = shouldAppendContinuously
      ? appendLogEntriesUntil(targetContainer.image, {
          context: {
            namespace,
            podName,
            containerName: targetContainer.name,
            baseTimeMs,
            nowMs
          },
          existingEntries: currentEntries,
          streamState: pod._simulator.logStreamState,
          nowMs,
          minimumTotalEntries
        })
      : {
          entries: currentEntries,
          streamState: pod._simulator.logStreamState
        }

    sourceEntries = appendResult.entries
    sourceLines = sourceEntries.map((entry) => entry.line)

    if (sourceEntries.length === 0 && parsedSinceDurationMs == null) {
      const generatedCount =
        parsedTailCount !== undefined && parsedTailCount > 0
          ? parsedTailCount
          : DEFAULT_LOG_COUNT
      const simulatedExitCode = getSimulatedCommandExitCode(targetContainer)
      sourceLines = generateLogs(targetContainer.image, generatedCount, {
        namespace,
        podName,
        containerName: targetContainer.name,
        ...(simulatedExitCode !== undefined && { simulatedExitCode }),
        baseTimeMs,
        nowMs
      })
      sourceEntries = mapLegacyLogsToEntries(sourceLines, baseTimeMs)
    }

    const simulatedExitCode = getSimulatedCommandExitCode(targetContainer)
    if (
      simulatedExitCode != null &&
      simulatedExitCode !== 0 &&
      Number.isInteger(simulatedExitCode)
    ) {
      const crashLines = generateCrashLogLines(simulatedExitCode, targetContainer.image)
      const hasCrashLine = sourceLines.some((line) => {
        return crashLines.includes(line)
      })
      if (!hasCrashLine) {
        for (const crashLine of crashLines) {
          sourceEntries.push({
            timestamp: new Date(nowMs).toISOString(),
            line: crashLine
          })
          sourceLines.push(crashLine)
        }
      }
    }

    const updatedPod: Pod = {
      ...pod,
      _simulator: {
        ...pod._simulator,
        logEntries: sourceEntries,
        logs: sourceLines,
        ...(appendResult.streamState != null && {
          logStreamState: appendResult.streamState
        })
      }
    }
    const updateResult = apiServer.updateResource(
      'Pod',
      pod.metadata.name,
      updatedPod,
      namespace
    )
    if (!updateResult.ok) {
      return error(updateResult.error)
    }
  }

  const filteredEntries = applySinceAndTailFilters(
    sourceEntries,
    nowMs,
    parsedSinceDurationMs,
    parsedTailCount
  )
  const output = filteredEntries.map((entry) => entry.line).join('\n')
  return success(output)
}
