// ═══════════════════════════════════════════════════════════════════════════
// SHELL COMMAND HANDLER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════
// Interface for shell command handlers.
// Each handler implements this interface to execute a specific command.

import type { ExecutionResult } from '../../../shared/result'

export interface ShellCommandHandler {
    execute(args: string[], flags: Record<string, boolean | string>): ExecutionResult
}
