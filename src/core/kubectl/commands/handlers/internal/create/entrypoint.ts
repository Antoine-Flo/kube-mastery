import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import type { FileSystem } from '../../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../../shared/result'
import { error } from '../../../../../shared/result'
import { parseKubernetesYaml } from '../../../../yamlParser'
import { createResourceWithEvents } from '../../../resourceHelpers'
import type { ParsedCommand } from '../../../types'
import {
  buildCreateConfigMapDryRunManifest,
  createConfigMapFromFlags,
  isCreateConfigMapImperative,
  isExecutionErrorResult
} from './configMap'
import {
  buildCreateDeploymentDryRunManifest,
  createDeploymentFromFlags,
  isCreateDeploymentImperative,
  validateCreateDeploymentCommand
} from './deployment'
import {
  buildDryRunResponse,
  isDryRunClient,
  isSupportedDryRunValue
} from './dryRunResponse'
import {
  buildCreateNamespaceDryRunManifest,
  createNamespaceFromFlags,
  isCreateNamespaceImperative
} from './namespace'
import {
  buildCreateSecretDryRunManifest,
  createSecretFromFlags,
  isCreateSecretImperative
} from './secret'
import {
  buildCreateServiceConfig,
  createServiceFromFlags,
  isCreateServiceImperative
} from './service'

const getFilenameFromFlags = (parsed: ParsedCommand): string | undefined => {
  const filename = parsed.flags.f || parsed.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return filename
}

const loadAndParseYaml = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult & { resource?: any } => {
  const filename = getFilenameFromFlags(parsed)

  if (!filename) {
    return error('error: must specify one of -f or --filename')
  }

  const fileResult = fileSystem.readFile(filename as string)
  if (!fileResult.ok) {
    return error(`error: ${fileResult.error}`)
  }

  const parseResult = parseKubernetesYaml(fileResult.value)
  if (!parseResult.ok) {
    return error(`error: ${parseResult.error}`)
  }

  return { ok: true, value: '', resource: parseResult.value }
}

export { buildDryRunResponse }

export const handleCreate = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const dryRunFlag = parsed.flags['dry-run']
  if (!isSupportedDryRunValue(dryRunFlag)) {
    return error(
      `error: Invalid dry-run value (${String(dryRunFlag)}). Must be "none", "server", or "client".`
    )
  }

  const validationResult = validateCreateDeploymentCommand(parsed)
  if (validationResult) {
    return validationResult
  }

  if (isCreateDeploymentImperative(parsed)) {
    if (isDryRunClient(parsed)) {
      const dryRunManifest = buildCreateDeploymentDryRunManifest(parsed)
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createDeploymentFromFlags(parsed, apiServer)
  }

  if (isCreateNamespaceImperative(parsed)) {
    if (isDryRunClient(parsed)) {
      const dryRunManifest = buildCreateNamespaceDryRunManifest(parsed)
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createNamespaceFromFlags(parsed, apiServer)
  }

  if (isCreateServiceImperative(parsed)) {
    const serviceConfig = buildCreateServiceConfig(parsed)
    if (!('kind' in serviceConfig)) {
      return serviceConfig
    }
    if (isDryRunClient(parsed)) {
      return buildDryRunResponse(serviceConfig, parsed)
    }
    return createServiceFromFlags(parsed, apiServer)
  }

  if (isCreateConfigMapImperative(parsed)) {
    if (isDryRunClient(parsed)) {
      const dryRunManifest = buildCreateConfigMapDryRunManifest(parsed)
      if (isExecutionErrorResult(dryRunManifest)) {
        return dryRunManifest
      }
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createConfigMapFromFlags(parsed, apiServer)
  }

  if (isCreateSecretImperative(parsed)) {
    if (isDryRunClient(parsed)) {
      const dryRunManifest = buildCreateSecretDryRunManifest(fileSystem, parsed)
      if (isExecutionErrorResult(dryRunManifest)) {
        return dryRunManifest
      }
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createSecretFromFlags(fileSystem, parsed, apiServer)
  }

  const loadResult = loadAndParseYaml(fileSystem, parsed)
  if (!loadResult.ok) {
    return loadResult
  }

  if (isDryRunClient(parsed)) {
    return buildDryRunResponse(loadResult.resource, parsed)
  }

  return createResourceWithEvents(loadResult.resource, apiServer)
}
