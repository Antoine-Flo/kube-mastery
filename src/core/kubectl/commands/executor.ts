import type { ClusterState } from '../../cluster/ClusterState'
import type { EventBus } from '../../cluster/events/EventBus'
import type { FileSystem } from '../../filesystem/FileSystem'
import type { Logger } from '../../../logger/Logger'
import type { ExecutionResult } from '../../shared/result'
import { error, success } from '../../shared/result'
import { handleAnnotate } from './handlers/annotate'
import { handleAPIVersions } from './handlers/apiVersions'
import { handleAPIResources } from './handlers/apiResources'
import { handleApply, handleCreate } from './handlers/applyCreate'
import { handleClusterInfo } from './handlers/clusterInfo'
import { handleDelete } from './handlers/delete'
import { handleDescribe } from './handlers/describe'
import { handleExec } from './handlers/exec'
import { handleGet } from './handlers/get'
import { handleLabel } from './handlers/label'
import { handleLogs } from './handlers/logs'
import { handleScale } from './handlers/scale'
import { handleVersion } from './handlers/version'
import { resolveKubectlHelp } from './help'
import { parseCommand } from './parser'
import type { ParsedCommand } from './types'

// Action handler signature (dependencies captured in closure)
type ActionHandler = (parsed: ParsedCommand) => ExecutionResult

/**
 * Create action handlers Map with dependencies captured in closures
 */
const createHandlers = (
  clusterState: ClusterState,
  fileSystem: FileSystem,
  _logger: Logger,
  eventBus: EventBus
): Map<string, ActionHandler> => {
  const handlers = new Map<string, ActionHandler>()

  // Direct handler mapping - logging is handled centrally by event system
  handlers.set('get', (parsed) =>
    success(handleGet(clusterState.toJSON(), parsed))
  )
  handlers.set('describe', (parsed) =>
    handleDescribe(clusterState.toJSON(), parsed)
  )
  handlers.set('delete', (parsed) =>
    handleDelete(clusterState, parsed, eventBus)
  )
  handlers.set('apply', (parsed) =>
    handleApply(fileSystem, clusterState, parsed, eventBus)
  )
  handlers.set('create', (parsed) =>
    handleCreate(fileSystem, clusterState, parsed, eventBus)
  )
  handlers.set('logs', (parsed) =>
    success(handleLogs(clusterState.toJSON(), parsed))
  )
  handlers.set('exec', (parsed) =>
    success(handleExec(clusterState.toJSON(), parsed))
  )
  handlers.set('label', (parsed) =>
    handleLabelAdapter(clusterState, fileSystem, eventBus, parsed)
  )
  handlers.set('annotate', (parsed) =>
    handleAnnotateAdapter(clusterState, fileSystem, eventBus, parsed)
  )
  handlers.set('version', (parsed) => handleVersion(parsed))
  handlers.set('cluster-info', (parsed) =>
    handleClusterInfo(clusterState.toJSON(), parsed)
  )
  handlers.set('api-versions', (parsed) => success(handleAPIVersions(parsed)))
  handlers.set('api-resources', (parsed) => handleAPIResources(parsed))
  handlers.set('scale', (parsed) => handleScale(clusterState, parsed, eventBus))

  return handlers
}

// ─── Handler Adapters ────────────────────────────────────────────────────

// Adapters for handlers that need state management
const handleLabelAdapter = (
  cluster: ClusterState,
  _fs: FileSystem,
  eventBus: EventBus,
  parsed: ParsedCommand
): ExecutionResult => {
  const result = handleLabel(cluster.toJSON(), parsed, eventBus)
  if (result.ok && result.state) {
    cluster.loadState(result.state)
  }
  return result.ok && result.state ? { ok: true, value: result.value } : result
}

const handleAnnotateAdapter = (
  cluster: ClusterState,
  _fs: FileSystem,
  eventBus: EventBus,
  parsed: ParsedCommand
): ExecutionResult => {
  const result = handleAnnotate(cluster.toJSON(), parsed, eventBus)
  if (result.ok && result.state) {
    cluster.loadState(result.state)
  }
  return result.ok && result.state ? { ok: true, value: result.value } : result
}

/**
 * Route parsed command to handler from Map
 */
const routeCommand = (
  handlers: Map<string, ActionHandler>,
  parsed: ParsedCommand,
  logger: Logger
): ExecutionResult => {
  const handler = handlers.get(parsed.action)

  if (!handler) {
    logger.error('EXECUTOR', `Unknown action: ${parsed.action}`)
    return error(`Unknown action: ${parsed.action}`)
  }

  return handler(parsed)
}

/**
 * Create a kubectl executor
 * Factory function that encapsulates ClusterState, Logger, and EventBus in closures
 * FileSystem is passed per-execution to support dynamic filesystem context (host vs container)
 *
 * @param clusterState - The cluster state to operate on
 * @param defaultFileSystem - The default filesystem (used if none provided)
 * @param logger - Application logger for tracking commands
 * @param eventBus - EventBus for event-driven architecture
 * @returns Executor with execute method that accepts optional filesystem
 */
export const createKubectlExecutor = (
  clusterState: ClusterState,
  defaultFileSystem: FileSystem,
  logger: Logger,
  eventBus: EventBus
) => {
  const execute = (input: string, fileSystem?: FileSystem): ExecutionResult => {
    logger.info('COMMAND', `Kubectl: ${input}`)

    const helpText = resolveKubectlHelp(input)
    if (helpText !== undefined) {
      return success(helpText)
    }

    const parseResult = parseCommand(input)
    if (!parseResult.ok) {
      logger.error('EXECUTOR', `Parse error: ${parseResult.error}`)
      return error(parseResult.error)
    }

    // Use provided filesystem or fallback to default
    const fs = fileSystem || defaultFileSystem
    const handlers = createHandlers(clusterState, fs, logger, eventBus)

    return routeCommand(handlers, parseResult.value, logger)
  }

  return { execute }
}
