import type {
  KubectlCommandSpec,
  KubectlCompletionSuggestion,
  KubectlFlagSpec
} from '../model'
import { KUBECTL_ROOT_COMMAND_SPEC } from '../registry/root'
import { resolveKubectlCommand } from './resolve'
import { tokenizeInput } from './tokenize'

type CompletionContext = {
  line: string
  tokens: string[]
  currentToken: string
}

const getCurrentToken = (line: string): string => {
  if (line.endsWith(' ')) {
    return ''
  }
  const lastSpace = line.lastIndexOf(' ')
  if (lastSpace === -1) {
    return line
  }
  return line.slice(lastSpace + 1)
}

const matchesPrefix = (candidate: string, prefix: string): boolean => {
  if (prefix.length === 0) {
    return true
  }
  return candidate.startsWith(prefix)
}

const uniqueCompletion = (
  candidates: string[],
  prefix: string,
  suffix: string
): KubectlCompletionSuggestion[] => {
  const matches = candidates.filter((candidate) => matchesPrefix(candidate, prefix))
  if (matches.length !== 1) {
    return []
  }
  return [{ text: matches[0], suffix }]
}

const toCommandToken = (command: KubectlCommandSpec): string => {
  return command.path[command.path.length - 1]
}

const suggestSubcommands = (
  command: KubectlCommandSpec,
  prefix: string
): KubectlCompletionSuggestion[] => {
  const tokens = command.subcommands.map(toCommandToken)
  return uniqueCompletion(tokens, prefix, ' ')
}

const suggestFlags = (
  flags: readonly KubectlFlagSpec[],
  prefix: string
): KubectlCompletionSuggestion[] => {
  const names = flags
    .filter((flag) => !flag.hidden)
    .map((flag) => `--${flag.name}`)
  return names
    .filter((name) => matchesPrefix(name, prefix))
    .map((name) => ({
      text: name,
      suffix: name.endsWith('=') ? '' : ' '
    }))
}

const buildCompletionContext = (line: string): CompletionContext => {
  return {
    line,
    tokens: tokenizeInput(line),
    currentToken: getCurrentToken(line)
  }
}

export const completeKubectlFromSpec = (
  line: string
): KubectlCompletionSuggestion[] => {
  const context = buildCompletionContext(line)
  if (context.tokens.length === 0 || context.tokens[0] !== 'kubectl') {
    return []
  }

  const isActionPosition =
    context.tokens.length === 1 ||
    (context.tokens.length === 2 &&
      context.currentToken !== '' &&
      context.tokens[1] === context.currentToken)
  if (isActionPosition) {
    return suggestSubcommands(KUBECTL_ROOT_COMMAND_SPEC, context.currentToken)
  }

  const resolved = resolveKubectlCommand(KUBECTL_ROOT_COMMAND_SPEC, context.tokens)
  if (resolved == null) {
    return []
  }

  const command = resolved.command
  const isSubcommandPosition =
    command.subcommands.length > 0 &&
    (context.tokens.length === resolved.consumedTokens ||
      (context.tokens.length === resolved.consumedTokens + 1 &&
        context.currentToken === context.tokens[context.tokens.length - 1]))
  if (isSubcommandPosition) {
    return suggestSubcommands(command, context.currentToken)
  }

  if (context.currentToken.startsWith('-')) {
    return suggestFlags(command.flags, context.currentToken)
  }

  return []
}
