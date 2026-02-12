// ═══════════════════════════════════════════════════════════════════════════
// CAT COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Displays file contents.

import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createCatHandler = (
  fileSystem: FileSystem
): ShellCommandHandler => {
  return {
    execute: (args: string[]): ExecutionResult => {
      if (args.length === 0) {
        return error('cat: missing file operand')
      }

      // Concatenate all specified files
      const contents: string[] = []
      for (const filePath of args) {
        const result = fileSystem.readFile(filePath)
        if (!result.ok) {
          return error(result.error)
        }
        contents.push(result.value)
      }

      return success(contents.join(''))
    }
  }
}
