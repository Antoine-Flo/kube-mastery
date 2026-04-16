import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'
import type { ShellCommandIO } from '../../core/types'

const countNewlineCharacters = (content: string): number => {
  let lineCount = 0
  for (const char of content) {
    if (char === '\n') {
      lineCount += 1
    }
  }
  return lineCount
}

const formatSingleCount = (
  lineCount: number,
  filePath?: string
): string => {
  if (filePath == null) {
    return `${lineCount}`
  }
  return `${lineCount} ${filePath}`
}

export const createWcHandler = (fileSystem: FileSystem): ShellCommandHandler => {
  return {
    execute: (
      args: string[],
      flags: Record<string, boolean | string>,
      io?: ShellCommandIO
    ): ExecutionResult => {
      const supportsLineCountOnly =
        Object.keys(flags).every((flagName) => {
          return flagName === 'l' || flagName === 'lines'
        }) && (Object.keys(flags).length === 0 || flags.l === true || flags.lines === true)

      if (!supportsLineCountOnly) {
        return error('wc: only line count is supported, use wc -l')
      }

      if (args.length === 0) {
        if (io?.stdin == null) {
          return error('wc: no input source (pipe or file)')
        }
        return success(formatSingleCount(countNewlineCharacters(io.stdin)))
      }

      const renderedCounts: string[] = []
      for (const filePath of args) {
        const readResult = fileSystem.readFile(filePath)
        if (!readResult.ok) {
          return error(readResult.error)
        }
        const lineCount = countNewlineCharacters(readResult.value)
        renderedCounts.push(formatSingleCount(lineCount, filePath))
      }
      return success(renderedCounts.join('\n'))
    }
  }
}
