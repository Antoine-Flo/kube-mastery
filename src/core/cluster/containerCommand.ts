// ═══════════════════════════════════════════════════════════════════════════
// CONTAINER COMMAND HELPERS
// ═══════════════════════════════════════════════════════════════════════════
// Shared logic to parse container command/args (e.g. sh -c "exit 1") for
// simulated exit codes and crash log generation.
import type { Pod } from './ressources/Pod'

type ContainerSpec = Pod['spec']['containers'][number]

function stripMatchingQuotes(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length < 2) {
    return trimmed
  }
  const startsWithDoubleQuote = trimmed.startsWith('"')
  const endsWithDoubleQuote = trimmed.endsWith('"')
  if (startsWithDoubleQuote && endsWithDoubleQuote) {
    return trimmed.slice(1, -1).trim()
  }
  const startsWithSingleQuote = trimmed.startsWith("'")
  const endsWithSingleQuote = trimmed.endsWith("'")
  if (startsWithSingleQuote && endsWithSingleQuote) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/**
 * Parse container command/args to detect a simulated exit code (e.g. sh -c "exit 1").
 * Used by PodLifecycleController for crash detection and by log generation for crash logs.
 */
export function getSimulatedCommandExitCode(
  container: ContainerSpec
): number | undefined {
  const command = container.command ?? []
  const args = container.args ?? []
  const parseExitCode = (script: string): number | undefined => {
    const normalizedScript = stripMatchingQuotes(script).trim()
    const exitMatch = normalizedScript.match(/^exit\s+(-?\d+)\s*$/)
    if (exitMatch == null) {
      return undefined
    }
    const parsed = Number.parseInt(exitMatch[1], 10)
    if (Number.isNaN(parsed)) {
      return undefined
    }
    return parsed
  }
  const isShellCommand = (value: string): boolean => {
    return value === 'sh' || value === '/bin/sh'
  }

  if (
    command.length > 0 &&
    isShellCommand(command[0]) &&
    args.length >= 2 &&
    args[0] === '-c'
  ) {
    return parseExitCode(args.slice(1).join(' '))
  }
  if (
    command.length === 0 &&
    args.length >= 3 &&
    isShellCommand(args[0]) &&
    args[1] === '-c'
  ) {
    return parseExitCode(args.slice(2).join(' '))
  }
  return undefined
}
