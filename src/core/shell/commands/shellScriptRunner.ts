// ═══════════════════════════════════════════════════════════════════════════
// SEQUENTIAL SHELL SCRIPT (container / exec one-shot)
// ═══════════════════════════════════════════════════════════════════════════
// Runs multiple lines through the same ShellCommandExecutor (registry-driven).
// No full POSIX shell: rejects common chaining operators.

import type { ExecutionResult } from '../../shared/result'
import { error, success } from '../../shared/result'
import { stripMatchingQuotes } from '../../shared/parsing'
import type { ShellCommandExecutor } from './core/ShellCommandExecutor'

const splitByAndAnd = (line: string): string[] => {
  const chunks: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      current += char
      continue
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      current += char
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '&' && next === '&') {
      chunks.push(current.trim())
      current = ''
      index += 1
      continue
    }

    current += char
  }

  chunks.push(current.trim())
  return chunks.filter((chunk) => {
    return chunk.length > 0
  })
}

const hasUnsupportedSyntax = (line: string): boolean => {
  let inSingleQuote = false
  let inDoubleQuote = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (inSingleQuote || inDoubleQuote) {
      continue
    }
    if (char === '|' && next === '|') {
      return true
    }
    if (char === '|' || char === ';' || char === '`') {
      return true
    }
    if (char === '$' && next === '(') {
      return true
    }
  }
  return false
}

export const parseSequentialShellScript = (
  script: string
): ExecutionResult & { commands?: string[] } => {
  const lines = script
    .split('\n')
    .map((line) => {
      return stripMatchingQuotes(line.trim())
    })
    .filter((line) => {
      return line.length > 0
    })

  if (lines.length === 0) {
    return {
      ok: true,
      value: '',
      commands: []
    }
  }

  const commands: string[] = []
  for (const line of lines) {
    if (hasUnsupportedSyntax(line)) {
      return error(
        'unsupported shell syntax: use one command per line, && is allowed, but || | ; and command substitution are not supported'
      )
    }
    const chunks = splitByAndAnd(line)
    if (chunks.length === 0) {
      continue
    }
    commands.push(...chunks)
  }

  return {
    ok: true,
    value: '',
    commands
  }
}

/**
 * Execute a script string as one or more lines (newline-separated).
 * Each non-empty line is parsed and executed via the given executor.
 */
export const executeSequentialShellScript = (
  executor: ShellCommandExecutor,
  script: string
): ExecutionResult => {
  const parsed = parseSequentialShellScript(script)
  if (!parsed.ok) {
    return parsed
  }
  const commands = parsed.commands ?? []
  if (commands.length === 0) {
    return success('')
  }

  const outputChunks: string[] = []
  for (const command of commands) {
    const result = executor.execute(command)
    if (!result.ok) {
      return result
    }
    if (result.value.length > 0) {
      outputChunks.push(result.value)
    }
  }

  return success(outputChunks.join('\n'))
}
