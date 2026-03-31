import type { KindToResource, ResourceKind } from '../../cluster/ClusterState'
import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { ExecutionResult } from '../../shared/result'
import { error, success } from '../../shared/result'
import { validateMetadataNameByKind } from './metadataNameValidation'
import {
  isNamespacedResourceKind,
  isSupportedResourceKind,
  toKindReference,
  toPluralKindReference
} from './resourceSchema'

export {
  RESOURCE_KIND_BY_RESOURCE,
  RESOURCE_OUTPUT_METADATA_BY_RESOURCE,
  isNamespacedResourceKind,
  isSupportedResourceKind,
  toKindReference,
  toKindReferenceForValidation,
  toPluralKindReference,
  toPluralResourceKindReference,
  toResourceKindReference
} from './resourceSchema'

export type KubernetesResource = {
  kind: string
  metadata: {
    name: string
    namespace: string
  }
}

const LAST_APPLIED_CONFIGURATION_ANNOTATION =
  'kubectl.kubernetes.io/last-applied-configuration'

const validateNamespaceExists = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  namespace: string
): ExecutionResult | undefined => {
  if (!isNamespacedResourceKind(kind)) {
    return undefined
  }
  const namespaceResult = apiServer.findResource('Namespace', namespace)
  if (namespaceResult.ok) {
    return undefined
  }
  return error(
    `Error from server (NotFound): namespaces "${namespace}" not found`
  )
}

const buildComparableResource = (
  value: unknown,
  parentKey?: string,
  isRoot = false
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => buildComparableResource(item, undefined, false))
  }
  if (value == null || typeof value !== 'object') {
    return value
  }

  const recordValue = value as Record<string, unknown>
  const comparable: Record<string, unknown> = {}
  const keys = Object.keys(recordValue).sort((left, right) => {
    return left.localeCompare(right)
  })

  for (const key of keys) {
    if (key === '_simulator') {
      continue
    }
    if (isRoot && key === 'status') {
      continue
    }
    if (
      parentKey === 'metadata' &&
      (key === 'creationTimestamp' || key === 'generation')
    ) {
      continue
    }
    if (parentKey === 'metadata' && key === 'annotations') {
      const annotationsRaw = recordValue[key]
      if (annotationsRaw == null || typeof annotationsRaw !== 'object') {
        continue
      }
      const annotations = annotationsRaw as Record<string, unknown>
      const filteredEntries = Object.entries(annotations).filter(([annKey]) => {
        if (annKey === 'deployment.kubernetes.io/revision') {
          return false
        }
        if (annKey === LAST_APPLIED_CONFIGURATION_ANNOTATION) {
          return false
        }
        if (annKey.startsWith('sim.kubernetes.io/')) {
          return false
        }
        return true
      })
      if (filteredEntries.length === 0) {
        continue
      }
      comparable[key] = buildComparableResource(
        Object.fromEntries(filteredEntries),
        key,
        false
      )
      continue
    }
    comparable[key] = buildComparableResource(recordValue[key], key, false)
  }

  return comparable
}

const areResourcesEquivalentForApply = (
  currentResource: unknown,
  incomingResource: unknown
): boolean => {
  const currentComparable = buildComparableResource(
    currentResource,
    undefined,
    true
  )
  const incomingComparable = buildComparableResource(
    incomingResource,
    undefined,
    true
  )
  return (
    JSON.stringify(currentComparable) === JSON.stringify(incomingComparable)
  )
}

/**
 * Apply resource using event-driven architecture
 * Emits PodCreated/Updated, ConfigMapCreated/Updated, or SecretCreated/Updated events
 */
export const applyResourceWithEvents = (
  resource: KubernetesResource,
  apiServer: ApiServerFacade
): ExecutionResult => {
  const { name, namespace } = resource.metadata
  const kindRaw = resource.kind

  if (!isSupportedResourceKind(kindRaw)) {
    return error(
      `error: the server doesn't have a resource type "${kindRaw.toLowerCase()}s"`
    )
  }
  const kind = kindRaw as ResourceKind

  const metadataNameValidation = validateMetadataNameByKind(kind, name)
  if (metadataNameValidation != null) {
    return metadataNameValidation
  }

  const namespaceValidation = validateNamespaceExists(
    apiServer,
    kind,
    namespace
  )
  if (namespaceValidation != null) {
    return namespaceValidation
  }

  const existing = apiServer.findResource(kind, name, namespace)

  if (existing.ok) {
    if (areResourcesEquivalentForApply(existing.value, resource)) {
      return success(`${toKindReference(kind)}/${name} unchanged`)
    }
    const updateResult = apiServer.updateResource(
      kind,
      name,
      resource as unknown as KindToResource<typeof kind>,
      namespace
    )
    if (!updateResult.ok) {
      return error(updateResult.error)
    }
    return success(`${toKindReference(kind)}/${name} configured`)
  } else {
    const createResult = apiServer.createResource(
      kind,
      resource as unknown as KindToResource<typeof kind>,
      namespace
    )
    if (!createResult.ok) {
      return error(createResult.error)
    }
    return success(`${toKindReference(kind)}/${name} created`)
  }
}

/**
 * Create resource using event-driven architecture
 * Emits PodCreated, ConfigMapCreated, or SecretCreated events
 * Fails if resource already exists
 */
export const createResourceWithEvents = (
  resource: KubernetesResource,
  apiServer: ApiServerFacade
): ExecutionResult => {
  const { name, namespace } = resource.metadata
  const kindRaw = resource.kind

  if (!isSupportedResourceKind(kindRaw)) {
    return error(
      `error: the server doesn't have a resource type "${kindRaw.toLowerCase()}s"`
    )
  }
  const kind = kindRaw as ResourceKind

  const metadataNameValidation = validateMetadataNameByKind(kind, name)
  if (metadataNameValidation != null) {
    return metadataNameValidation
  }

  const namespaceValidation = validateNamespaceExists(
    apiServer,
    kind,
    namespace
  )
  if (namespaceValidation != null) {
    return namespaceValidation
  }

  const existing = apiServer.findResource(kind, name, namespace)

  if (existing.ok) {
    return error(
      `Error from server (AlreadyExists): ${toPluralKindReference(kind)} "${name}" already exists`
    )
  }

  const createResult = apiServer.createResource(
    kind,
    resource as unknown as KindToResource<typeof kind>,
    namespace
  )
  if (!createResult.ok) {
    return error(createResult.error)
  }

  return success(`${toKindReference(kind)}/${name} created`)
}
