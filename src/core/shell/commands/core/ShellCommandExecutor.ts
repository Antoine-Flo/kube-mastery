// ═══════════════════════════════════════════════════════════════════════════
// SHELL COMMAND EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════
// Orchestration de l'exécution des commandes shell.
// Utilise ShellCommandParser pour le parsing et route vers les handlers.
// Aucune dépendance au logger - logique pure testable.

import type { ExecutionResult } from '../../../shared/result'
import { error } from '../../../shared/result'
import type { ShellCommandHandler } from './ShellCommandHandler'
import { parseShellCommand } from './ShellCommandParser'
import type { ParsedShellCommand } from './types'

interface ShellCommandExecutorOptions {
  handlers: Map<string, ShellCommandHandler>
}

export class ShellCommandExecutor {
  private handlers: Map<string, ShellCommandHandler>

  constructor(options: ShellCommandExecutorOptions) {
    this.handlers = options.handlers
  }

  /**
   * Execute a shell command string
   * @param input - Raw command string (e.g., "ls -l", "cd /manifests")
   * @returns ExecutionResult with output or error
   */
  execute(input: string): ExecutionResult {
    const parseResult = parseShellCommand(input)

    if (!parseResult.ok) {
      // Enrich error message with full input for "Unknown command" errors
      const errorMessage = parseResult.error.startsWith('Unknown command')
        ? `Unknown command: ${input}`
        : parseResult.error
      return error(errorMessage)
    }

    return this.routeCommand(parseResult.value)
  }

  /**
   * Route parsed command to appropriate handler
   */
  private routeCommand(parsed: ParsedShellCommand): ExecutionResult {
    const { command, args, flags } = parsed
    const handler = this.handlers.get(command)

    if (!handler) {
      // This should never happen since parser validates commands
      return error(`Handler not found for command: ${command}`)
    }

    return handler.execute(args, flags)
  }
}

// Factory function pour simplifier l'usage
export const createShellCommandExecutor = (handlers: Map<string, ShellCommandHandler>): ShellCommandExecutor => {
  return new ShellCommandExecutor({ handlers })
}
