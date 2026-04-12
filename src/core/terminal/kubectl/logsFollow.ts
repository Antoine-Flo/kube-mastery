import type { ParsedCommand } from '../../kubectl/commands/types'

export const LOGS_FOLLOW_POLL_INTERVAL_MS = 1000

export const isLogsFollowEnabled = (parsedCommand: ParsedCommand): boolean => {
  if (parsedCommand.action !== 'logs') {
    return false
  }
  if (parsedCommand.flags.follow === true) {
    return true
  }
  return parsedCommand.flags.f !== undefined
}

export const buildLogsFollowDeltaOutput = (
  previousOutput: string,
  nextOutput: string
): string => {
  if (nextOutput.length === 0) {
    return ''
  }

  if (previousOutput.length === 0) {
    return nextOutput
  }

  const previousLines = previousOutput
    .split('\n')
    .filter((line) => line.length > 0)
  const nextLines = nextOutput.split('\n').filter((line) => line.length > 0)

  if (nextLines.length <= previousLines.length) {
    return ''
  }

  const sharedLength = Math.min(previousLines.length, nextLines.length)
  let firstChangedIndex = sharedLength

  for (let index = 0; index < sharedLength; index++) {
    if (previousLines[index] !== nextLines[index]) {
      firstChangedIndex = index
      break
    }
  }
  const newLines = nextLines.slice(firstChangedIndex)
  if (newLines.length === 0) {
    return ''
  }
  return newLines.join('\n')
}
