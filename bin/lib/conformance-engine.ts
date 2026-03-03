import { normalizeOutput } from './normalizer'
import { createConformanceReporter } from './conformance-reporter'
import type {
  ActionExecutionRecord,
  CommandExecutionResult,
  ConformanceAction,
  ConformanceComparison,
  ConformanceSuite
} from './conformance-types'
import { createKindExecutor } from './executors/kind-executor'
import { createRunnerExecutor } from './executors/runner-executor'
import type { Result } from './types'
import { error, success } from './types'
import type { KindExecutor } from './executors/kind-executor'
import type { RunnerExecutor } from './executors/runner-executor'

interface BackendActionResult {
  kind: CommandExecutionResult
  runner: CommandExecutionResult
}

export interface ConformanceProgressEvent {
  suiteName: string
  action: ConformanceAction
  actionIndex: number
  actionTotal: number
}

export interface ConformanceActionCompleteEvent extends ConformanceProgressEvent {
  kind: CommandExecutionResult
  runner: CommandExecutionResult
  comparison: ConformanceComparison
}

export interface ConformanceProgressListener {
  onSuiteStart?: (suite: ConformanceSuite) => void
  onActionStart?: (event: ConformanceProgressEvent) => void
  onActionComplete?: (event: ConformanceActionCompleteEvent) => void
  onSuiteFinish?: (
    suite: ConformanceSuite,
    result: Result<void, string>
  ) => void
}

const createRecord = (
  suiteName: string,
  action: ConformanceAction,
  backend: 'kind' | 'runner',
  result: CommandExecutionResult
): ActionExecutionRecord => {
  return {
    suiteName,
    actionId: action.id,
    actionType: action.type,
    backend,
    command: result.command,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    normalized: normalizeOutput(result.combined)
  }
}

const diff = (a: string, b: string): string => {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const out: string[] = []
  const maxLen = Math.max(aLines.length, bLines.length)
  for (let index = 0; index < maxLen; index++) {
    const left = aLines[index] ?? '(missing)'
    const right = bLines[index] ?? '(missing)'
    if (left !== right) {
      out.push(`- ${left}`)
      out.push(`+ ${right}`)
    }
  }
  return out.join('\n')
}

const MAX_DIFF_LINES = 80
const MAX_LINE_LENGTH = 220
const MAX_COMMAND_LENGTH = 400

interface DiffLine {
  index: number
  kind: string
  runnerSimulation: string
}

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}…`
}

const formatDiffLines = (
  kindCompared: string,
  runnerCompared: string
): string[] => {
  const kindLines = kindCompared.split('\n')
  const runnerLines = runnerCompared.split('\n')
  const maxLen = Math.max(kindLines.length, runnerLines.length)
  const lines: DiffLine[] = []
  for (let index = 0; index < maxLen; index++) {
    const kind = kindLines[index] ?? '(missing)'
    const runnerSimulation = runnerLines[index] ?? '(missing)'
    if (kind !== runnerSimulation) {
      lines.push({
        index: index + 1,
        kind: truncate(kind, MAX_LINE_LENGTH),
        runnerSimulation: truncate(runnerSimulation, MAX_LINE_LENGTH)
      })
    }
  }
  const rendered = lines
    .slice(0, MAX_DIFF_LINES)
    .flatMap((line) => [
      `[line ${line.index}]`,
      `[k] ${line.kind}`,
      `[r] ${line.runnerSimulation}`
    ])
  if (lines.length > MAX_DIFF_LINES) {
    rendered.push(
      `[truncated] ${lines.length - MAX_DIFF_LINES} diff lines omitted to reduce noise`
    )
  }
  return rendered
}

export const compareResults = (
  kind: CommandExecutionResult,
  runner: CommandExecutionResult
): ConformanceComparison => {
  const kindCompared = normalizeOutput(kind.combined)
  const runnerCompared = normalizeOutput(runner.combined)
  const outputMatches = kindCompared === runnerCompared
  const exitCodeMatches = kind.exitCode === runner.exitCode
  return {
    matched: outputMatches && exitCodeMatches,
    kindCompared,
    runnerCompared,
    diff:
      outputMatches && exitCodeMatches ? '' : diff(kindCompared, runnerCompared)
  }
}

const executeAction = (
  action: ConformanceAction,
  kindExecutor: KindExecutor,
  runnerExecutor: RunnerExecutor
): BackendActionResult => {
  if (action.type === 'applyYaml') {
    return {
      kind: kindExecutor.applyYaml(action),
      runner: runnerExecutor.applyYaml(action)
    }
  }
  if (action.type === 'deleteYaml') {
    return {
      kind: kindExecutor.deleteYaml(action),
      runner: runnerExecutor.deleteYaml(action)
    }
  }
  if (action.type === 'waitPodsReady') {
    return {
      kind: kindExecutor.waitPodsReady(action),
      runner: runnerExecutor.waitPodsReady(action)
    }
  }
  return {
    kind: kindExecutor.executeCommand(action.command),
    runner: runnerExecutor.executeCommand(action.command)
  }
}

const appendMismatch = (
  suiteName: string,
  action: ConformanceAction,
  kind: CommandExecutionResult,
  runner: CommandExecutionResult,
  comparison: ConformanceComparison
): string => {
  const command =
    kind.command.length >= runner.command.length ? kind.command : runner.command
  const renderedDiffLines = formatDiffLines(
    comparison.kindCompared,
    comparison.runnerCompared
  )
  return [
    `[suite] ${suiteName}`,
    `[action] ${action.id} (${action.type})`,
    `[command] ${truncate(command, MAX_COMMAND_LENGTH)}`,
    '[mismatch]',
    `[kind.exitCode] ${kind.exitCode}`,
    `[runner-simulation.exitCode] ${runner.exitCode}`,
    '[diff]',
    ...renderedDiffLines,
    '[details]',
    '[kind-log] artifacts/conformance/kind.log',
    '[runner-log] artifacts/conformance/runner.log',
    '---'
  ].join('\n')
}

export const runConformanceSuite = (
  suite: ConformanceSuite,
  dependencies?: {
    kindExecutor?: KindExecutor
    runnerExecutor?: RunnerExecutor
    reporter?: ReturnType<typeof createConformanceReporter>
    progressListener?: ConformanceProgressListener
  }
): Result<void, string> => {
  const kindExecutor =
    dependencies?.kindExecutor ?? createKindExecutor(suite.clusterName)
  const reporter = dependencies?.reporter ?? createConformanceReporter()
  const progressListener = dependencies?.progressListener

  progressListener?.onSuiteStart?.(suite)

  const setupResult = kindExecutor.setup()
  if (!setupResult.ok) {
    const failed = error(setupResult.error)
    progressListener?.onSuiteFinish?.(suite, failed)
    return failed
  }

  const runnerExecutor = dependencies?.runnerExecutor ?? createRunnerExecutor()
  let finalResult: Result<void, string> = success(undefined)

  try {
    const actionTotal = suite.actions.length
    for (let actionIndex = 0; actionIndex < actionTotal; actionIndex++) {
      const action = suite.actions[actionIndex]
      progressListener?.onActionStart?.({
        suiteName: suite.name,
        action,
        actionIndex,
        actionTotal
      })
      const { kind, runner } = executeAction(
        action,
        kindExecutor,
        runnerExecutor
      )

      reporter.recordKind(createRecord(suite.name, action, 'kind', kind))
      reporter.recordRunner(createRecord(suite.name, action, 'runner', runner))

      const comparison = compareResults(kind, runner)
      progressListener?.onActionComplete?.({
        suiteName: suite.name,
        action,
        actionIndex,
        actionTotal,
        kind,
        runner,
        comparison
      })
      if (!comparison.matched) {
        reporter.recordDiff(
          appendMismatch(suite.name, action, kind, runner, comparison)
        )
      }
    }
  } finally {
    const teardownResult = kindExecutor.teardown()
    if (!teardownResult.ok) {
      reporter.recordDiff(`[teardown] ${teardownResult.error}`)
    }
    reporter.flush()
  }

  progressListener?.onSuiteFinish?.(suite, finalResult)
  return finalResult
}
