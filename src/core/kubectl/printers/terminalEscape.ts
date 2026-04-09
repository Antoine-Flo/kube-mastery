/**
 * Hook for kubectl-style terminal escaping (cli-runtime printers.WriteEscaped).
 * Simulation output currently matches prior unescaped strings; extend here when
 * parity with upstream escaping is required.
 */
export const escapeTerminalOutput = (value: string): string => {
  return value
}

export const writeEscaped = (
  append: (chunk: string) => void,
  value: string
): void => {
  append(escapeTerminalOutput(value))
}
