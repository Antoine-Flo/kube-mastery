// ═══════════════════════════════════════════════════════════════════════════
// CAT COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Displays file contents.

import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'
import type { ShellCommandIO } from '../../core/types'

export const createCatHandler = (
  fileSystem: FileSystem
): ShellCommandHandler => {
  const readFromFiles = (args: string[]): ExecutionResult => {
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

  return {
    execute: (args: string[], _flags, io?: ShellCommandIO): ExecutionResult => {
      if (args.length === 0) {
        if (io?.stdin != null) {
          return success(io.stdin)
        }
        return error('cat: missing file operand')
      }
      return readFromFiles(args)
    }
  }
}
