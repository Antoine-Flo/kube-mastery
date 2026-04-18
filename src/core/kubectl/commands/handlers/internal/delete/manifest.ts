import type { ResourceKind } from '../../../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import type { FileSystem } from '../../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../../shared/result'
import { error, success } from '../../../../../shared/result'
import { parseKubernetesYamlDocuments } from '../../../../yamlParser'
import { formatKubectlFileSystemError } from '../../../filesystemErrorPresenter'
import {
  NO_OBJECTS_PASSED_TO_DELETE,
  resolveManifestFilePathsFromFilenameFlag
} from '../../../manifestFilePathsFromFlag'
import {
  isSupportedResourceKind,
  toPluralKindReference
} from '../../../resourceCatalog'
import { getFilenameFromFlags } from '../../../shared/filenameFlags'
import type { ParsedCommand } from '../../../types'
import { DELETE_TARGET_BY_KIND } from './config'
import { getPodDeleteOptions } from './messages'
import { deleteSingleResource } from './operations'

const deleteFromManifest = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  resource: any
): ExecutionResult => {
  const kindRaw = resource?.kind
  const nameRaw = resource?.metadata?.name

  if (typeof kindRaw !== 'string' || typeof nameRaw !== 'string') {
    return error('error: invalid manifest: missing kind or metadata.name')
  }

  const kind = kindRaw as ResourceKind
  const targetConfig = DELETE_TARGET_BY_KIND[kind]
  if (!targetConfig) {
    if (isSupportedResourceKind(kindRaw)) {
      return error(
        `error: the server doesn't have a resource type "${toPluralKindReference(kindRaw)}"`
      )
    }
    return error(
      `error: the server doesn't have a resource type "${kind.toLowerCase()}s"`
    )
  }

  const namespaceRaw = resource?.metadata?.namespace
  const namespaceFromManifest =
    typeof namespaceRaw === 'string' && namespaceRaw.length > 0
      ? namespaceRaw
      : undefined
  const namespace = parsed.namespace ?? namespaceFromManifest ?? 'default'
  const podDeleteOptions = getPodDeleteOptions(parsed)

  return deleteSingleResource(
    apiServer,
    targetConfig,
    nameRaw,
    namespace,
    podDeleteOptions
  )
}

export const handleDeleteFromManifestFiles = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  fileSystem?: FileSystem
): ExecutionResult | undefined => {
  const filename = getFilenameFromFlags(parsed)
  if (filename == null) {
    return undefined
  }

  if (fileSystem == null) {
    return error('error: internal error: filesystem is not available')
  }

  const pathsResult = resolveManifestFilePathsFromFilenameFlag(
    fileSystem,
    filename,
    NO_OBJECTS_PASSED_TO_DELETE
  )
  if (!pathsResult.ok) {
    return pathsResult
  }
  const filesResult = fileSystem.readFilesDetailed(pathsResult.value)
  if (!filesResult.ok) {
    return error(formatKubectlFileSystemError(filesResult.error))
  }
  const lines: string[] = []
  for (let i = 0; i < filesResult.value.length; i++) {
    const parseResult = parseKubernetesYamlDocuments(filesResult.value[i])
    if (!parseResult.ok) {
      return error(`error: ${parseResult.error}`)
    }
    for (let j = 0; j < parseResult.value.length; j++) {
      const deleteResult = deleteFromManifest(apiServer, parsed, parseResult.value[j])
      if (!deleteResult.ok) {
        return deleteResult
      }
      lines.push(deleteResult.value)
    }
  }
  return success(lines.join('\n'))
}
