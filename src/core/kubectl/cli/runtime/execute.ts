import type { ParsedCommand } from '../../commands/types'
import type { Result } from '../../../shared/result'
import { success } from '../../../shared/result'
import type { KubectlCommandRuntimeContext } from '../model'
import { resolveCommandFromSpec } from './parse'
import { tokenizeInput } from './tokenize'

export const runKubectlCommandHooks = (
  rawInput: string,
  parsed: ParsedCommand
): Result<void> => {
  const resolvedResult = resolveCommandFromSpec(rawInput)
  if (!resolvedResult.ok) {
    return resolvedResult
  }
  const command = resolvedResult.value.command
  const context: KubectlCommandRuntimeContext = {
    rawInput,
    tokens: tokenizeInput(rawInput),
    parsed
  }

  const completeHook = command.hooks?.complete
  if (completeHook != null) {
    const completeResult = completeHook(context)
    if (!completeResult.ok) {
      return completeResult
    }
  }

  const validateHook = command.hooks?.validate
  if (validateHook != null) {
    const validateResult = validateHook(context)
    if (!validateResult.ok) {
      return validateResult
    }
  }

  return success(undefined)
}
