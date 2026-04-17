import { err, ok, type Result as NeverthrowResult } from 'neverthrow'

// ═══════════════════════════════════════════════════════════════════════════
// SHARED RESULT TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════════════════
// Centralized discriminated unions and helper functions for error handling.
// Follows functional programming principles with pure factory functions.
//
// Philosophy: Unix-like - success = stdout, error = stderr

// ─── Core Result Types ───────────────────────────────────────────────────

/**
 * Generic Result type for operations that can succeed or fail
 * @template T - Success value type
 * @template E - Error message type (defaults to string)
 */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export interface ExecutionIO {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Result type for command execution (stdout/stderr)
 * Success = stdout, Error = stderr
 */
export type ExecutionResult =
  | { ok: true; value: string; io?: ExecutionIO }
  | { ok: false; error: string; io?: ExecutionIO }

// ─── Factory Functions ───────────────────────────────────────────────────

/**
 * Create a success result
 */
export const success = <T>(value: T): Result<T> => ({
  ok: true,
  value
})

export const successWithIO = (
  value: string,
  io: ExecutionIO
): ExecutionResult => ({
  ok: true,
  value,
  io
})

/**
 * Create an error result
 */
export const error = (message: string): Result<never> => ({
  ok: false,
  error: message
})

export const errorWithIO = (
  message: string,
  io: ExecutionIO
): ExecutionResult => ({
  ok: false,
  error: message,
  io
})

export const toNeverthrowResult = <T, E>(
  result: Result<T, E>
): NeverthrowResult<T, E> => {
  if (result.ok) {
    return ok(result.value)
  }
  return err(result.error)
}

export const fromNeverthrowResult = <T, E>(
  result: NeverthrowResult<T, E>
): Result<T, E> => {
  return result.match(
    (value) => {
      return { ok: true, value }
    },
    (errorValue) => {
      return { ok: false, error: errorValue }
    }
  )
}

export const executionResultFromNeverthrow = (
  result: NeverthrowResult<string, string>
): ExecutionResult => {
  return result.match(
    (value) => {
      return success(value)
    },
    (errorValue) => {
      return error(errorValue)
    }
  )
}
