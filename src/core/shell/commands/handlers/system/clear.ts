// ═══════════════════════════════════════════════════════════════════════════
// CLEAR COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Clears the terminal (returns empty output - terminal handles clearing).

import type { ExecutionResult } from '../../../../shared/result'
import { success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createClearHandler = (): ShellCommandHandler => {
  return {
    execute: (): ExecutionResult => {
      // Return empty output - terminal will handle clearing
      return success('')
    }
  }
}
