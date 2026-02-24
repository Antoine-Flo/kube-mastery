// ═══════════════════════════════════════════════════════════════════════════
// HELP COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Displays available shell commands.

import type { ExecutionResult } from '../../../../shared/result'
import { success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createHelpHandler = (): ShellCommandHandler => {
  return {
    execute: (): ExecutionResult => {
      const helpText = `Available shell commands:
  cd <path>       Change directory
  ls [path]       List directory contents
  ls -l [path]    List with details
  pwd             Print working directory
  mkdir <name>    Create directory
  touch <file>    Create empty file
  cat <file>      Display file contents
  nano <file>     Edit file with YAML editor
  vi <file>       Edit file with YAML editor (alias)
  vim <file>      Edit file with YAML editor (alias)
  rm <file>       Remove file
  rm -r <dir>     Remove directory
  clear           Clear terminal
  help            Show this help

Use 'kubectl' prefix for Kubernetes commands`

      return success(helpText)
    }
  }
}
