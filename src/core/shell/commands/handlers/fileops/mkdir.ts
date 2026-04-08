// ═══════════════════════════════════════════════════════════════════════════
// MKDIR COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Creates a directory.

import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createMkdirHandler = (
  fileSystem: FileSystem
): ShellCommandHandler => {
  return {
    execute: (
      args: string[],
      flags: Record<string, boolean | string>
    ): ExecutionResult => {
      const dirsToCreate: string[] = [...args]
      if (typeof flags.p === 'string') {
        dirsToCreate.unshift(flags.p)
      }
      if (dirsToCreate.length === 0) {
        return error('mkdir: missing operand')
      }
      const recursive = flags.p === true || typeof flags.p === 'string'
      for (const dirName of dirsToCreate) {
        const result = fileSystem.createDirectory(dirName, recursive)
        if (!result.ok) {
          return error(result.error)
        }
      }

      return success('')
    }
  }
}
