import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'
import type { ShellCommandIO } from '../../core/types'

const doesLineMatch = (
  line: string,
  pattern: string,
  ignoreCase: boolean
): boolean => {
  if (!ignoreCase) {
    return line.includes(pattern)
  }
  return line.toLowerCase().includes(pattern.toLowerCase())
}

const formatMatchedLine = (
  line: string,
  lineNumber: number,
  filePath: string | undefined,
  showLineNumbers: boolean
): string => {
  if (filePath != null && showLineNumbers) {
    return `${filePath}:${lineNumber}:${line}`
  }
  if (filePath != null) {
    return `${filePath}:${line}`
  }
  if (showLineNumbers) {
    return `${lineNumber}:${line}`
  }
  return line
}

const grepInContent = (
  content: string,
  pattern: string,
  ignoreCase: boolean,
  showLineNumbers: boolean,
  filePath?: string
): string[] => {
  const lines = content.split('\n')
  const matches: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!doesLineMatch(line, pattern, ignoreCase)) {
      continue
    }
    matches.push(formatMatchedLine(line, index + 1, filePath, showLineNumbers))
  }
  return matches
}

const renderMatches = (matches: string[]): string => {
  if (matches.length === 0) {
    return ''
  }
  return `${matches.join('\n')}\n`
}

export const createGrepHandler = (
  fileSystem: FileSystem
): ShellCommandHandler => {
  return {
    execute: (
      args: string[],
      flags: Record<string, boolean | string>,
      io?: ShellCommandIO
    ): ExecutionResult => {
      if (args.length === 0) {
        return error('grep: missing search pattern')
      }

      const pattern = args[0]
      const targetFiles = args.slice(1)
      const ignoreCase = flags.i === true
      const showLineNumbers = flags.n === true

      if (targetFiles.length === 0) {
        if (io?.stdin == null) {
          return error('grep: no input source (pipe or file)')
        }
        const matches = grepInContent(
          io.stdin,
          pattern,
          ignoreCase,
          showLineNumbers
        )
        return success(renderMatches(matches))
      }

      const allMatches: string[] = []
      const prefixWithFileName = targetFiles.length > 1
      for (const filePath of targetFiles) {
        const readResult = fileSystem.readFile(filePath)
        if (!readResult.ok) {
          return error(readResult.error)
        }
        const fileMatches = grepInContent(
          readResult.value,
          pattern,
          ignoreCase,
          showLineNumbers,
          prefixWithFileName ? filePath : undefined
        )
        allMatches.push(...fileMatches)
      }

      return success(renderMatches(allMatches))
    }
  }
}
