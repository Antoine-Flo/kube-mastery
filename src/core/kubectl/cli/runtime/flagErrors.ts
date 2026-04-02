import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { KubectlCommandSpec, KubectlFlagSpec } from '../model'
import { KUBECTL_ROOT_COMMAND_SPEC } from '../registry/root'
import { resolveKubectlCommand } from './resolve'
import { tokenizeInput } from './tokenize'

const stripFlagValue = (token: string): string => {
  const equalsIndex = token.indexOf('=')
  if (equalsIndex === -1) {
    return token
  }
  return token.slice(0, equalsIndex)
}

const getCommandTokensBeforeFlags = (tokens: readonly string[]): string[] => {
  const commandTokens: string[] = []
  for (const token of tokens) {
    if (token.startsWith('-')) {
      break
    }
    commandTokens.push(token)
  }
  return commandTokens
}

const collectAllowedFlags = (
  command: KubectlCommandSpec
): {
  byLong: Map<string, KubectlFlagSpec>
  byShort: Map<string, KubectlFlagSpec>
} => {
  const byLong = new Map<string, KubectlFlagSpec>()
  const byShort = new Map<string, KubectlFlagSpec>()
  const allFlags = [...KUBECTL_ROOT_COMMAND_SPEC.flags, ...command.flags]
  for (const flag of allFlags) {
    byLong.set(flag.name, flag)
    if (flag.short != null && flag.short.length > 0) {
      byShort.set(flag.short, flag)
    }
  }
  return { byLong, byShort }
}

const formatUnknownLongFlagError = (
  commandPath: readonly string[],
  flagToken: string
): string => {
  const helpCommand = commandPath.length > 0 ? `kubectl ${commandPath.join(' ')}` : 'kubectl'
  return `error: unknown flag: ${flagToken}\nSee '${helpCommand} --help' for usage.`
}

const formatUnknownShortFlagError = (
  commandPath: readonly string[],
  shorthand: string,
  sourceToken: string
): string => {
  const helpCommand = commandPath.length > 0 ? `kubectl ${commandPath.join(' ')}` : 'kubectl'
  return `error: unknown shorthand flag: '${shorthand}' in ${sourceToken}\nSee '${helpCommand} --help' for usage.`
}

const detectUnknownFlags = (
  tokens: readonly string[],
  command: KubectlCommandSpec
): Result<void> => {
  const { byLong, byShort } = collectAllowedFlags(command)

  for (const token of tokens) {
    if (token === '--') {
      break
    }
    if (!token.startsWith('-')) {
      continue
    }

    if (token.startsWith('--')) {
      const rawLongToken = stripFlagValue(token)
      const longName = rawLongToken.slice(2)
      if (longName.length === 0) {
        continue
      }
      if (!byLong.has(longName)) {
        return error(formatUnknownLongFlagError(command.path, rawLongToken))
      }
      continue
    }

    const shorthandSequence = token.slice(1)
    if (shorthandSequence.length === 0) {
      continue
    }

    for (let index = 0; index < shorthandSequence.length; index++) {
      const shorthand = shorthandSequence[index]
      const matchedFlag = byShort.get(shorthand)
      if (matchedFlag == null) {
        return error(formatUnknownShortFlagError(command.path, shorthand, token))
      }
      const consumesValue = matchedFlag.kind !== 'boolean'
      if (consumesValue) {
        break
      }
    }
  }

  return success(undefined)
}

export const validateUnknownFlagsBySpec = (input: string): Result<void> => {
  const tokens = tokenizeInput(input)
  if (tokens.length === 0 || tokens[0] !== 'kubectl') {
    return success(undefined)
  }

  const commandTokens = getCommandTokensBeforeFlags(tokens)
  const resolved = resolveKubectlCommand(KUBECTL_ROOT_COMMAND_SPEC, commandTokens)
  if (resolved == null || resolved.command.path.length === 0) {
    return success(undefined)
  }
  const hasUnresolvedCommandTokens = resolved.consumedTokens < commandTokens.length
  if (hasUnresolvedCommandTokens && resolved.command.subcommands.length > 0) {
    return success(undefined)
  }

  return detectUnknownFlags(tokens.slice(1), resolved.command)
}

