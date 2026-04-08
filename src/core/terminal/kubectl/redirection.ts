import type { ExecutionResult } from '../../shared/result'
import { error } from '../../shared/result'

export type ParsedRedirection = {
  command: string
  outputFile?: string
}

export type ParseRedirectionResult = ExecutionResult & {
  parsed?: ParsedRedirection
}

export const parseKubectlOutputRedirection = (
  command: string
): ParseRedirectionResult => {
  const trimmed = command.trim()
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaping = false
  const redirectIndexes: number[] = []
  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index]
    if (escaping) {
      escaping = false
      continue
    }
    if (char === '\\') {
      escaping = true
      continue
    }
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (char === '>' && !inSingleQuote && !inDoubleQuote) {
      redirectIndexes.push(index)
    }
  }

  if (redirectIndexes.length === 0) {
    return {
      ok: true,
      value: '',
      parsed: {
        command: trimmed
      }
    }
  }

  if (redirectIndexes.length !== 1) {
    return error('unsupported output redirection syntax')
  }

  const redirectIndex = redirectIndexes[0]
  const commandPart = trimmed.slice(0, redirectIndex).trim()
  const outputFile = trimmed.slice(redirectIndex + 1).trim()

  if (commandPart.length === 0) {
    return error('missing kubectl command before output redirection')
  }
  if (outputFile.length === 0) {
    return error('missing output file after redirection operator')
  }
  if (outputFile.includes(' ')) {
    return error('output redirection supports only one target file')
  }

  return {
    ok: true,
    value: '',
    parsed: {
      command: commandPart,
      outputFile
    }
  }
}

export const stripInlineShellComment = (command: string): string => {
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaping = false
  for (let index = 0; index < command.length; index++) {
    const char = command[index]
    if (escaping) {
      escaping = false
      continue
    }
    if (char === '\\') {
      escaping = true
      continue
    }
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (char === '#' && !inSingleQuote && !inDoubleQuote) {
      return command.slice(0, index).trimEnd()
    }
  }
  return command
}
