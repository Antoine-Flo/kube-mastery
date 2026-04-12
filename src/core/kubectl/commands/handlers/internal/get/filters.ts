import type { ResourceWithMetadata } from './types'
import {
  matchesLabelSelector,
  type LabelSelectorLike
} from '../../../../../shared/labelSelector'
import type { Result } from '../../../../../shared/result'
import { error, success } from '../../../../../shared/result'

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

interface FieldSelectorRequirement {
  key: string
  value: string
}

interface PodLikeFieldResource extends ResourceWithMetadata {
  status?: {
    phase?: string
  }
  spec?: {
    nodeName?: string
  }
}

interface EventLikeFieldResource extends ResourceWithMetadata {
  type?: string
  reason?: string
  involvedObject?: {
    name?: string
  }
}

const parseFieldSelectorRequirements = (
  selectorValue: string
): Result<FieldSelectorRequirement[]> => {
  const trimmedSelector = selectorValue.trim()
  if (trimmedSelector.length === 0) {
    return success([])
  }
  const segments = trimmedSelector
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
  const requirements: FieldSelectorRequirement[] = []
  for (const segment of segments) {
    const separatorIndex = segment.indexOf('=')
    if (separatorIndex <= 0 || separatorIndex === segment.length - 1) {
      return error(`error: invalid field selector: ${selectorValue}`)
    }
    const key = segment.slice(0, separatorIndex).trim()
    const value = segment.slice(separatorIndex + 1).trim()
    if (key.length === 0 || value.length === 0) {
      return error(`error: invalid field selector: ${selectorValue}`)
    }
    requirements.push({ key, value })
  }
  return success(requirements)
}

const matchesPodFieldSelector = (
  pod: PodLikeFieldResource,
  requirement: FieldSelectorRequirement
): Result<boolean> => {
  if (requirement.key === 'metadata.name') {
    return success(pod.metadata.name === requirement.value)
  }
  if (requirement.key === 'metadata.namespace') {
    return success(pod.metadata.namespace === requirement.value)
  }
  if (requirement.key === 'status.phase') {
    return success((pod.status?.phase ?? '') === requirement.value)
  }
  if (requirement.key === 'spec.nodeName') {
    return success((pod.spec?.nodeName ?? '') === requirement.value)
  }
  return error(requirement.key)
}

const matchesEventFieldSelector = (
  event: EventLikeFieldResource,
  requirement: FieldSelectorRequirement
): Result<boolean> => {
  if (requirement.key === 'metadata.name') {
    return success(event.metadata.name === requirement.value)
  }
  if (requirement.key === 'metadata.namespace') {
    return success(event.metadata.namespace === requirement.value)
  }
  if (requirement.key === 'reason') {
    return success((event.reason ?? '') === requirement.value)
  }
  if (requirement.key === 'type') {
    return success((event.type ?? '') === requirement.value)
  }
  if (requirement.key === 'involvedObject.name') {
    return success((event.involvedObject?.name ?? '') === requirement.value)
  }
  return error(requirement.key)
}

const matchesResourceFieldSelector = <T extends ResourceWithMetadata>(
  resource: T,
  resourceType: string,
  requirement: FieldSelectorRequirement
): Result<boolean> => {
  if (resourceType === 'pods') {
    return matchesPodFieldSelector(
      resource as PodLikeFieldResource,
      requirement
    )
  }
  if (resourceType === 'events') {
    return matchesEventFieldSelector(
      resource as EventLikeFieldResource,
      requirement
    )
  }
  if (requirement.key === 'metadata.name') {
    return success(resource.metadata.name === requirement.value)
  }
  if (requirement.key === 'metadata.namespace') {
    return success(resource.metadata.namespace === requirement.value)
  }
  return error(requirement.key)
}

const buildUnsupportedFieldSelectorError = (
  resourceType: string,
  rawSelector: string,
  unsupportedKey: string
): string => {
  return `Error from server (BadRequest): Unable to find "/v1, Resource=${resourceType}" that match label selector "", field selector "${rawSelector}": field label not supported: ${unsupportedKey}`
}

export const applyFieldSelector = <T extends ResourceWithMetadata>(
  resources: T[],
  resourceType: string,
  rawFieldSelectorValue: string | boolean | undefined
): Result<T[]> => {
  if (typeof rawFieldSelectorValue !== 'string') {
    return success(resources)
  }
  const requirementsResult = parseFieldSelectorRequirements(
    rawFieldSelectorValue
  )
  if (!requirementsResult.ok) {
    return requirementsResult
  }
  let filteredResources = resources
  for (const requirement of requirementsResult.value) {
    const nextFilteredResources: T[] = []
    for (const resource of filteredResources) {
      const matchResult = matchesResourceFieldSelector(
        resource,
        resourceType,
        requirement
      )
      if (!matchResult.ok) {
        return error(
          buildUnsupportedFieldSelectorError(
            resourceType,
            rawFieldSelectorValue,
            matchResult.error
          )
        )
      }
      if (matchResult.value) {
        nextFilteredResources.push(resource)
      }
    }
    filteredResources = nextFilteredResources
  }
  return success(filteredResources)
}
