import { describe, expect, it } from 'vitest'
import { compareStepResults } from '../../../../../bin/parity/drill/comparison'
import type { CommandExecutionResult } from '../../../../../bin/lib/conformance-types'

const createResult = (
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string
): CommandExecutionResult => {
  return {
    command,
    exitCode,
    stdout,
    stderr,
    combined: stdout.length > 0 ? stdout : stderr
  }
}

describe('compareStepResults', () => {
  it('matches equivalent outputs', () => {
    const command = 'kubectl get pods'
    const simulationResult = createResult(command, 0, 'No resources found.', '')
    const kindResult = createResult(command, 0, 'No resources found.', '')
    const comparison = compareStepResults(
      command,
      simulationResult,
      kindResult,
      true
    )
    expect(comparison.matched).toBe(true)
    expect(comparison.categories).toEqual([])
  })

  it('detects exit code mismatches', () => {
    const command = 'kubectl get pod missing'
    const simulationResult = createResult(command, 0, '', '')
    const kindResult = createResult(command, 1, '', 'Error from server (NotFound)')
    const comparison = compareStepResults(
      command,
      simulationResult,
      kindResult,
      true
    )
    expect(comparison.matched).toBe(false)
    expect(comparison.categories).toContain('exit_code')
  })

  it('classifies readiness differences', () => {
    const command = 'kubectl wait --for=condition=Ready pod/x --timeout=60s'
    const simulationResult = createResult(command, 1, '', 'timed out waiting')
    const kindResult = createResult(command, 1, '', 'pod condition met')
    const comparison = compareStepResults(
      command,
      simulationResult,
      kindResult,
      true
    )
    expect(comparison.matched).toBe(false)
    expect(comparison.categories).toContain('timing_readiness')
  })
})
