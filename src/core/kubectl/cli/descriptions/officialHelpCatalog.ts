import { GENERATED_OFFICIAL_KUBECTL_HELP_CATALOG } from './generatedOfficialHelpCatalog'

const normalizeSpaces = (input: string): string => {
  return input.trim().replace(/\s+/g, ' ')
}

const commandPathToKey = (commandPath: readonly string[]): string => {
  if (commandPath.length === 0) {
    return 'kubectl'
  }
  return `kubectl ${commandPath.join(' ')}`
}

export const getOfficialHelpForCommandPath = (
  commandPath: readonly string[]
): string | undefined => {
  const key = normalizeSpaces(commandPathToKey(commandPath))
  return GENERATED_OFFICIAL_KUBECTL_HELP_CATALOG[key]
}

