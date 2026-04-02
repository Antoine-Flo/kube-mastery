import type { KubectlCommandSpec } from '../model'

export const matchesCommandToken = (
  command: KubectlCommandSpec,
  token: string
): boolean => {
  const canonicalName = command.path[command.path.length - 1]
  if (canonicalName === token) {
    return true
  }
  if (command.aliases == null) {
    return false
  }
  return command.aliases.includes(token)
}
