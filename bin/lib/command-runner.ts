import { spawnSync } from 'child_process'
import type { Result } from './types'
import { error, success } from './types'

/**
 * Run a kubectl command and return its output.
 * Uses spawnSync to capture both stdout and stderr: some kubectl versions
 * write "No resources found" to stderr and/or use non-zero exit for empty lists.
 * We always return the combined output so the conformance comparison never sees empty.
 */
export const runKubectlCommand = (command: string): Result<string, string> => {
  const result = spawnSync(command, {
    encoding: 'utf-8',
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const stdout = (result.stdout ?? '').trim()
  const stderr = (result.stderr ?? '').trim()
  const combined = stdout && stderr ? `${stdout}\n${stderr}` : stdout || stderr

  if (result.status !== 0 && !combined) {
    return error(result.error?.message ?? `Exit code ${result.status}`)
  }
  return success(combined || '')
}
