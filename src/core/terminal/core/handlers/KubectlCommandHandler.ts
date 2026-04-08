// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Terminal entry for kubectl: delegates to runKubectlInTerminal (see
// src/core/terminal/kubectl/).

import type { ExecutionResult } from '../../../shared/result'
import { runKubectlInTerminal } from '../../kubectl/runKubectlInTerminal'
import type { CommandContext } from '../CommandContext'
import type { CommandHandler } from '../CommandHandler'

export class KubectlCommandHandler implements CommandHandler {
  canHandle(command: string): boolean {
    const trimmed = command.trim()
    return trimmed === 'kubectl' || trimmed.startsWith('kubectl ')
  }

  execute(command: string, context: CommandContext): ExecutionResult {
    return runKubectlInTerminal(command, context)
  }
}
