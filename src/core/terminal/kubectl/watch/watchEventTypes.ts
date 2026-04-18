import { getCurrentNamespaceFromKubeconfig } from '../../../kubectl/commands/handlers/config'
import { RESOURCE_KIND_BY_RESOURCE } from '../../../kubectl/commands/resourceCatalog.generated'
import type { ParsedCommand, Resource } from '../../../kubectl/commands/types'
import type { CommandContext } from '../../core/CommandContext'

const buildMutationEventTypesForKind = (kind: string): string[] => {
  return [`${kind}Created`, `${kind}Updated`, `${kind}Deleted`]
}

const WATCH_EVENT_OVERRIDES: Partial<Record<Resource, string[]>> = {
  pods: ['PodCreated', 'PodUpdated', 'PodDeleted', 'PodBound']
}

const buildWatchEventTypesByResource = (): Record<Resource, string[]> => {
  const result = {} as Record<Resource, string[]>
  for (const resource of Object.keys(RESOURCE_KIND_BY_RESOURCE) as Resource[]) {
    if (resource === 'all') {
      continue
    }
    const kind = RESOURCE_KIND_BY_RESOURCE[resource]
    const defaults =
      kind != null ? buildMutationEventTypesForKind(kind) : ([] as string[])
    result[resource] = WATCH_EVENT_OVERRIDES[resource] ?? defaults
  }
  const allEventTypes = Object.entries(result).flatMap(
    ([, eventTypes]) => eventTypes
  )
  result.all = [...new Set(allEventTypes)]
  return result
}

const WATCH_EVENT_TYPES_BY_RESOURCE: Record<Resource, string[]> =
  buildWatchEventTypesByResource()

export const isWatchEnabled = (parsed: ParsedCommand): boolean => {
  return (
    parsed.flags['watch'] === true ||
    parsed.flags['w'] === true ||
    parsed.flags['watch-only'] === true
  )
}

export const isWatchOnly = (parsed: ParsedCommand): boolean => {
  return parsed.flags['watch-only'] === true
}

export const getWatchEventTypes = (
  resource: Resource | undefined
): string[] => {
  if (resource == null) {
    return []
  }
  return WATCH_EVENT_TYPES_BY_RESOURCE[resource]
}

export const isAllNamespaces = (parsed: ParsedCommand): boolean => {
  return parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
}

export const getEffectiveNamespace = (
  parsed: ParsedCommand,
  context: CommandContext
): string | undefined => {
  if (isAllNamespaces(parsed)) {
    return undefined
  }
  if (parsed.namespace != null) {
    return parsed.namespace
  }
  return getCurrentNamespaceFromKubeconfig(context.fileSystem) ?? 'default'
}
