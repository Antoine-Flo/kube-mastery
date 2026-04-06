// ═══════════════════════════════════════════════════════════════════════════
// SEQUENTIAL SHELL SCRIPT (container / exec one-shot)
// ═══════════════════════════════════════════════════════════════════════════
// Runs multiple lines through the same ShellCommandExecutor (registry-driven).
// No full POSIX shell: rejects common chaining operators.

import type { ExecutionResult } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { ShellCommandExecutor } from './core/ShellCommandExecutor'

const lineHasUnsupportedSyntax = (line: string): boolean => {
  if (line.includes('&&') || line.includes('||')) {
    return true
  }
  if (line.includes('|')) {
    return true
  }
  if (line.includes(';')) {
    return true
  }
  if (line.includes('`')) {
    return true
  }
  if (line.includes('$(')) {
    return true
  }
  return false
}

/**
 * Execute a script string as one or more lines (newline-separated).
 * Each non-empty line is parsed and executed via the given executor.
 */
export const executeSequentialShellScript = (
  executor: ShellCommandExecutor,
  script: string
): ExecutionResult => {
  const lines = script
    .split('\n')
    .map((line) => {
      return line.trim()
    })
    .filter((line) => {
      return line.length > 0
    })

  if (lines.length === 0) {
    return success('')
  }

  const outputChunks: string[] = []
  for (const line of lines) {
    if (lineHasUnsupportedSyntax(line)) {
      return error(
        'unsupported shell syntax: use one command per line without && || | ; or command substitution'
      )
    }
    const result = executor.execute(line)
    if (!result.ok) {
      return result
    }
    if (result.value.length > 0) {
      outputChunks.push(result.value)
    }
  }

  return success(outputChunks.join('\n'))
}
