/**
 * Terminal integration for kubectl: shell redirection, watch/logs/rollout streams,
 * special directives, and executor wiring. Command semantics stay in
 * src/core/kubectl/commands/handlers/ (similar to upstream kubectl pkg/cmd vs pkg/cmd/get).
 */
import { createKubectlExecutor } from '../../kubectl/commands/executor'
import {
  createStatefulTabWriter,
  tryParseTableOutput
} from '../../kubectl/commands/output/statefulTabWriter'
import { parseCommand } from '../../kubectl/commands/parser'
import type { ExecutionResult } from '../../shared/result'
import { error, success } from '../../shared/result'
import {
  getShellRegistryCommandNames,
  parseSequentialShellScript,
  parseShellCommand
} from '../../shell/commands'
import { createShellExecutorFromContext } from '../../shell/commands/executionContext'
import type { CommandContext } from '../core/CommandContext'
import { executeKubectlDirective } from './directives'
import {
  restorePromptAfterStreamStop,
  writeExecutionResultOutput
} from './executionOutput'
import { buildKubectlExecutorTerminalOptions } from './executorOptions'
import { isKubectlHelpRequest } from './help'
import {
  buildLogsFollowDeltaOutput,
  isLogsFollowEnabled,
  LOGS_FOLLOW_POLL_INTERVAL_MS
} from './logsFollow'
import { parseKubectlOutputEnvelope } from './outputEnvelope'
import {
  parseKubectlOutputRedirection,
  stripInlineShellComment
} from './redirection'
import {
  expandRolloutStatusOutput,
  isRolloutStatusFollowEnabled,
  isRolloutStatusSuccessOutput
} from './rolloutFollow'
import { shouldRenderEvent } from './watch/clusterEventFilter'
import { buildWatchDeltaOutput } from './watch/watchDelta'
import {
  getEffectiveNamespace,
  getWatchEventTypes,
  isWatchEnabled,
  isWatchOnly
} from './watch/watchEventTypes'

type ParsedKubectlPipeline = {
  sourceCommand: string
  shellCommands: string[]
}

const parseKubectlPipeline = (
  command: string
): ExecutionResult & { parsed?: ParsedKubectlPipeline } => {
  const parsedScriptResult = parseSequentialShellScript(command)
  if (!parsedScriptResult.ok) {
    return error(parsedScriptResult.error)
  }
  const steps = parsedScriptResult.steps ?? []
  if (steps.length !== 1) {
    return success('')
  }
  const firstStep = steps[0]
  if (firstStep.kind !== 'pipeline' || firstStep.commands.length < 2) {
    return success('')
  }
  const sourceCommand = firstStep.commands[0]?.trim() ?? ''
  const firstToken = sourceCommand.split(/\s+/)[0] ?? ''
  if (firstToken !== 'kubectl' && firstToken !== 'k') {
    return success('')
  }
  const shellCommands = firstStep.commands.slice(1)
  for (const shellCommand of shellCommands) {
    const shellParseResult = parseShellCommand(
      shellCommand,
      getShellRegistryCommandNames()
    )
    if (!shellParseResult.ok) {
      return error(shellParseResult.error)
    }
    if (shellParseResult.value.command === 'sleep') {
      return error('sleep is not supported in pipeline commands')
    }
  }
  return {
    ok: true,
    value: '',
    parsed: {
      sourceCommand,
      shellCommands
    }
  }
}

export const runKubectlInTerminal = (
  command: string,
  context: CommandContext
): ExecutionResult => {
  const commandWithoutComment = stripInlineShellComment(command)
  const parseRedirectionResult = parseKubectlOutputRedirection(
    commandWithoutComment
  )
  if (!parseRedirectionResult.ok || parseRedirectionResult.parsed == null) {
    const redirectionError = parseRedirectionResult.ok
      ? 'invalid output redirection'
      : parseRedirectionResult.error
    context.output.writeOutput(redirectionError)
    return error(redirectionError)
  }

  const parsedRedirection = parseRedirectionResult.parsed
  const parsedPipelineResult = parseKubectlPipeline(parsedRedirection.command)
  if (!parsedPipelineResult.ok) {
    context.output.writeOutput(parsedPipelineResult.error)
    return error(parsedPipelineResult.error)
  }
  const parsedPipeline = parsedPipelineResult.parsed

  const executor = createKubectlExecutor(
    context.apiServer,
    context.fileSystem,
    context.logger,
    context.networkRuntime,
    undefined,
    buildKubectlExecutorTerminalOptions(context)
  )
  if (parsedPipeline != null) {
    const sourceResult = executor.execute(parsedPipeline.sourceCommand)
    if (!sourceResult.ok) {
      context.output.writeOutput(sourceResult.error)
      return sourceResult
    }

    const sourceEnvelope = parseKubectlOutputEnvelope(sourceResult.value)
    if (
      sourceEnvelope.stderrNotice != null &&
      sourceEnvelope.stderrNotice.length > 0
    ) {
      context.output.writeOutput(sourceEnvelope.stderrNotice)
    }
    const directiveResult = executeKubectlDirective(context, sourceEnvelope.payload)
    if (directiveResult != null && !directiveResult.ok) {
      context.output.writeOutput(directiveResult.error)
      return directiveResult
    }
    let pipedInput =
      directiveResult != null ? directiveResult.value : sourceEnvelope.payload
    const shellExecutor = createShellExecutorFromContext({
      fileSystem: context.fileSystem,
      editorModal: context.editorModal
    })
    for (const shellCommand of parsedPipeline.shellCommands) {
      const shellResult = shellExecutor.execute(shellCommand, { stdin: pipedInput })
      if (!shellResult.ok) {
        context.output.writeOutput(shellResult.error)
        return shellResult
      }
      pipedInput = shellResult.value
    }

    if (parsedRedirection.outputFile != null) {
      const writeResult = context.fileSystem.writeFile(
        parsedRedirection.outputFile,
        pipedInput
      )
      if (!writeResult.ok) {
        context.output.writeOutput(writeResult.error)
        return error(writeResult.error)
      }
      return success('')
    }
    if (pipedInput.length > 0) {
      context.output.writeOutput(pipedInput)
    }
    return success(pipedInput)
  }

  if (isKubectlHelpRequest(parsedRedirection.command)) {
    const helpResult = executor.execute(parsedRedirection.command)
    if (helpResult.ok) {
      if (helpResult.value.length > 0) {
        context.output.writeOutput(helpResult.value)
      }
    } else {
      context.output.writeOutput(helpResult.error)
    }
    return helpResult
  }

  const parsedCommandResult = parseCommand(parsedRedirection.command)
  if (!parsedCommandResult.ok) {
    context.output.writeOutput(parsedCommandResult.error)
    return error(parsedCommandResult.error)
  }
  const parsedCommand = parsedCommandResult.value
  const watchEnabled =
    parsedCommand.action === 'get' &&
    parsedCommand.rawPath == null &&
    isWatchEnabled(parsedCommand)
  const logsFollowEnabled = isLogsFollowEnabled(parsedCommand)
  const rolloutStatusFollowEnabled = isRolloutStatusFollowEnabled(parsedCommand)

  if (watchEnabled && parsedRedirection.outputFile != null) {
    const watchRedirectionError =
      'unsupported output redirection syntax for watch mode'
    context.output.writeOutput(watchRedirectionError)
    return error(watchRedirectionError)
  }
  if (logsFollowEnabled && parsedRedirection.outputFile != null) {
    const followRedirectionError =
      'unsupported output redirection syntax for follow mode'
    context.output.writeOutput(followRedirectionError)
    return error(followRedirectionError)
  }
  if (rolloutStatusFollowEnabled && parsedRedirection.outputFile != null) {
    const rolloutFollowRedirectionError =
      'unsupported output redirection syntax for rollout follow mode'
    context.output.writeOutput(rolloutFollowRedirectionError)
    return error(rolloutFollowRedirectionError)
  }
  if (logsFollowEnabled && parsedCommand.flags.previous === true) {
    const previousWithFollowError =
      'error: only one of follow (-f) or previous (-p) is allowed'
    context.output.writeOutput(previousWithFollowError)
    return error(previousWithFollowError)
  }
  if (watchEnabled && parsedCommand.resource != null) {
    const supportedWatchEvents = getWatchEventTypes(parsedCommand.resource)
    if (supportedWatchEvents.length === 0) {
      const unsupportedResourceError = `watch is not supported for resource: ${parsedCommand.resource}`
      context.output.writeOutput(unsupportedResourceError)
      return error(unsupportedResourceError)
    }
  }

  const result = executor.execute(parsedRedirection.command)

  if (result.ok && typeof result.value === 'string') {
    const kubectlOutputEnvelope = parseKubectlOutputEnvelope(result.value)
    if (
      kubectlOutputEnvelope.stderrNotice != null &&
      kubectlOutputEnvelope.stderrNotice.length > 0
    ) {
      context.output.writeOutput(kubectlOutputEnvelope.stderrNotice)
    }
    const directiveResult = executeKubectlDirective(
      context,
      kubectlOutputEnvelope.payload
    )
    if (directiveResult != null) {
      if (!directiveResult.ok) {
        context.output.writeOutput(directiveResult.error)
        return directiveResult
      }
      if (directiveResult.value.length > 0) {
        context.output.writeOutput(directiveResult.value)
      }
      return directiveResult
    }
  }

  if (parsedRedirection.outputFile != null) {
    if (!result.ok) {
      context.output.writeOutput(result.error)
      return result
    }

    const outputToWrite = result.value || ''
    const writeResult = context.fileSystem.writeFile(
      parsedRedirection.outputFile,
      outputToWrite
    )
    if (!writeResult.ok) {
      context.output.writeOutput(writeResult.error)
      return error(writeResult.error)
    }

    return success('')
  }

  if (
    watchEnabled &&
    context.startStream != null &&
    parsedCommand.resource != null
  ) {
    const outputDirective =
      parsedCommand.flags['output'] ?? parsedCommand.flags['o']
    const isStructuredOutput =
      typeof outputDirective === 'string' &&
      (outputDirective === 'json' ||
        outputDirective === 'yaml' ||
        outputDirective === 'name' ||
        outputDirective.startsWith('jsonpath'))
    const stripTableHeader = !isStructuredOutput
    const noHeadersRequested =
      parsedCommand.flags['no-headers'] === true ||
      parsedCommand.flags.noHeaders === true
    const useStatefulTableWriter = stripTableHeader && !noHeadersRequested
    const effectiveNamespace = getEffectiveNamespace(parsedCommand, context)
    const watchTableWriter = createStatefulTabWriter({
      spacing: 3,
      minColumnWidthsByHeader: {
        STATUS: 'ImagePullBackOff'.length
      }
    })
    let hasSeededWatchTable = false
    let lastOutput = isWatchOnly(parsedCommand)
      ? ''
      : result.ok
        ? result.value || ''
        : result.error

    if (isWatchOnly(parsedCommand)) {
      if (!result.ok) {
        context.output.writeOutput(result.error)
        return result
      }
    } else {
      if (!result.ok) {
        context.output.writeOutput(result.error)
        return result
      }
      if (result.value != null && result.value.length > 0) {
        if (useStatefulTableWriter) {
          const parsedTableOutput = tryParseTableOutput(result.value)
          if (parsedTableOutput != null) {
            const initialLines = watchTableWriter.ingestHeaderAndRows(
              parsedTableOutput.header,
              parsedTableOutput.rows
            )
            hasSeededWatchTable = true
            context.output.writeOutput(initialLines.join('\n'))
          } else {
            context.output.writeOutput(result.value)
          }
        } else {
          context.output.writeOutput(result.value)
        }
      }
    }

    const onWatchEvent = () => {
      const next = executor.execute(parsedRedirection.command)
      const nextOutput = next.ok ? next.value || '' : next.error
      if (nextOutput === lastOutput) {
        return
      }
      if (useStatefulTableWriter) {
        const parsedTableOutput = tryParseTableOutput(nextOutput)
        if (parsedTableOutput != null) {
          if (!hasSeededWatchTable) {
            const seededLines = watchTableWriter.ingestHeaderAndRows(
              parsedTableOutput.header,
              parsedTableOutput.rows
            )
            hasSeededWatchTable = true
            lastOutput = nextOutput
            const firstRows = seededLines.slice(1)
            if (firstRows.length === 0) {
              return
            }
            context.output.writeOutput(firstRows.join('\n'))
            return
          }
          const changedRows = watchTableWriter.formatDelta(
            parsedTableOutput.rows
          )
          lastOutput = nextOutput
          if (changedRows.length === 0) {
            return
          }
          context.output.writeOutput(changedRows.join('\n'))
          return
        }
      }
      const deltaOutput = buildWatchDeltaOutput(
        lastOutput,
        nextOutput,
        stripTableHeader
      )
      lastOutput = nextOutput
      if (deltaOutput.length === 0) {
        return
      }
      context.output.writeOutput(deltaOutput)
    }
    const unsubscribe = context.apiServer.watchHub.watchAllClusterEvents(
      (clusterEvent) => {
        if (
          !shouldRenderEvent(clusterEvent, parsedCommand, effectiveNamespace)
        ) {
          return
        }
        onWatchEvent()
      }
    )
    context.startStream(() => {
      unsubscribe()
      watchTableWriter.reset()
    })
    return success('')
  }

  if (logsFollowEnabled && context.startStream != null) {
    if (!result.ok) {
      context.output.writeOutput(result.error)
      return result
    }
    if (result.value != null && result.value.length > 0) {
      context.output.writeOutput(result.value)
    }

    let lastOutput = result.value || ''
    const intervalId = setInterval(() => {
      const next = executor.execute(parsedRedirection.command)
      const nextOutput = next.ok ? next.value || '' : next.error
      if (!next.ok) {
        context.output.writeOutput(next.error)
        if (context.stopStream != null) {
          context.stopStream()
          restorePromptAfterStreamStop(context)
        } else {
          clearInterval(intervalId)
        }
        return
      }
      if (nextOutput === lastOutput) {
        return
      }
      const deltaOutput = buildLogsFollowDeltaOutput(lastOutput, nextOutput)
      lastOutput = nextOutput
      if (deltaOutput.length === 0) {
        return
      }
      context.output.writeOutput(deltaOutput)
    }, LOGS_FOLLOW_POLL_INTERVAL_MS)

    context.startStream(() => {
      clearInterval(intervalId)
    })
    return success('')
  }

  if (rolloutStatusFollowEnabled && context.startStream != null) {
    if (!result.ok) {
      context.output.writeOutput(result.error)
      return result
    }
    if (result.value != null && result.value.length > 0) {
      context.output.writeOutput(result.value)
    }
    if (isRolloutStatusSuccessOutput(result.value || '')) {
      return success('')
    }

    let lastOutput = result.value || ''
    const effectiveNamespace = getEffectiveNamespace(parsedCommand, context)
    const onRolloutStatusEvent = () => {
      const next = executor.execute(parsedRedirection.command)
      const nextOutput = next.ok ? next.value || '' : next.error
      if (!next.ok) {
        context.output.writeOutput(next.error)
        if (context.stopStream != null) {
          context.stopStream()
        }
        return
      }
      if (nextOutput === lastOutput) {
        return
      }
      const expandedOutputs = expandRolloutStatusOutput(lastOutput, nextOutput)
      lastOutput = nextOutput
      if (expandedOutputs.length > 0) {
        context.output.writeOutput(expandedOutputs.join('\n'))
      }
      if (isRolloutStatusSuccessOutput(nextOutput)) {
        if (context.stopStream != null) {
          context.stopStream()
          restorePromptAfterStreamStop(context)
        }
      }
    }

    const unsubscribe = context.apiServer.watchHub.watchAllClusterEvents(
      (clusterEvent) => {
        if (
          !shouldRenderEvent(clusterEvent, parsedCommand, effectiveNamespace)
        ) {
          return
        }
        onRolloutStatusEvent()
      }
    )

    context.startStream(() => {
      unsubscribe()
    })
    return success('')
  }

  writeExecutionResultOutput(context, result)

  return result
}
