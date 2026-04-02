import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { KubectlCommandSpec } from '../model'
import { KUBECTL_ROOT_COMMAND_SPEC } from '../registry/root'
import { matchesCommandToken } from './commandMatch'
import { tokenizeInput } from './tokenize'

const getParentCommandLabel = (parent: KubectlCommandSpec): string => {
  if (parent.path.length === 0) {
    return 'kubectl'
  }
  const canonicalPath = parent.path.join(' ')
  return canonicalPath.length > 0 ? `kubectl ${canonicalPath}` : 'kubectl'
}

export const validateUnknownCommandBySpec = (input: string): Result<void> => {
  const tokens = tokenizeInput(input)
  if (tokens.length === 0 || tokens[0] !== 'kubectl') {
    return success(undefined)
  }
  const firstCommandToken = tokens[1]
  if (firstCommandToken == null || firstCommandToken.startsWith('-')) {
    return success(undefined)
  }
  const topLevelMatch = KUBECTL_ROOT_COMMAND_SPEC.subcommands.find((subcommand) => {
    return matchesCommandToken(subcommand, firstCommandToken)
  })
  if (topLevelMatch == null) {
    const parentCommandLabel = getParentCommandLabel(KUBECTL_ROOT_COMMAND_SPEC)
    return error(`error: unknown command "${firstCommandToken}" for "${parentCommandLabel}"`)
  }
  return success(undefined)
}

