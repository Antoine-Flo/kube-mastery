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

/**
 * Result type for command execution (stdout/stderr)
 * Success = stdout, Error = stderr
 */
export type ExecutionResult = Result<string>

// ─── Factory Functions ───────────────────────────────────────────────────

/**
 * Create a success result
 */
export const success = <T>(value: T): Result<T> => ({
    ok: true,
    value
})

/**
 * Create an error result
 */
export const error = (message: string): Result<never> => ({
    ok: false,
    error: message
})

