import type { ParsedCommand } from '../../commands/types'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { KubectlResolvedCommand } from '../model'
import { KUBECTL_ROOT_COMMAND_SPEC } from '../registry/root'
import { resolveKubectlCommand } from './resolve'
import { tokenizeInput } from './tokenize'

const validateHandlerBinding = (
  resolved: KubectlResolvedCommand
): Result<KubectlResolvedCommand> => {
  if (resolved.command.path.length === 0) {
    return success(resolved)
  }
  if (resolved.command.subcommands.length > 0) {
    return success(resolved)
  }
  if (resolved.command.handlerId == null) {
    return error(
      `No handler bound for command path: ${resolved.command.path.join(' ')}`
    )
  }
  return success(resolved)
}

/**
 * Resolve command path from the new command tree.
 * This function intentionally does not parse flags yet, it guarantees that
 * runtime execution only proceeds for commands represented in the spec.
 */
export const resolveCommandFromSpec = (
  input: string
): Result<KubectlResolvedCommand> => {
  const tokens = tokenizeInput(input)
  const resolved = resolveKubectlCommand(KUBECTL_ROOT_COMMAND_SPEC, tokens)
  if (resolved == null) {
    return error('Invalid or missing action')
  }
  return validateHandlerBinding(resolved)
}

/**
 * Adapter to keep compatibility with the existing ParsedCommand contract.
 * This can be used to assert command support before delegating to legacy parser.
 */
export const assertParsedCommandSupportedBySpec = (
  input: string,
  parsedCommand: ParsedCommand
): Result<ParsedCommand> => {
  const resolvedResult = resolveCommandFromSpec(input)
  if (!resolvedResult.ok) {
    return resolvedResult
  }
  const resolved = resolvedResult.value
  const expectedAction = resolved.command.handlerId
  if (expectedAction == null) {
    return success(parsedCommand)
  }
  if (parsedCommand.action === expectedAction) {
    return success(parsedCommand)
  }
  return error(
    `Parsed action "${parsedCommand.action}" is not aligned with command spec handler "${expectedAction}"`
  )
}
