import type { KindToResource, ResourceKind } from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { validateMetadataNameByKind } from '../metadataNameValidation'

export type KubernetesResource = {
  kind: string
  metadata: {
    name: string
    namespace: string
  }
}

const KIND_REFERENCE_BY_KIND: Partial<Record<ResourceKind, string>> = {
  Deployment: 'deployment.apps',
  DaemonSet: 'daemonset.apps',
  ReplicaSet: 'replicaset.apps',
  Ingress: 'ingress.networking.k8s.io'
}

const toKindReference = (kind: ResourceKind): string => {
  return KIND_REFERENCE_BY_KIND[kind] ?? kind.toLowerCase()
}

const toPluralKindReference = (kind: ResourceKind): string => {
  if (kind === 'Deployment') {
    return 'deployments.apps'
  }
  if (kind === 'ReplicaSet') {
    return 'replicasets.apps'
  }
  if (kind === 'DaemonSet') {
    return 'daemonsets.apps'
  }
  if (kind === 'Namespace') {
    return 'namespaces'
  }
  if (kind === 'PersistentVolume') {
    return 'persistentvolumes'
  }
  if (kind === 'PersistentVolumeClaim') {
    return 'persistentvolumeclaims'
  }
  if (kind === 'Ingress') {
    return 'ingresses.networking.k8s.io'
  }
  return `${kind.toLowerCase()}s`
}

const SUPPORTED_RESOURCE_KINDS: ResourceKind[] = [
  'Pod',
  'ConfigMap',
  'Secret',
  'Node',
  'Namespace',
  'Ingress',
  'ReplicaSet',
  'Deployment',
  'DaemonSet',
  'PersistentVolume',
  'PersistentVolumeClaim',
  'Service'
]

const LAST_APPLIED_CONFIGURATION_ANNOTATION =
  'kubectl.kubernetes.io/last-applied-configuration'

const NAMESPACED_RESOURCE_KINDS: ResourceKind[] = [
  'Pod',
  'ConfigMap',
  'Secret',
  'ReplicaSet',
  'Deployment',
  'DaemonSet',
  'PersistentVolumeClaim',
  'Service',
  'Ingress'
]

const resourceRequiresNamespace = (kind: ResourceKind): boolean => {
  return NAMESPACED_RESOURCE_KINDS.includes(kind)
}

const validateNamespaceExists = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  namespace: string
): ExecutionResult | undefined => {
  if (!resourceRequiresNamespace(kind)) {
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

const isSupportedKind = (kind: ResourceKind): boolean => {
  return SUPPORTED_RESOURCE_KINDS.includes(kind)
}

const cloneResource = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
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
  return JSON.stringify(currentComparable) === JSON.stringify(incomingComparable)
}

const withLastAppliedConfigurationAnnotation = (
  resource: KubernetesResource
): KubernetesResource => {
  const cloned = cloneResource(resource) as Record<string, unknown>
  const metadataRaw = cloned['metadata']
  if (metadataRaw == null || typeof metadataRaw !== 'object') {
    return cloned as KubernetesResource
  }

  const metadata = metadataRaw as Record<string, unknown>
  const comparable = buildComparableResource(cloned, undefined, true)
  const serialized = JSON.stringify(comparable)

  const currentAnnotationsRaw = metadata['annotations']
  const annotations: Record<string, unknown> =
    currentAnnotationsRaw != null && typeof currentAnnotationsRaw === 'object'
      ? { ...(currentAnnotationsRaw as Record<string, unknown>) }
      : {}

  annotations[LAST_APPLIED_CONFIGURATION_ANNOTATION] = serialized
  metadata['annotations'] = annotations

  return cloned as KubernetesResource
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
  const kind = resource.kind as ResourceKind

  if (!isSupportedKind(kind)) {
    return error(
      `error: the server doesn't have a resource type "${kind.toLowerCase()}s"`
    )
  }

  const metadataNameValidation = validateMetadataNameByKind(kind, name)
  if (metadataNameValidation != null) {
    return metadataNameValidation
  }

  const namespaceValidation = validateNamespaceExists(apiServer, kind, namespace)
  if (namespaceValidation != null) {
    return namespaceValidation
  }

  const existing = apiServer.findResource(kind, name, namespace)

  if (existing.ok) {
    if (areResourcesEquivalentForApply(existing.value, resource)) {
      return success(`${toKindReference(kind)}/${name} unchanged`)
    }
    const resourceToPersist = withLastAppliedConfigurationAnnotation(resource)

    const updateResult = apiServer.updateResource(
      kind,
      name,
      resourceToPersist as unknown as KindToResource<typeof kind>,
      namespace
    )
    if (!updateResult.ok) {
      return error(updateResult.error)
    }
    return success(`${toKindReference(kind)}/${name} configured`)
  } else {
    const resourceToPersist = withLastAppliedConfigurationAnnotation(resource)
    const createResult = apiServer.createResource(
      kind,
      resourceToPersist as unknown as KindToResource<typeof kind>,
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
  const kind = resource.kind as ResourceKind

  if (!isSupportedKind(kind)) {
    return error(
      `error: the server doesn't have a resource type "${kind.toLowerCase()}s"`
    )
  }

  const metadataNameValidation = validateMetadataNameByKind(kind, name)
  if (metadataNameValidation != null) {
    return metadataNameValidation
  }

  const namespaceValidation = validateNamespaceExists(apiServer, kind, namespace)
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
