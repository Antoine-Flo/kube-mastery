import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { PodLifecycleDescribeEvent } from '../../api/PodLifecycleEventStore'
import type { FileSystem } from '../../filesystem/FileSystem'
import type { SimNetworkRuntime } from '../../network/SimNetworkRuntime'
import {
  createMetricsProvider,
  type MetricsProvider
} from '../../metrics/metricsProvider'
import type { Logger } from '../../../logger/Logger'
import type { EditorModal } from '../../shell/commands'
import type { ExecutionResult } from '../../shared/result'
import { error, success } from '../../shared/result'
import { handleAnnotate } from './handlers/annotate'
import { handleAPIVersions } from './handlers/apiVersions'
import { handleAPIResources } from './handlers/apiResources'
import { handleApply } from './handlers/apply'
import { handleAuth } from './handlers/auth'
import { handleCreate } from './handlers/create'
import { handleCreateToken } from './handlers/createToken'
import { handleClusterInfo } from './handlers/clusterInfo'
import {
  getCurrentNamespaceFromKubeconfig,
  handleConfig
} from './handlers/config'
import { handleDelete } from './handlers/delete'
import { handleDiff } from './handlers/diff'
import { handleDescribe } from './handlers/describe'
import { handleEdit } from './handlers/edit'
import { handleExplain } from './handlers/explain'
import { handleExpose } from './handlers/expose'
import { handleExec } from './handlers/exec'
import { handleGet } from './handlers/get'
import { handleLabel } from './handlers/label'
import { handleLogs } from './handlers/logs'
import { handlePatch } from './handlers/patch'
import { handleScale } from './handlers/scale'
import { handleSetImage } from './handlers/setImage'
import { handleReplace } from './handlers/replace'
import { handleRun } from './handlers/run'
import { handleRollout } from './handlers/rollout'
import { handleTop } from './handlers/top'
import { handleVersion } from './handlers/version'
import { handleWait } from './handlers/wait'
import { handleOptions } from './handlers/options'
import { resolveKubectlHelp } from './help'
import { parseCommand } from './parser'
import {
  ACTIONS_WITHOUT_IMPLICIT_NAMESPACE,
  AUTH_SUBCOMMAND_ACTIONS,
  CONFIG_SUBCOMMAND_ACTIONS
} from './actionGroups'
import type { Action, ParsedCommand } from './types'
import { runKubectlCommandHooks } from '../cli/runtime/execute'
import { forEach } from 'remeda'

// Action handler signature (dependencies captured in closure)
type ActionHandler = (parsed: ParsedCommand) => ExecutionResult
type ActionHandlerEntry = readonly [Action, ActionHandler]
const ACTIONS_WITHOUT_IMPLICIT_NAMESPACE_SET = new Set<Action>(
  ACTIONS_WITHOUT_IMPLICIT_NAMESPACE
)

export type KubectlExecutorOptions = {
  metricsProvider?: MetricsProvider
  editorModal?: EditorModal
  onAsyncOutput?: (message: string) => void
  preserveFailedEditCopy?: (content: string) => string | undefined
}

const toGetExecutionResult = (output: string): ExecutionResult => {
  const lines = output.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (
      trimmed.startsWith('Error from server') ||
      trimmed.startsWith('error:') ||
      trimmed.startsWith('Error:')
    ) {
      return error(output)
    }
  }
  return success(output)
}

const applyImplicitNamespaceFromKubeconfig = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ParsedCommand => {
  if (parsed.namespace !== undefined) {
    return parsed
  }

  if (ACTIONS_WITHOUT_IMPLICIT_NAMESPACE_SET.has(parsed.action)) {
    return parsed
  }

  const namespace = getCurrentNamespaceFromKubeconfig(fileSystem)
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
  networkRuntime?: SimNetworkRuntime,
  reconcileForWait?: (namespace?: string) => void,
  options: KubectlExecutorOptions = {}
): Map<string, ActionHandler> => {
  const handlers = new Map<string, ActionHandler>()
  const metricsProvider =
    options.metricsProvider ?? createMetricsProvider(apiServer)

  const sharedConfigHandler: ActionHandler = (parsed) => {
    return handleConfig(fileSystem, parsed)
  }
  const sharedAuthHandler: ActionHandler = (parsed) => {
    return handleAuth(fileSystem, apiServer, parsed)
  }
  const directBindings: ActionHandlerEntry[] = [
    [
      'get',
      (parsed) =>
        toGetExecutionResult(handleGet(apiServer, parsed, { getResourceVersion }))
    ],
    ['diff', (parsed) => handleDiff(fileSystem, apiServer, parsed)],
    ['explain', (parsed) => handleExplain(parsed)],
    [
      'describe',
      (parsed) =>
        handleDescribe(apiServer, parsed, {
          listPodEvents
        })
    ],
    [
      'edit',
      (parsed) =>
        handleEdit(apiServer, parsed, {
          editorModal: options.editorModal,
          onAsyncOutput: options.onAsyncOutput,
          preserveFailedEditCopy: options.preserveFailedEditCopy
        })
    ],
    ['set', (parsed) => handleSetImage(apiServer, parsed)],
    ['delete', (parsed) => handleDelete(apiServer, parsed, fileSystem)],
    ['apply', (parsed) => handleApply(fileSystem, apiServer, parsed)],
    ['replace', (parsed) => handleReplace(fileSystem, apiServer, parsed)],
    ['create', (parsed) => handleCreate(fileSystem, apiServer, parsed)],
    ['create-token', (parsed) => handleCreateToken(apiServer, parsed)],
    ['logs', (parsed) => handleLogs(apiServer, parsed)],
    [
      'exec',
      (parsed) => toGetExecutionResult(handleExec(apiServer, parsed, networkRuntime))
    ],
    ['label', (parsed) => handleLabel(apiServer, parsed)],
    ['annotate', (parsed) => handleAnnotate(apiServer, parsed)],
    ['version', (parsed) => handleVersion(parsed)],
    ['cluster-info', (parsed) => handleClusterInfo(apiServer, parsed)],
    ['api-versions', (parsed) => success(handleAPIVersions(parsed))],
    ['api-resources', (parsed) => handleAPIResources(parsed)],
    ['scale', (parsed) => handleScale(apiServer, parsed)],
    ['patch', (parsed) => handlePatch(apiServer, parsed)],
    ['run', (parsed) => handleRun(apiServer, parsed, networkRuntime)],
    ['expose', (parsed) => handleExpose(apiServer, parsed)],
    ['wait', (parsed) => handleWait(apiServer, parsed, reconcileForWait)],
    ['top-pods', (parsed) => handleTop(apiServer, metricsProvider, parsed)],
    ['top-nodes', (parsed) => handleTop(apiServer, metricsProvider, parsed)],
    ['rollout', (parsed) => handleRollout(apiServer, parsed, reconcileForWait)],
    ['options', (parsed) => success(handleOptions(parsed))]
  ]
  forEach(directBindings, ([action, handler]) => {
    handlers.set(action, handler)
  })
  forEach(CONFIG_SUBCOMMAND_ACTIONS, (action) => {
    handlers.set(action, sharedConfigHandler)
  })
  forEach(AUTH_SUBCOMMAND_ACTIONS, (action) => {
    handlers.set(action, sharedAuthHandler)
  })

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
  networkRuntime?: SimNetworkRuntime,
  reconcileForWait?: (namespace?: string) => void,
  options: KubectlExecutorOptions = {}
) => {
  const metricsProvider =
    options.metricsProvider ?? createMetricsProvider(apiServer)

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
      networkRuntime,
      reconcileForWait,
      {
        ...options,
        metricsProvider
      }
    )
    const parsedWithNamespace = applyImplicitNamespaceFromKubeconfig(
      fs,
      parseResult.value
    )
    const hookResult = runKubectlCommandHooks(input, parsedWithNamespace)
    if (!hookResult.ok) {
      return error(hookResult.error)
    }

    return routeCommand(handlers, parsedWithNamespace, logger)
  }

  return { execute }
}
