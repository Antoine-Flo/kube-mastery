import { tokenizeInput } from '../../kubectl/cli/runtime/tokenize'

const HELP_FLAGS = new Set(['-h', '--help'])

export const isKubectlHelpRequest = (command: string): boolean => {
  const tokens = tokenizeInput(command)

  if (tokens.length === 0 || tokens[0] !== 'kubectl') {
    return false
  }

  for (const token of tokens) {
    if (HELP_FLAGS.has(token)) {
      return true
    }
  }

  return false
}
