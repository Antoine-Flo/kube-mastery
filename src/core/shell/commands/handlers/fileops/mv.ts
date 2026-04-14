import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createMvHandler = (fileSystem: FileSystem): ShellCommandHandler => {
  return {
    execute: (args: string[]): ExecutionResult => {
      if (args.length === 0) {
        return error('mv: missing file operand')
      }
      if (args.length === 1) {
        return error(`mv: missing destination file operand after '${args[0]}'`)
      }
      if (args.length > 2) {
        return error('mv: extra operand')
      }

      const sourcePath = args[0]
      const destinationPath = args[1]
      const moveResult = fileSystem.movePath(sourcePath, destinationPath)
      if (!moveResult.ok) {
        return error(moveResult.error)
      }

      return success('')
    }
  }
}
