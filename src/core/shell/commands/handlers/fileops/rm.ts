// ═══════════════════════════════════════════════════════════════════════════
// RM COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Removes files or directories (with -r flag).

import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createRmHandler = (
  fileSystem: FileSystem
): ShellCommandHandler => {
  return {
    execute: (
      args: string[],
      flags: Record<string, boolean | string>
    ): ExecutionResult => {
      // Determine targets to delete
      const targets: string[] = []

      if (typeof flags.r === 'string') {
        // -r flag with value
        targets.push(flags.r)
      } else {
        // Use all args (realistic shell behavior)
        targets.push(...args)
      }

      if (targets.length === 0) {
        return error('rm: missing operand')
      }

      // Delete all specified targets (realistic shell behavior)
      // If -r flag is present, delete as directories, otherwise as files
      const deleteFn = flags.r
        ? fileSystem.deleteDirectory
        : fileSystem.deleteFile

      for (const target of targets) {
        const result = deleteFn(target)
        if (!result.ok) {
          return error(result.error)
        }
      }

      return success('')
    }
  }
}
