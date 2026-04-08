import type { FileSystem } from '../../../../filesystem/FileSystem'
import { stripMatchingQuotes } from '../../../../shared/parsing'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

const normalizeEchoArg = (value: string): string => {
  return stripMatchingQuotes(value)
}

export const createEchoHandler = (
  fileSystem: FileSystem
): ShellCommandHandler => {
  return {
    execute: (args: string[], flags): ExecutionResult => {
      const redirectIndex = args.findIndex((arg) => {
        return arg === '>' || arg === '>>'
      })

      const appendMode = redirectIndex >= 0 && args[redirectIndex] === '>>'
      const hasNoTrailingNewline = flags.n === true
      const contentArgs =
        redirectIndex >= 0 ? args.slice(0, redirectIndex) : args
      const content = contentArgs
        .map((arg) => {
          return normalizeEchoArg(arg)
        })
        .join(' ')
      const outputContent = hasNoTrailingNewline ? content : content

      if (redirectIndex === -1) {
        return success(outputContent)
      }

      const filePath = args[redirectIndex + 1]
      if (filePath == null || filePath.length === 0) {
        return error('echo: missing file operand after redirection')
      }
      if (redirectIndex + 2 < args.length) {
        return error('echo: too many arguments after redirection target')
      }

      if (appendMode) {
        const existingContentResult = fileSystem.readFile(filePath)
        if (existingContentResult.ok) {
          const writeResult = fileSystem.writeFile(
            filePath,
            `${existingContentResult.value}${outputContent}`
          )
          if (!writeResult.ok) {
            return error(writeResult.error)
          }
          return success('')
        }
      }

      const writeResult = fileSystem.writeFile(filePath, outputContent)
      if (!writeResult.ok) {
        return error(writeResult.error)
      }

      return success('')
    }
  }
}
