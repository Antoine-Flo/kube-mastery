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
import type { ParsedShellCommand, ShellCommandIO } from './types'

export class ShellCommandExecutor {
  private handlers: Map<string, ShellCommandHandler>

  constructor(handlers: Map<string, ShellCommandHandler>) {
    this.handlers = handlers
  }

  /**
   * Execute a shell command string
   * @param input - Raw command string (e.g., "ls -l", "cd /manifests")
   * @returns ExecutionResult with output or error
   */
  execute(input: string, io: ShellCommandIO = {}): ExecutionResult {
    const registeredCommands = [...this.handlers.keys()]
    const parseResult = parseShellCommand(input, registeredCommands)

    if (!parseResult.ok) {
      return error(parseResult.error)
    }

    return this.routeCommand(parseResult.value, io)
  }

  /**
   * Route parsed command to appropriate handler
   */
  private routeCommand(
    parsed: ParsedShellCommand,
    io: ShellCommandIO
  ): ExecutionResult {
    const { command, args, flags } = parsed
    const handler = this.handlers.get(command)

    if (!handler) {
      // This should never happen since parser validates commands
      return error(`Handler not found for command: ${command}`)
    }

    return handler.execute(args, flags, io)
  }
}

// Factory function pour simplifier l'usage
export const createShellCommandExecutor = (
  handlers: Map<string, ShellCommandHandler>
): ShellCommandExecutor => {
  return new ShellCommandExecutor(handlers)
}
