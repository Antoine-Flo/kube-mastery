import type { KindToResource, ResourceKind } from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { parseKubernetesYaml } from '../../yamlParser'
import type { ParsedCommand } from '../types'
import { validateMetadataNameByKind } from '../metadataNameValidation'
import {
  isNamespacedResourceKind,
  isSupportedResourceKind,
  toKindReference,
  toPluralKindReference
} from './resourceHelpers'

type KubernetesResource = {
  kind: string
  metadata?: {
    name?: string
    namespace?: string
  }
}

const getFilenameFromFlags = (parsed: ParsedCommand): string | undefined => {
  const filename = parsed.flags.f || parsed.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return filename
}

const isNamespacedKind = (kind: ResourceKind): boolean => {
  return isNamespacedResourceKind(kind)
}

const validateNamespaceExists = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  namespace: string
): ExecutionResult | undefined => {
  if (!isNamespacedKind(kind)) {
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

const loadManifestResource = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult & { resource?: KubernetesResource } => {
  const filename = getFilenameFromFlags(parsed)
  if (!filename) {
    return error('error: must specify one of -f or --filename')
  }

  const fileResult = fileSystem.readFile(filename)
  if (!fileResult.ok) {
    return error(`error: ${fileResult.error}`)
  }

  const parseResult = parseKubernetesYaml(fileResult.value)
  if (!parseResult.ok) {
    return error(`error: ${parseResult.error}`)
  }

  return {
    ok: true,
    value: '',
    resource: parseResult.value as KubernetesResource
  }
}

const getManifestTarget = (
  resource: KubernetesResource,
  parsed: ParsedCommand
):
  | {
      kind: ResourceKind
      name: string
      namespace: string
    }
  | ExecutionResult => {
  const kindRaw = resource.kind
  const nameRaw = resource.metadata?.name
  if (typeof kindRaw !== 'string' || typeof nameRaw !== 'string') {
    return error('error: invalid manifest: missing kind or metadata.name')
  }

  if (!isSupportedResourceKind(kindRaw)) {
    return error(
      `error: the server doesn't have a resource type "${kindRaw.toLowerCase()}s"`
    )
  }
  const kind = kindRaw as ResourceKind

  const metadataNameValidation = validateMetadataNameByKind(kind, nameRaw)
  if (metadataNameValidation != null) {
    return metadataNameValidation
  }

  const namespaceFromManifest = resource.metadata?.namespace
  const namespace =
    parsed.namespace ??
    (typeof namespaceFromManifest === 'string' && namespaceFromManifest.length > 0
      ? namespaceFromManifest
      : undefined) ??
    'default'

  return {
    kind,
    name: nameRaw,
    namespace
  }
}

const formatNotFound = (kind: ResourceKind, name: string): ExecutionResult => {
  return error(
    `Error from server (NotFound): ${toPluralKindReference(kind)} "${name}" not found`
  )
}

const replaceWithoutForce = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  name: string,
  namespace: string,
  resource: KubernetesResource
): ExecutionResult => {
  const namespaceValidation = validateNamespaceExists(apiServer, kind, namespace)
  if (namespaceValidation != null) {
    return namespaceValidation
  }

  const existing = isNamespacedKind(kind)
    ? apiServer.findResource(kind, name, namespace)
    : apiServer.findResource(kind, name)
  if (!existing.ok) {
    return formatNotFound(kind, name)
  }

  const updateResult = isNamespacedKind(kind)
    ? apiServer.updateResource(
        kind,
        name,
        resource as unknown as KindToResource<typeof kind>,
        namespace
      )
    : apiServer.updateResource(
        kind,
        name,
        resource as unknown as KindToResource<typeof kind>
      )
  if (!updateResult.ok) {
    return error(updateResult.error)
  }

  return success(`${toKindReference(kind)}/${name} replaced`)
}

const forceReplace = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  name: string,
  namespace: string,
  resource: KubernetesResource
): ExecutionResult => {
  const namespaceValidation = validateNamespaceExists(apiServer, kind, namespace)
  if (namespaceValidation != null) {
    return namespaceValidation
  }

  const existing = isNamespacedKind(kind)
    ? apiServer.findResource(kind, name, namespace)
    : apiServer.findResource(kind, name)
  if (!existing.ok) {
    return formatNotFound(kind, name)
  }

  const deleteResult = isNamespacedKind(kind)
    ? apiServer.deleteResource(kind, name, namespace)
    : apiServer.deleteResource(kind, name)
  if (!deleteResult.ok) {
    return error(deleteResult.error)
  }

  const createResult = isNamespacedKind(kind)
    ? apiServer.createResource(
        kind,
        resource as unknown as KindToResource<typeof kind>,
        namespace
      )
    : apiServer.createResource(
        kind,
        resource as unknown as KindToResource<typeof kind>
      )
  if (!createResult.ok) {
    return error(createResult.error)
  }

  return success(`${toKindReference(kind)}/${name} replaced`)
}

export const handleReplace = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const loadResult = loadManifestResource(fileSystem, parsed)
  if (!loadResult.ok) {
    return loadResult
  }
  if (loadResult.resource == null) {
    return error('error: internal error: missing resource in manifest')
  }

  const target = getManifestTarget(loadResult.resource, parsed)
  if ('ok' in target) {
    return target
  }

  const shouldForce = parsed.flags.force === true
  if (shouldForce) {
    return forceReplace(
      apiServer,
      target.kind,
      target.name,
      target.namespace,
      loadResult.resource
    )
  }

  return replaceWithoutForce(
    apiServer,
    target.kind,
    target.name,
    target.namespace,
    loadResult.resource
  )
}
