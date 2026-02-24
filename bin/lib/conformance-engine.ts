import { normalizeOutput } from './normalizer'
import { createConformanceReporter } from './conformance-reporter'
import type {
  ActionExecutionRecord,
  CommandAction,
  CommandExecutionResult,
  CommandExpectation,
  CompareMode,
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

export const checkExpectation = (
  result: CommandExecutionResult,
  expectation: CommandExpectation | undefined
): Result<void, string> => {
  if (expectation === undefined) {
    return success(undefined)
  }
  if (
    typeof expectation.exitCode === 'number' &&
    result.exitCode !== expectation.exitCode
  ) {
    return error(
      `Expected exitCode=${expectation.exitCode}, got exitCode=${result.exitCode}`
    )
  }
  if (expectation.stdoutContains) {
    for (const expected of expectation.stdoutContains) {
      if (!result.stdout.includes(expected)) {
        return error(`stdout should contain "${expected}"`)
      }
    }
  }
  if (expectation.stderrContains) {
    for (const expected of expectation.stderrContains) {
      if (!result.stderr.includes(expected)) {
        return error(`stderr should contain "${expected}"`)
      }
    }
  }
  return success(undefined)
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

const formatDiffLines = (kindCompared: string, runnerCompared: string): string[] => {
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
      `[kind] ${line.kind}`,
      `[runner-simulation] ${line.runnerSimulation}`
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
  runner: CommandExecutionResult,
  compareMode: CompareMode
): ConformanceComparison => {
  const kindCompared =
    compareMode === 'raw' ? kind.combined : normalizeOutput(kind.combined)
  const runnerCompared =
    compareMode === 'raw' ? runner.combined : normalizeOutput(runner.combined)
  if (compareMode === 'none') {
    return {
      matched: true,
      kindCompared,
      runnerCompared,
      diff: ''
    }
  }
  const outputMatches = kindCompared === runnerCompared
  const exitCodeMatches = kind.exitCode === runner.exitCode
  return {
    matched: outputMatches && exitCodeMatches,
    kindCompared,
    runnerCompared,
    diff: outputMatches && exitCodeMatches ? '' : diff(kindCompared, runnerCompared)
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

const appendExpectationError = (
  suiteName: string,
  action: CommandAction,
  backend: 'kind' | 'runner',
  message: string
): string => {
  return [
    `[suite] ${suiteName}`,
    `[action] ${action.id} (${action.type})`,
    `[command] ${truncate(action.command, MAX_COMMAND_LENGTH)}`,
    `[expectation:${backend}] ${message}`,
    '---'
  ].join('\n')
}

export const runConformanceSuite = (
  suite: ConformanceSuite,
  dependencies?: {
    kindExecutor?: KindExecutor
    runnerExecutor?: RunnerExecutor
    reporter?: ReturnType<typeof createConformanceReporter>
  }
): Result<void, string> => {
  const kindExecutor =
    dependencies?.kindExecutor ?? createKindExecutor(suite.clusterName)
  const reporter = dependencies?.reporter ?? createConformanceReporter()

  const setupResult = kindExecutor.setup()
  if (!setupResult.ok) {
    return error(setupResult.error)
  }

  const runnerExecutor = dependencies?.runnerExecutor ?? createRunnerExecutor()

  try {
    for (const action of suite.actions) {
      const { kind, runner } = executeAction(action, kindExecutor, runnerExecutor)

      reporter.recordKind(createRecord(suite.name, action, 'kind', kind))
      reporter.recordRunner(createRecord(suite.name, action, 'runner', runner))

      if (action.type === 'command') {
        const kindExpectation = checkExpectation(kind, action.expectKind)
        if (!kindExpectation.ok) {
          reporter.recordDiff(
            appendExpectationError(
              suite.name,
              action,
              'kind',
              kindExpectation.error
            )
          )
          if (suite.stopOnMismatch ?? true) {
            reporter.flush()
            return error(kindExpectation.error)
          }
        }
        const runnerExpectation = checkExpectation(runner, action.expectRunner)
        if (!runnerExpectation.ok) {
          reporter.recordDiff(
            appendExpectationError(
              suite.name,
              action,
              'runner',
              runnerExpectation.error
            )
          )
          if (suite.stopOnMismatch ?? true) {
            reporter.flush()
            return error(runnerExpectation.error)
          }
        }
      }

      const compareMode =
        action.type === 'command' ? action.compareMode || 'normalized' : 'normalized'
      const comparison = compareResults(kind, runner, compareMode)
      if (!comparison.matched) {
        reporter.recordDiff(appendMismatch(suite.name, action, kind, runner, comparison))
        if (suite.stopOnMismatch ?? true) {
          reporter.flush()
          return error(
            `[${action.id}] output mismatch between kind and runner.\n${comparison.diff}`
          )
        }
      }
    }
  } finally {
    const teardownResult = kindExecutor.teardown()
    if (!teardownResult.ok) {
      reporter.recordDiff(`[teardown] ${teardownResult.error}`)
    }
    reporter.flush()
  }

  return success(undefined)
}
