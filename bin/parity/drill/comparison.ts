import {
  normalizeForParityMatch,
  normalizeKubectlCommandStderrForParity,
  normalizeKubectlCommandStdoutForParity,
  normalizeStdStreamsForParity,
  stripDynamicAgeValuesForParity
} from '../kubectl/surface'
import type { CommandExecutionResult } from '../../lib/conformance-types'

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

const normalizeStdout = (
  command: string,
  value: string,
  stripAgeValues: boolean
): string => {
  const normalized = normalizeForParityMatch(
    normalizeKubectlCommandStdoutForParity(command, value)
  )
  if (stripAgeValues) {
    return stripDynamicAgeValuesForParity(normalized)
  }
  return normalized
}

const normalizeStderr = (command: string, value: string): string => {
  return normalizeForParityMatch(
    normalizeKubectlCommandStderrForParity(command, value)
  )
}

export const compareStepResults = (
  command: string,
  simulationResult: CommandExecutionResult,
  kindResult: CommandExecutionResult,
  stripAgeValues: boolean
): DrillStepComparison => {
  const simulationIo = normalizeStdStreamsForParity(
    simulationResult.stdout,
    simulationResult.stderr
  )
  const kindIo = normalizeStdStreamsForParity(kindResult.stdout, kindResult.stderr)
  const normalizedSimulationStdout = normalizeStdout(
    command,
    simulationIo.stdout,
    stripAgeValues
  )
  const normalizedKindStdout = normalizeStdout(command, kindIo.stdout, stripAgeValues)
  const normalizedSimulationStderr = normalizeStderr(command, simulationIo.stderr)
  const normalizedKindStderr = normalizeStderr(command, kindIo.stderr)

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
