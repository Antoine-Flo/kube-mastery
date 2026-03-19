import type { ResourceKind } from '../../cluster/ClusterState'

type GenericResource = Record<string, unknown>
type PathSegment = string

const DEFAULT_ALLOWED_EDIT_PATHS = ['metadata.labels', 'metadata.annotations'] as const
const KUBECTL_IDENTITY_CHANGE_ERROR =
  'error: At least one of apiVersion, kind and name was changed'
const POD_SPEC_FORBIDDEN_UPDATE_ERROR =
  'Error from server (Invalid): spec: Forbidden: pod updates may not change fields other than `spec.containers[*].image`,`spec.initContainers[*].image`,`spec.activeDeadlineSeconds`,`spec.tolerations` (only additions to existing tolerations),`spec.terminationGracePeriodSeconds` (allow it to be set to 1 if it was previously negative)'

const ALLOWED_EDIT_PATHS_BY_KIND: Partial<Record<ResourceKind, readonly string[]>> = {
  Pod: [
    ...DEFAULT_ALLOWED_EDIT_PATHS,
    'spec.containers.*.image',
    'spec.initContainers.*.image',
    'spec.activeDeadlineSeconds',
    'spec.tolerations',
    'spec.terminationGracePeriodSeconds'
  ],
  Deployment: [
    ...DEFAULT_ALLOWED_EDIT_PATHS,
    'spec.replicas',
    'spec.template.metadata.labels',
    'spec.template.metadata.annotations',
    'spec.template.spec.containers.*.image',
    'spec.template.spec.initContainers.*.image'
  ],
  ReplicaSet: [
    ...DEFAULT_ALLOWED_EDIT_PATHS,
    'spec.replicas',
    'spec.template.metadata.labels',
    'spec.template.metadata.annotations',
    'spec.template.spec.containers.*.image',
    'spec.template.spec.initContainers.*.image'
  ],
  DaemonSet: [
    ...DEFAULT_ALLOWED_EDIT_PATHS,
    'spec.template.metadata.labels',
    'spec.template.metadata.annotations',
    'spec.template.spec.containers.*.image',
    'spec.template.spec.initContainers.*.image'
  ],
  StatefulSet: [
    ...DEFAULT_ALLOWED_EDIT_PATHS,
    'spec.replicas',
    'spec.template.metadata.labels',
    'spec.template.metadata.annotations',
    'spec.template.spec.containers.*.image',
    'spec.template.spec.initContainers.*.image'
  ],
  Service: [...DEFAULT_ALLOWED_EDIT_PATHS],
  ConfigMap: [...DEFAULT_ALLOWED_EDIT_PATHS, 'data', 'binaryData'],
  Secret: [...DEFAULT_ALLOWED_EDIT_PATHS, 'data', 'stringData', 'type'],
  PersistentVolumeClaim: [...DEFAULT_ALLOWED_EDIT_PATHS, 'spec.resources.requests.storage'],
  PersistentVolume: [...DEFAULT_ALLOWED_EDIT_PATHS],
  Namespace: [...DEFAULT_ALLOWED_EDIT_PATHS],
  Node: [...DEFAULT_ALLOWED_EDIT_PATHS],
  Ingress: [
    ...DEFAULT_ALLOWED_EDIT_PATHS,
    'spec',
    'spec.rules',
    'spec.tls',
    'spec.defaultBackend'
  ]
}

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

const stripSimulatorFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      return stripSimulatorFields(entry)
    })
  }
  if (value == null || typeof value !== 'object') {
    return value
  }
  const objectValue = value as Record<string, unknown>
  const filteredEntries = Object.entries(objectValue)
    .filter(([key]) => {
      return key !== '_simulator'
    })
    .map(([key, entryValue]) => {
      return [key, stripSimulatorFields(entryValue)] as const
    })
  return Object.fromEntries(filteredEntries)
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

const isAllowedByRule = (
  changedPath: PathSegment[],
  allowedRule: PathSegment[]
): boolean => {
  if (changedPath.length < allowedRule.length) {
    return false
  }
  for (let index = 0; index < allowedRule.length; index++) {
    const ruleSegment = allowedRule[index]
    const pathSegment = changedPath[index]
    if (ruleSegment === '*') {
      continue
    }
    if (ruleSegment !== pathSegment) {
      return false
    }
  }
  return true
}

const isPathAllowed = (
  changedPath: PathSegment[],
  allowedPathRules: readonly string[]
): boolean => {
  const allowedSegments = allowedPathRules.map((rule) => {
    return rule.split('.')
  })
  for (const segments of allowedSegments) {
    if (isAllowedByRule(changedPath, segments)) {
      return true
    }
  }
  return false
}

const findFirstDisallowedChangedPath = (
  beforeValue: unknown,
  afterValue: unknown,
  allowedPathRules: readonly string[],
  path: PathSegment[] = []
): string | undefined => {
  if (isSameValue(beforeValue, afterValue)) {
    return undefined
  }

  if (isPathAllowed(path, allowedPathRules)) {
    return undefined
  }

  const beforeIsArray = Array.isArray(beforeValue)
  const afterIsArray = Array.isArray(afterValue)
  if (beforeIsArray || afterIsArray) {
    if (!beforeIsArray || !afterIsArray) {
      return path.join('.')
    }
    const maxLength = Math.max(beforeValue.length, afterValue.length)
    for (let index = 0; index < maxLength; index++) {
      const nextPath = [...path, String(index)]
      const disallowed = findFirstDisallowedChangedPath(
        beforeValue[index],
        afterValue[index],
        allowedPathRules,
        nextPath
      )
      if (disallowed != null) {
        return disallowed
      }
    }
    return undefined
  }

  const beforeIsObject = isObjectRecord(beforeValue)
  const afterIsObject = isObjectRecord(afterValue)
  if (beforeIsObject || afterIsObject) {
    if (!beforeIsObject || !afterIsObject) {
      return path.join('.')
    }
    const keys = new Set([
      ...Object.keys(beforeValue),
      ...Object.keys(afterValue)
    ])
    for (const key of keys) {
      const nextPath = [...path, key]
      const disallowed = findFirstDisallowedChangedPath(
        beforeValue[key],
        afterValue[key],
        allowedPathRules,
        nextPath
      )
      if (disallowed != null) {
        return disallowed
      }
    }
    return undefined
  }

  return path.join('.')
}

const getContainerNames = (
  resource: GenericResource,
  containerPath: 'spec.containers' | 'spec.initContainers'
): string[] => {
  const value = getNestedValue(resource, containerPath)
  if (!Array.isArray(value)) {
    return []
  }
  const names = value
    .map((entry) => {
      if (entry == null || typeof entry !== 'object') {
        return undefined
      }
      const name = (entry as Record<string, unknown>).name
      if (typeof name !== 'string') {
        return undefined
      }
      return name
    })
    .filter((name): name is string => {
      return name != null
    })
  return names
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

const hasIdentityPreconditionChanged = (
  existingResource: GenericResource,
  editedResource: GenericResource
): boolean => {
  const identityPaths = ['apiVersion', 'kind', 'metadata.name']
  for (const fieldPath of identityPaths) {
    const existingValue = getNestedValue(existingResource, fieldPath)
    const editedValue = getNestedValue(editedResource, fieldPath)
    if (!isSameValue(existingValue, editedValue)) {
      return true
    }
  }
  return false
}

const areTolerationsOnlyAdditions = (
  existingValue: unknown,
  editedValue: unknown
): boolean => {
  const existingTolerations = Array.isArray(existingValue) ? existingValue : []
  const editedTolerations = Array.isArray(editedValue) ? editedValue : []
  const remainingEdited = [...editedTolerations]
  for (const existingToleration of existingTolerations) {
    const matchingIndex = remainingEdited.findIndex((editedToleration) => {
      return isSameValue(existingToleration, editedToleration)
    })
    if (matchingIndex === -1) {
      return false
    }
    remainingEdited.splice(matchingIndex, 1)
  }
  return true
}

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined
  }
  return value
}

const isAllowedTerminationGracePeriodSecondsUpdate = (
  existingValue: unknown,
  editedValue: unknown
): boolean => {
  if (isSameValue(existingValue, editedValue)) {
    return true
  }
  const existingNumber = toNumberOrUndefined(existingValue)
  const editedNumber = toNumberOrUndefined(editedValue)
  if (existingNumber == null || editedNumber == null) {
    return false
  }
  return existingNumber < 0 && editedNumber === 1
}

export const validateImmutableFieldsForEdit = (
  kind: ResourceKind,
  existingResource: GenericResource,
  editedResource: GenericResource
): string | undefined => {
  if (hasIdentityPreconditionChanged(existingResource, editedResource)) {
    return KUBECTL_IDENTITY_CHANGE_ERROR
  }

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

  if (
    kind === 'Deployment' ||
    kind === 'ReplicaSet' ||
    kind === 'DaemonSet' ||
    kind === 'StatefulSet'
  ) {
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

  if (kind === 'Pod') {
    const existingContainerNames = getContainerNames(existingResource, 'spec.containers')
    const editedContainerNames = getContainerNames(editedResource, 'spec.containers')
    if (!isSameValue(existingContainerNames, editedContainerNames)) {
      return buildImmutableError('spec.containers[*].name')
    }

    const existingInitContainerNames = getContainerNames(
      existingResource,
      'spec.initContainers'
    )
    const editedInitContainerNames = getContainerNames(
      editedResource,
      'spec.initContainers'
    )
    if (!isSameValue(existingInitContainerNames, editedInitContainerNames)) {
      return buildImmutableError('spec.initContainers[*].name')
    }

    const existingTolerations = getNestedValue(existingResource, 'spec.tolerations')
    const editedTolerations = getNestedValue(editedResource, 'spec.tolerations')
    if (
      !isSameValue(existingTolerations, editedTolerations) &&
      !areTolerationsOnlyAdditions(existingTolerations, editedTolerations)
    ) {
      return POD_SPEC_FORBIDDEN_UPDATE_ERROR
    }

    const existingTerminationGracePeriodSeconds = getNestedValue(
      existingResource,
      'spec.terminationGracePeriodSeconds'
    )
    const editedTerminationGracePeriodSeconds = getNestedValue(
      editedResource,
      'spec.terminationGracePeriodSeconds'
    )
    if (
      !isAllowedTerminationGracePeriodSecondsUpdate(
        existingTerminationGracePeriodSeconds,
        editedTerminationGracePeriodSeconds
      )
    ) {
      return POD_SPEC_FORBIDDEN_UPDATE_ERROR
    }
  }

  const allowedEditPaths = ALLOWED_EDIT_PATHS_BY_KIND[kind] ?? DEFAULT_ALLOWED_EDIT_PATHS
  const normalizedExisting = stripSimulatorFields(existingResource)
  const normalizedEdited = stripSimulatorFields(editedResource)
  const disallowedPath = findFirstDisallowedChangedPath(
    normalizedExisting,
    normalizedEdited,
    allowedEditPaths
  )
  if (disallowedPath != null && disallowedPath.length > 0) {
    if (kind === 'Pod' && disallowedPath.startsWith('spec.')) {
      return POD_SPEC_FORBIDDEN_UPDATE_ERROR
    }
    return buildImmutableError(disallowedPath)
  }

  return undefined
}
