import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import type { FileSystem } from '../../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../../shared/result'
import { error } from '../../../../../shared/result'
import type { ParsedCommand } from '../../../types'
import { getDeleteTargetConfig } from './config'
import { handleDeleteFromManifestFiles } from './manifest'
import { getPodDeleteOptions } from './messages'
import {
  deleteAllMatchingResources,
  deleteMatchingResourcesForType,
  deleteNamedResources
} from './operations'

const getDeleteNames = (parsed: ParsedCommand): string[] => {
  if (parsed.names != null && parsed.names.length > 0) {
    return parsed.names
  }
  if (parsed.name != null) {
    return [parsed.name]
  }
  return []
}

export const handleDelete = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  fileSystem?: FileSystem
): ExecutionResult => {
  const manifestResult = handleDeleteFromManifestFiles(
    apiServer,
    parsed,
    fileSystem
  )
  if (manifestResult != null) {
    return manifestResult
  }

  const namespace = parsed.namespace || 'default'
  const podDeleteOptions = getPodDeleteOptions(parsed)
  const resource = parsed.resource
  if (!resource) {
    return error('error: you must specify a resource type')
  }

  const names = getDeleteNames(parsed)
  if (names.length === 0) {
    if (resource === 'all') {
      return deleteAllMatchingResources(
        apiServer,
        namespace,
        parsed.selector,
        podDeleteOptions
      )
    }
    if (parsed.selector != null) {
      const selectorConfig = getDeleteTargetConfig(resource)
      if (!selectorConfig) {
        return error(`Resource type "${resource}" is not supported`)
      }
      return deleteMatchingResourcesForType(
        apiServer,
        selectorConfig,
        namespace,
        parsed.selector,
        podDeleteOptions
      )
    }
    return error('error: you must specify the name of the resource to delete')
  }

  if (resource === 'all') {
    return error('error: deleting "all" with explicit names is not supported')
  }

  return deleteNamedResources(
    apiServer,
    resource,
    names,
    namespace,
    podDeleteOptions
  )
}
