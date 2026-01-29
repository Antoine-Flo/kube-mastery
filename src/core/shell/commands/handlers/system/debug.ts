// ═══════════════════════════════════════════════════════════════════════════
// DEBUG COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Debug commands (simplified version without logger for now).

import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createDebugHandler = (): ShellCommandHandler => {
    return {
        execute: (args: string[]): ExecutionResult => {
            const subcommand = args[0]

            if (!subcommand) {
                const usageText = `Debug commands:
  debug logs      Show application logs (last 50 entries)
  debug clear     Clear application logs

Usage: debug <subcommand>`

                return success(usageText)
            }

            // TODO: Implement debug logs and clear when logger is migrated
            if (subcommand === 'logs') {
                return success('Debug logs not available yet (logger migration pending).')
            }

            if (subcommand === 'clear') {
                return success('Application logs cleared.')
            }

            // Unknown subcommand
            return error(`Unknown debug subcommand: ${subcommand}`)
        }
    }
}
