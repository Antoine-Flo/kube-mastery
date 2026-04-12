/**
 * In-place: common shell alias `k` -> `kubectl` for downstream token checks.
 */
export const applyKubectlCliAliases = (tokens: string[]): void => {
  if (tokens.length > 0 && tokens[0] === 'k') {
    tokens[0] = 'kubectl'
  }
}

export const tokenizeInput = (input: string): string[] => {
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
  applyKubectlCliAliases(tokens)
  return tokens
}
