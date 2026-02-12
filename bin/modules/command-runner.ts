// ═══════════════════════════════════════════════════════════════════════════
// COMMAND RUNNER
// ═══════════════════════════════════════════════════════════════════════════
// Execute kubectl commands and capture outputs

import { execSync } from 'child_process'
import type { Result } from '../utils/types'
import { error, success } from '../utils/types'

/**
 * Run a kubectl command and capture output
 * Returns stdout on success, stderr on error
 */
export const runKubectlCommand = (command: string): Result<string, string> => {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    return success(output)
  } catch (err: any) {
    // kubectl commands return non-zero exit code on error
    // Capture stderr or stdout (kubectl sometimes uses stdout for errors)
    const errorOutput =
      err.stderr || err.stdout || err.message || 'Unknown error'
    return error(errorOutput)
  }
}
