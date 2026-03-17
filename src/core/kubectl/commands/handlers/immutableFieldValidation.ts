import type { ResourceKind } from '../../../cluster/ClusterState'

type GenericResource = Record<string, unknown>

const getNestedValue = (resource: GenericResource, path: string): unknown => {
  const segments = path.split('.')
  let current: unknown = resource
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

const isSameValue = (left: unknown, right: unknown): boolean => {
  return JSON.stringify(left) === JSON.stringify(right)
}

const buildImmutableError = (fieldPath: string): string => {
  return `Error from server (Invalid): ${fieldPath}: field is immutable`
}

const validateImmutablePath = (
  existingResource: GenericResource,
  editedResource: GenericResource,
  fieldPath: string
): string | undefined => {
  const existingValue = getNestedValue(existingResource, fieldPath)
  const editedValue = getNestedValue(editedResource, fieldPath)
  if (isSameValue(existingValue, editedValue)) {
    return undefined
  }
  return buildImmutableError(fieldPath)
}

export const validateImmutableFieldsForEdit = (
  kind: ResourceKind,
  existingResource: GenericResource,
  editedResource: GenericResource
): string | undefined => {
  const baseImmutablePaths = ['apiVersion', 'kind', 'metadata.name', 'metadata.namespace']
  for (const fieldPath of baseImmutablePaths) {
    const validationError = validateImmutablePath(
      existingResource,
      editedResource,
      fieldPath
    )
    if (validationError != null) {
      return validationError
    }
  }

  if (kind === 'Deployment' || kind === 'ReplicaSet' || kind === 'DaemonSet') {
    const selectorValidationError = validateImmutablePath(
      existingResource,
      editedResource,
      'spec.selector'
    )
    if (selectorValidationError != null) {
      return selectorValidationError
    }
  }

  if (kind === 'Service') {
    const clusterIpValidationError = validateImmutablePath(
      existingResource,
      editedResource,
      'spec.clusterIP'
    )
    if (clusterIpValidationError != null) {
      return clusterIpValidationError
    }
    const clusterIpsValidationError = validateImmutablePath(
      existingResource,
      editedResource,
      'spec.clusterIPs'
    )
    if (clusterIpsValidationError != null) {
      return clusterIpsValidationError
    }
  }

  if (kind === 'PersistentVolumeClaim') {
    const storageClassValidationError = validateImmutablePath(
      existingResource,
      editedResource,
      'spec.storageClassName'
    )
    if (storageClassValidationError != null) {
      return storageClassValidationError
    }
  }

  return undefined
}
