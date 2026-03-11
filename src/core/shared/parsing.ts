// ═══════════════════════════════════════════════════════════════════════════
// SHARED PARSING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
// Common parsing helpers for both kubectl and shell parsers.
// Philosophy: Like Unix getopt() - shared utilities, program-specific logic.

import { success, error, type Result } from './result'

// ─── Types ───────────────────────────────────────────────────────────────

type ParsedFlags = Record<string, string | boolean>

// ─── Pipeline Step Helpers ──────────────────────────────────────────────
// Generic helpers for parser pipeline steps

/**
 * Trim step for pipeline: trims ctx.input, returns error if empty
 * Works with any context that has an input field
 */
export const trim = <Ctx extends { input: string }>(ctx: Ctx): Result<Ctx> => {
  const trimmed = ctx.input.trim()
  if (!trimmed) {
    return error('Command cannot be empty')
  }
  return success({ ...ctx, input: trimmed })
}

/**
 * Tokenize step for pipeline: splits ctx.input into tokens, returns error if empty
 * Works with any context that has input field, adds tokens field
 */
export const tokenize = <Ctx extends { input: string }>(
  ctx: Ctx
): Result<Ctx & { tokens: string[] }> => {
  const input = ctx.input.trim()
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaping = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]

    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (char === '\\') {
      current += char
      escaping = true
      continue
    }

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

    if (!inSingleQuote && !inDoubleQuote && /\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current.length > 0) {
    tokens.push(current)
  }

  if (tokens.length === 0) {
    return error('Command cannot be empty')
  }
  return success({ ...ctx, tokens })
}

/**
 * Parse flags for pipeline
 */
export const parseFlags =
  <Ctx extends { tokens?: string[]; flags?: ParsedFlags }>(
    startIndex = 1,
    aliases?: Record<string, string>
  ) =>
  (
    ctx: Ctx
  ): Result<Ctx & { flags: ParsedFlags; normalizedFlags?: ParsedFlags }> => {
    if (!ctx.tokens) {
      return error('No tokens available')
    }

    const rawFlags = parseFlagsRaw(ctx.tokens, startIndex)
    // Merge with existing flags (e.g., from transformers)
    const mergedFlags = { ...ctx.flags, ...rawFlags }

    if (aliases) {
      const normalized = normalizeFlags(mergedFlags, aliases)
      return success({
        ...ctx,
        flags: mergedFlags,
        normalizedFlags: normalized
      })
    }

    return success({ ...ctx, flags: mergedFlags })
  }

// ─── Flag Parsing (low-level helpers) ────────────────────────────────────

/**
 * Parse flags from tokens array (raw, no normalization)
 * Flags start with - or --
 * Supports both value flags (-n default) and boolean flags (-A)
 * Also supports flags with = syntax (--namespaced=true)
 *
 * @param tokens - Array of tokens to parse
 * @param startIndex - Index to start parsing from (default: 0)
 * @returns Object with flags (key-value pairs)
 *
 * @example
 * parseFlagsRaw(["-n", "default", "--output", "yaml", "-A", "--namespaced=true"])
 * // => { n: "default", output: "yaml", A: true, namespaced: "true" }
 */
const parseFlagsRaw = (tokens: string[], startIndex = 0): ParsedFlags => {
  const flags: ParsedFlags = {}
  let i = startIndex

  while (i < tokens.length) {
    const token = tokens[i]

    // Skip non-flag tokens
    if (!token.startsWith('-')) {
      i += 1
      continue
    }

    // Check if flag has value with = (e.g., --namespaced=true)
    const equalsIndex = token.indexOf('=')
    if (equalsIndex !== -1) {
      const flagName = token.slice(0, equalsIndex).replace(/^-+/, '')
      const flagValue = token.slice(equalsIndex + 1)
      flags[flagName] = flagValue
      i += 1
      continue
    }

    // Regular flag (with or without separate value)
    const flagName = token.replace(/^-+/, '')
    const nextToken = tokens[i + 1]
    const nextIsValue = nextToken && !nextToken.startsWith('-')

    if (nextIsValue) {
      flags[flagName] = nextToken
      i += 2 // Skip both flag and value
    } else {
      flags[flagName] = true
      i += 1 // Skip just the flag
    }
  }

  return flags
}

/**
 * Normalize flag names from short aliases to long names
 * Pure function
 *
 * @param flags - Flags object to normalize
 * @param aliases - Mapping of short names to long names
 * @returns New flags object with normalized names
 *
 * @example
 * normalizeFlags({ n: "default", o: "yaml" }, { n: "namespace", o: "output" })
 * // => { namespace: "default", output: "yaml" }
 */
const normalizeFlags = (
  flags: ParsedFlags,
  aliases: Record<string, string>
): ParsedFlags => {
  const normalized: ParsedFlags = {}

  for (const [key, value] of Object.entries(flags)) {
    const longKey = aliases[key] || key
    normalized[longKey] = value
  }

  return normalized
}

// ─── Kubernetes Selector Parsing ─────────────────────────────────────────

/**
 * Parse Kubernetes label selector string into key-value pairs
 * Pure function
 *
 * @param selector - Selector string (e.g., "app=nginx,env=prod")
 * @returns Object with label key-value pairs
 *
 * @example
 * parseSelector("app=nginx,env=prod,tier=backend")
 * // => { app: "nginx", env: "prod", tier: "backend" }
 */
const stripMatchingQuotes = (raw: string): string => {
  const trimmed = raw.trim()
  if (trimmed.length < 2) {
    return trimmed
  }
  const startsWithDoubleQuote = trimmed.startsWith('"')
  const endsWithDoubleQuote = trimmed.endsWith('"')
  if (startsWithDoubleQuote && endsWithDoubleQuote) {
    return trimmed.slice(1, -1).trim()
  }
  const startsWithSingleQuote = trimmed.startsWith("'")
  const endsWithSingleQuote = trimmed.endsWith("'")
  if (startsWithSingleQuote && endsWithSingleQuote) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export const parseSelector = (selector: string): Record<string, string> => {
  const normalizedSelector = stripMatchingQuotes(selector)
  return normalizedSelector.split(',').reduce(
    (acc, pair) => {
      const [key, value] = pair.split('=')
      if (key && value) {
        const normalizedKey = stripMatchingQuotes(key)
        const normalizedValue = stripMatchingQuotes(value)
        if (normalizedKey.length > 0 && normalizedValue.length > 0) {
          acc[normalizedKey] = normalizedValue
        }
      }
      return acc
    },
    {} as Record<string, string>
  )
}

// ─── Function Composition ────────────────────────────────────────────────

/**
 * Compose functions that return Result types (Railway-oriented programming)
 * Stops at first error, otherwise continues the pipeline
 * Pure function
 *
 * @example
 * const parseCommand = pipeResult(
 *   validateInput,
 *   extractAction,
 *   validateAction,
 *   buildCommand
 * )
 *
 * const result = parseCommand(input)
 * // If any step returns error, pipeline stops and returns that error
 * // Otherwise, continues to the end
 */
export const pipeResult =
  <T, E = string>(...fns: Array<(arg: T) => Result<T, E>>) =>
  (input: T): Result<T, E> => {
    let current: Result<T, E> = { ok: true, value: input }

    for (const fn of fns) {
      if (!current.ok) {
        return current
      }
      current = fn(current.value)
    }

    return current
  }

// ─── Validation Helpers ──────────────────────────────────────────────────

/**
 * Extract and validate a token from tokens array
 * Generic helper for extracting commands, actions, resources, etc.
 *
 * @param tokenIndex - Index of the token to extract
 * @param validValues - Array of valid values for this token
 * @param fieldName - Name of the field to set in context
 * @param errorMsg - Error message if token invalid or missing
 */
export const extract =
  <Ctx extends { tokens?: string[] }, K extends string>(
    tokenIndex: number,
    validValues: readonly string[],
    fieldName: K,
    errorPrefix: string
  ) =>
  (ctx: Ctx): Result<Ctx & Record<K, string>> => {
    if (!ctx.tokens || ctx.tokens.length <= tokenIndex) {
      return error(errorPrefix)
    }

    const token = ctx.tokens[tokenIndex]

    if (!validValues.includes(token)) {
      return error(`${errorPrefix}: ${token}`)
    }

    return success({ ...ctx, [fieldName]: token } as Ctx & Record<K, string>)
  }

/**
 * Check flags for pipeline
 * Validates that flags requiring values have them
 *
 * @param flagsRequiringValues - Array of flag names that must have values
 */
export const checkFlags =
  <Ctx extends { flags?: ParsedFlags }>(flagsRequiringValues: string[] = []) =>
  (ctx: Ctx): Result<Ctx> => {
    if (!ctx.flags) {
      return success(ctx)
    }

    for (const flagName of flagsRequiringValues) {
      if (flagName in ctx.flags && ctx.flags[flagName] === true) {
        return error(`flag -${flagName} requires a value`)
      }
    }

    return success(ctx)
  }
