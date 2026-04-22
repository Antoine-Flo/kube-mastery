import type { CommandExecutionResult } from '../../lib/execution-types'

export type DrillMismatchCategory =
  | 'exit_code'
  | 'output_wording'
  | 'resource_state'
  | 'timing_readiness'
  | 'filesystem_state'

export interface DrillStepComparison {
  matched: boolean
  categories: DrillMismatchCategory[]
  normalizedSimulationStdout: string
  normalizedKindStdout: string
  normalizedSimulationStderr: string
  normalizedKindStderr: string
}

const containsReadinessSignal = (value: string): boolean => {
  const lowered = value.toLowerCase()
  return (
    lowered.includes('pending') ||
    lowered.includes('containercreating') ||
    lowered.includes('condition met') ||
    lowered.includes('timed out waiting')
  )
}

export const compareStepResults = (
  _command: string,
  simulationResult: CommandExecutionResult,
  kindResult: CommandExecutionResult
): DrillStepComparison => {
  const normalizedSimulationStdout = simulationResult.stdout
  const normalizedKindStdout = kindResult.stdout
  const normalizedSimulationStderr = simulationResult.stderr
  const normalizedKindStderr = kindResult.stderr

  const sameExitCode = simulationResult.exitCode === kindResult.exitCode
  const sameStdout = normalizedSimulationStdout === normalizedKindStdout
  const sameStderr = normalizedSimulationStderr === normalizedKindStderr
  const matched = sameExitCode && sameStdout && sameStderr
  if (matched) {
    return {
      matched: true,
      categories: [],
      normalizedSimulationStdout,
      normalizedKindStdout,
      normalizedSimulationStderr,
      normalizedKindStderr
    }
  }

  const categories: DrillMismatchCategory[] = []
  if (!sameExitCode) {
    categories.push('exit_code')
  }
  if (!sameStdout || !sameStderr) {
    const readinessSignalFound =
      containsReadinessSignal(normalizedSimulationStdout) ||
      containsReadinessSignal(normalizedKindStdout) ||
      containsReadinessSignal(normalizedSimulationStderr) ||
      containsReadinessSignal(normalizedKindStderr)
    if (readinessSignalFound) {
      categories.push('timing_readiness')
    } else {
      categories.push('output_wording')
    }
  }

  return {
    matched,
    categories,
    normalizedSimulationStdout,
    normalizedKindStdout,
    normalizedSimulationStderr,
    normalizedKindStderr
  }
}
