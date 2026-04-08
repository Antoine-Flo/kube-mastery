import type { ClusterEvent } from '../../../cluster/events/types'
import type { ParsedCommand, Resource } from '../../../kubectl/commands/types'
import { matchesLabelSelector } from '../../../shared/labelSelector'
import { extractMetaFromGeneratedClusterEvent } from './clusterEventWatchMeta.generated'
import { getWatchEventTypes } from './watchEventTypes'

export type ResourceMeta = {
  name: string
  namespace: string
  labels?: Record<string, string>
}

export const extractMetaFromClusterEvent = (
  event: ClusterEvent,
  parsedResource: Resource
): ResourceMeta | undefined => {
  if (parsedResource === 'pods' && event.type === 'PodBound') {
    return {
      name: event.payload.name,
      namespace: event.payload.namespace,
      labels: event.payload.pod.metadata.labels
    }
  }
  return extractMetaFromGeneratedClusterEvent(event, parsedResource)
}

export const shouldRenderEvent = (
  event: ClusterEvent,
  parsed: ParsedCommand,
  effectiveNamespace: string | undefined
): boolean => {
  const resource = parsed.resource
  if (resource == null) {
    return false
  }
  const watchedEvents = getWatchEventTypes(resource)
  if (!watchedEvents.includes(event.type)) {
    return false
  }
  if (resource === 'all') {
    return true
  }
  const meta = extractMetaFromClusterEvent(event, resource)
  if (meta == null) {
    return true
  }
  if (
    effectiveNamespace != null &&
    meta.namespace.length > 0 &&
    meta.namespace !== effectiveNamespace
  ) {
    return false
  }
  const queryNames =
    parsed.names != null && parsed.names.length > 0
      ? parsed.names
      : parsed.name != null
        ? [parsed.name]
        : undefined
  if (queryNames != null && !queryNames.includes(meta.name)) {
    return false
  }
  if (!matchesLabelSelector(parsed.selector, meta.labels)) {
    return false
  }
  return true
}
