import type { KubectlCommandSpec, KubectlResolvedCommand } from '../model'
import { matchesCommandToken } from './commandMatch'

const resolveFromChildren = (
  children: readonly KubectlCommandSpec[],
  tokens: readonly string[],
  consumed: number
): KubectlResolvedCommand | undefined => {
  const nextToken = tokens[consumed]
  if (nextToken == null) {
    return undefined
  }

  for (const child of children) {
    if (!matchesCommandToken(child, nextToken)) {
      continue
    }
    const nested = resolveFromChildren(child.subcommands, tokens, consumed + 1)
    if (nested != null) {
      return nested
    }
    return {
      command: child,
      consumedTokens: consumed + 1
    }
  }

  return undefined
}

export const resolveKubectlCommand = (
  root: KubectlCommandSpec,
  tokens: readonly string[]
): KubectlResolvedCommand | undefined => {
  if (tokens.length === 0 || tokens[0] !== 'kubectl') {
    return undefined
  }
  const resolved = resolveFromChildren(root.subcommands, tokens, 1)
  if (resolved != null) {
    return resolved
  }
  return {
    command: root,
    consumedTokens: 1
  }
}
