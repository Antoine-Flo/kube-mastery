// ═══════════════════════════════════════════════════════════════════════════
// SEQUENTIAL SHELL SCRIPT (container / exec one-shot)
// ═══════════════════════════════════════════════════════════════════════════
// Runs multiple lines through the same ShellCommandExecutor (registry-driven).
// No full POSIX shell: rejects common chaining operators.

import type { ExecutionResult } from '../../shared/result'
import { error, success } from '../../shared/result'
import { stripMatchingQuotes } from '../../shared/parsing'
import type { ShellCommandExecutor } from './core/ShellCommandExecutor'
import type { ShellScriptStep } from './core/types'

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
    if (char === ';' || char === '`') {
      return true
    }
    if (char === '$' && next === '(') {
      return true
    }
  }
  return false
}

const splitByPipe = (line: string): string[] => {
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
    if (!inSingleQuote && !inDoubleQuote && char === '|' && next !== '|') {
      chunks.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  chunks.push(current.trim())
  return chunks
}

const isInvalidPipelineChunk = (chunks: string[]): boolean => {
  return chunks.some((chunk) => {
    return chunk.length === 0
  })
}

const parseScriptStep = (
  chunk: string
): ExecutionResult & { step?: ShellScriptStep } => {
  const pipelineChunks = splitByPipe(chunk)
  if (isInvalidPipelineChunk(pipelineChunks)) {
    return error('unsupported shell syntax: invalid pipeline')
  }
  if (pipelineChunks.length === 1) {
    return {
      ok: true,
      value: '',
      step: {
        kind: 'single',
        command: pipelineChunks[0]
      }
    }
  }
  return {
    ok: true,
    value: '',
    step: {
      kind: 'pipeline',
      commands: pipelineChunks
    }
  }
}

export const parseSequentialShellScript = (
  script: string
): ExecutionResult & { steps?: ShellScriptStep[] } => {
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
      steps: []
    }
  }

  const steps: ShellScriptStep[] = []
  for (const line of lines) {
    if (hasUnsupportedSyntax(line)) {
      return error(
        'unsupported shell syntax: use one command per line, && and | are allowed, but || ; and command substitution are not supported'
      )
    }
    const chunks = splitByAndAnd(line)
    if (chunks.length === 0) {
      continue
    }
    for (const chunk of chunks) {
      const parsedStep = parseScriptStep(chunk)
      if (!parsedStep.ok || parsedStep.step == null) {
        return error(parsedStep.ok ? 'unsupported shell syntax' : parsedStep.error)
      }
      steps.push(parsedStep.step)
    }
  }

  return {
    ok: true,
    value: '',
    steps
  }
}

const executePipelineStep = (
  executor: ShellCommandExecutor,
  commands: string[]
): ExecutionResult => {
  let pipedInput = ''
  for (const command of commands) {
    const result = executor.execute(command, { stdin: pipedInput })
    if (!result.ok) {
      return result
    }
    pipedInput = result.value
  }
  return success(pipedInput)
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
  const steps = parsed.steps ?? []
  if (steps.length === 0) {
    return success('')
  }

  const outputChunks: string[] = []
  for (const step of steps) {
    const result =
      step.kind === 'single'
        ? executor.execute(step.command)
        : executePipelineStep(executor, step.commands)
    if (!result.ok) {
      return result
    }
    if (result.value.length > 0) {
      outputChunks.push(result.value)
    }
  }

  return success(outputChunks.join('\n'))
}
