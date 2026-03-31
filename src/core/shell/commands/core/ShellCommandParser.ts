// ═══════════════════════════════════════════════════════════════════════════
// SHELL COMMAND PARSER
// ═══════════════════════════════════════════════════════════════════════════
// Parses shell command strings into structured objects with args and flags.
// Validates commands against allowed list and extracts boolean/value flags.
//
// Uses Railway-oriented programming (pipeResult) for clean pipeline composition.
// Each step transforms a ParseContext and can fail, stopping the pipeline.

import { extract, pipeResult, tokenize, trim } from '../../../shared/parsing'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedShellCommand, ShellCommand } from './types'

type ParsedFlags = Record<string, string | boolean>

// ─── Types ───────────────────────────────────────────────────────────────

/**
 * Internal parsing context that accumulates state through the pipeline
 */
type ParseContext = {
  input: string
  tokens?: string[]
  command?: ShellCommand
  args?: string[]
  flags?: Record<string, string | boolean>
}

// ─── Constants ───────────────────────────────────────────────────────────

export const VALID_COMMANDS: ShellCommand[] = [
  'cd',
  'ls',
  'pwd',
  'sleep',
  'mkdir',
  'touch',
  'cat',
  'rm',
  'clear',
  'help',
  'debug',
  'env',
  'nano',
  'vi',
  'vim',
  'nslookup',
  'curl',
  'exit'
]

/**
 * Parse flags for shell commands
 * All flags are treated as boolean flags
 * Supports combined flags: -la becomes { l: true, a: true }
 */
const parseShellFlags = (
  ctx: ParseContext
): Result<ParseContext & { flags: ParsedFlags }> => {
  if (!ctx.tokens) {
    return error('No tokens available')
  }

  const tokens = ctx.tokens
  const flags: ParsedFlags = {}
  let i = 1 // Start after command

  while (i < tokens.length) {
    const token = tokens[i]

    // Skip non-flag tokens (they will be extracted as args)
    if (!token.startsWith('-')) {
      i += 1
      continue
    }

    // Handle flags
    if (token.startsWith('--')) {
      // Long flag (--flag): treat as single flag
      const flagName = token.replace(/^--+/, '')
      flags[flagName] = true
    } else {
      // Short flag(s) (-a or -la): decompose combined flags
      const flagChars = token.replace(/^-+/, '')
      if (flagChars.length === 0) {
        // Just dashes (-- or ---): treat as empty flag
        flags[''] = true
      } else {
        // Decompose: -la becomes l and a
        for (const char of flagChars) {
          flags[char] = true
        }
      }
    }
    i += 1
  }

  return success({ ...ctx, flags })
}

/**
 * Extract args for shell commands
 * Skips all flags (which are all boolean) and extracts remaining tokens as args
 */
const extractShellArgs = (
  ctx: ParseContext
): Result<ParseContext & { args: string[] }> => {
  if (!ctx.tokens) {
    return error('No tokens available')
  }

  const tokens = ctx.tokens
  const args: string[] = []
  let i = 1 // Start after command

  while (i < tokens.length) {
    const token = tokens[i]

    // Skip flags (all flags are boolean, so just skip one token)
    if (token.startsWith('-')) {
      i += 1
      continue
    }

    // Non-flag token is an argument
    args.push(token)
    i += 1
  }

  return success({ ...ctx, args })
}

/**
 * Parse shell command string into structured object
 * Pure function using Railway-oriented programming (pipeResult)
 *
 * Pipeline: validate input → tokenize → extract command →
 *           parse flags → extract args → build result
 *
 * @param input - Raw command string (e.g., "ls -l", "cd /manifests")
 * @returns Parsed command or error
 */
export const parseShellCommand = (
  input: string
): Result<ParsedShellCommand> => {
  // Create the parsing pipeline
  const pipeline = pipeResult<ParseContext>(
    trim,
    tokenize,
    extract(0, VALID_COMMANDS, 'command', 'Unknown command'),
    parseShellFlags,
    extractShellArgs
  )

  // Execute pipeline
  const result = pipeline({ input })

  // Transform ParseContext result to ParsedShellCommand result
  if (!result.ok) {
    return result
  }

  const ctx = result.value
  if (!ctx.command || !ctx.args || !ctx.flags) {
    return error('Internal parsing error: incomplete context')
  }

  return success({
    command: ctx.command,
    args: ctx.args,
    flags: ctx.flags
  })
}
