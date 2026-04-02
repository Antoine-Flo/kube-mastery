import { getOfficialHelpForCommandPath } from '../descriptions/officialHelpCatalog'
import { tokenizeInput } from './tokenize'

const HELP_FLAGS = new Set(['-h', '--help'])

const hasHelpFlag = (tokens: readonly string[]): boolean => {
  for (const token of tokens) {
    if (HELP_FLAGS.has(token)) {
      return true
    }
  }
  return false
}

const extractCommandPathBeforeFlags = (tokens: readonly string[]): string[] => {
  const commandPath: string[] = []
  for (let index = 1; index < tokens.length; index++) {
    const token = tokens[index]
    if (HELP_FLAGS.has(token)) {
      continue
    }
    if (token.startsWith('-')) {
      break
    }
    commandPath.push(token)
  }
  return commandPath
}

export const resolveKubectlHelpFromSpec = (input: string): string | undefined => {
  const tokens = tokenizeInput(input)
  if (tokens.length === 0 || tokens[0] !== 'kubectl') {
    return undefined
  }
  if (!hasHelpFlag(tokens)) {
    return undefined
  }

  const commandPath = extractCommandPathBeforeFlags(tokens)
  const officialHelp = getOfficialHelpForCommandPath(commandPath)
  return officialHelp
}
