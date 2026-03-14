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
