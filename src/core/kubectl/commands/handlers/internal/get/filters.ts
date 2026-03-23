import type { ResourceWithMetadata } from './types'
import {
  matchesLabelSelector,
  type LabelSelectorLike
} from '../../../../../shared/labelSelector'

export const filterByLabels = <T extends ResourceWithMetadata>(
  resources: T[],
  selector: LabelSelectorLike
): T[] => {
  return resources.filter((resource) => {
    return matchesLabelSelector(selector, resource.metadata.labels)
  })
}

export const filterByNamespace = <T extends ResourceWithMetadata>(
  resources: T[],
  namespace: string
): T[] => {
  return resources.filter(
    (resource) => resource.metadata.namespace === namespace
  )
}

export const applyFilters = <T extends ResourceWithMetadata>(
  resources: T[],
  namespace: string | undefined,
  selector?: LabelSelectorLike,
  isClusterScoped: boolean = false,
  name?: string
): T[] => {
  let filtered: T[]
  if (isClusterScoped) {
    filtered = resources
  } else if (namespace === undefined) {
    filtered = resources
  } else {
    filtered = filterByNamespace(resources, namespace)
  }
  if (selector) {
    filtered = filterByLabels(filtered, selector)
  }
  if (name) {
    filtered = filtered.filter((resource) => resource.metadata.name === name)
  }
  return filtered
}

export const noResourcesMessage = (
  effectiveNamespace: string | undefined,
  isClusterScoped: boolean
): string => {
  if (isClusterScoped || effectiveNamespace === undefined) {
    return 'No resources found'
  }
  return `No resources found in ${effectiveNamespace} namespace.`
}
