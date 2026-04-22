import { spawnSync } from 'child_process'
import type { CommandExecutionResult } from './execution-types'

export const runShellCommandDetailed = (
  command: string
): CommandExecutionResult => {
  const result = spawnSync(command, {
    encoding: 'utf-8',
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const stdout = (result.stdout ?? '').trim()
  const stderr = (result.stderr ?? '').trim()
  const combined = stdout && stderr ? `${stdout}\n${stderr}` : stdout || stderr
  const exitCode = typeof result.status === 'number' ? result.status : 1

  return {
    command,
    exitCode,
    stdout,
    stderr,
    combined
  }
}

/**
 * Run a kubectl command and return its output.
 * Uses spawnSync to capture both stdout and stderr: some kubectl versions
 * write "No resources found" to stderr and/or use non-zero exit for empty lists.
 * We always return the combined output so the conformance comparison never sees empty.
 */
