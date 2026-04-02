export const tokenizeInput = (input: string): string[] => {
  return input
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
}
