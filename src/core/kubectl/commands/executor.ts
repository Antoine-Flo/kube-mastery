import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { PodLifecycleDescribeEvent } from '../../api/PodLifecycleEventStore'
import type { FileSystem } from '../../filesystem/FileSystem'
import type { SimNetworkRuntime } from '../../network/SimNetworkRuntime'
import type { Logger } from '../../../logger/Logger'
import type { ExecutionResult } from '../../shared/result'
import { error, success } from '../../shared/result'
import { handleAnnotate } from './handlers/annotate'
import { handleAPIVersions } from './handlers/apiVersions'
import { handleAPIResources } from './handlers/apiResources'
import { handleApply, handleCreate, handleRun } from './handlers/applyCreate'
import { handleClusterInfo } from './handlers/clusterInfo'
import {
  getCurrentNamespaceFromKubeconfig,
  handleConfig
} from './handlers/config'
import { handleDelete } from './handlers/delete'
import { handleDiff } from './handlers/diff'
import { handleDescribe } from './handlers/describe'
import { handleExplain } from './handlers/explain'
import { handleExpose } from './handlers/expose'
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

const toGetExecutionResult = (output: string): ExecutionResult => {
  if (output.startsWith('Error from server') || output.startsWith('error:')) {
    return error(output)
  }
  return success(output)
}

const applyImplicitNamespaceFromKubeconfig = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ParsedCommand => {
  if (parsed.namespace !== undefined) {
    return parsed
  }

  if (
    parsed.action === 'config' ||
    parsed.action === 'config-get-contexts' ||
    parsed.action === 'config-current-context' ||
    parsed.action === 'config-view' ||
    parsed.action === 'config-set-context'
  ) {
    return parsed
  }

  const namespace = getCurrentNamespaceFromKubeconfig(apiServer)
  if (namespace === undefined) {
    return parsed
  }

  return {
    ...parsed,
    namespace
  }
}

/**
 * Create action handlers Map with dependencies captured in closures
 */
const createHandlers = (
  apiServer: ApiServerFacade,
  fileSystem: FileSystem,
  _logger: Logger,
  getResourceVersion: () => string,
  listPodEvents: (
    namespace: string,
    podName: string
  ) => readonly PodLifecycleDescribeEvent[],
  networkRuntime?: SimNetworkRuntime
): Map<string, ActionHandler> => {
  const handlers = new Map<string, ActionHandler>()

  // Direct handler mapping - logging is handled centrally by event system
  handlers.set('get', (parsed) =>
    toGetExecutionResult(handleGet(apiServer, parsed, { getResourceVersion }))
  )
  handlers.set('diff', (parsed) => handleDiff(fileSystem, apiServer, parsed))
  handlers.set('explain', (parsed) => handleExplain(parsed))
  handlers.set('describe', (parsed) =>
    handleDescribe(apiServer, parsed, {
      listPodEvents
    })
  )
  handlers.set('delete', (parsed) => handleDelete(apiServer, parsed, fileSystem))
  handlers.set('apply', (parsed) =>
    handleApply(fileSystem, apiServer, parsed)
  )
  handlers.set('create', (parsed) =>
    handleCreate(fileSystem, apiServer, parsed)
  )
  handlers.set('logs', (parsed) => handleLogs(apiServer, parsed))
  handlers.set('exec', (parsed) =>
    success(handleExec(apiServer, parsed, networkRuntime))
  )
  handlers.set('label', (parsed) => handleLabel(apiServer, parsed))
  handlers.set('annotate', (parsed) => handleAnnotate(apiServer, parsed))
  handlers.set('version', (parsed) => handleVersion(parsed))
  handlers.set('cluster-info', (parsed) =>
    handleClusterInfo(apiServer, parsed)
  )
  handlers.set('api-versions', (parsed) => success(handleAPIVersions(parsed)))
  handlers.set('api-resources', (parsed) => handleAPIResources(parsed))
  handlers.set('scale', (parsed) => handleScale(apiServer, parsed))
  handlers.set('run', (parsed) =>
    handleRun(apiServer, parsed, networkRuntime)
  )
  handlers.set('expose', (parsed) => handleExpose(apiServer, parsed))
  handlers.set('config-get-contexts', (parsed) =>
    handleConfig(apiServer, parsed)
  )
  handlers.set('config-current-context', (parsed) =>
    handleConfig(apiServer, parsed)
  )
  handlers.set('config-view', (parsed) => handleConfig(apiServer, parsed))
  handlers.set('config-set-context', (parsed) =>
    handleConfig(apiServer, parsed)
  )

  return handlers
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
 * Factory function that encapsulates api server runtime dependencies in closures
 * FileSystem is passed per-execution to support dynamic filesystem context (host vs container)
 *
 * @param apiServer - API server facade exposing clusterState and eventBus
 * @param defaultFileSystem - The default filesystem (used if none provided)
 * @param logger - Application logger for tracking commands
 * @returns Executor with execute method that accepts optional filesystem
 */
export const createKubectlExecutor = (
  apiServer: ApiServerFacade,
  defaultFileSystem: FileSystem,
  logger: Logger,
  networkRuntime?: SimNetworkRuntime
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
    const handlers = createHandlers(
      apiServer,
      fs,
      logger,
      apiServer.getResourceVersion,
      apiServer.podLifecycleEventStore.listPodEvents,
      networkRuntime
    )
    const parsedWithNamespace = applyImplicitNamespaceFromKubeconfig(
      apiServer,
      parseResult.value
    )

    return routeCommand(handlers, parsedWithNamespace, logger)
  }

  return { execute }
}
