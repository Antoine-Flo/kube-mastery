import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import type { FileSystem } from '../../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../../shared/result'
import { error, success } from '../../../../../shared/result'
import { parseKubernetesYamlDocuments } from '../../../../yamlParser'
import { formatKubectlFileSystemError } from '../../../filesystemErrorPresenter'
import {
  NO_OBJECTS_PASSED_TO_APPLY,
  resolveManifestFilePathsFromFilenameFlag
} from '../../../manifestFilePathsFromFlag'
import { applyResourceWithEvents } from '../../../resourceCatalog'
import {
  buildDryRunResponse,
  isDryRunRequested,
  isSupportedDryRunValue
} from '../create/dryRunResponse'
import { buildMustSpecifyFilenameFlagMessage } from '../../../shared/errorMessages'
import { getFilenameFromFlags } from '../../../shared/filenameFlags'
import type { ParsedCommand } from '../../../types'

export const handleApply = (
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
  const filename = getFilenameFromFlags(parsed)
  if (!filename) {
    return error(buildMustSpecifyFilenameFlagMessage())
  }

  const pathsResult = resolveManifestFilePathsFromFilenameFlag(
    fileSystem,
    filename,
    NO_OBJECTS_PASSED_TO_APPLY
  )
  if (!pathsResult.ok) {
    return pathsResult
  }

  const filesResult = fileSystem.readFilesDetailed(pathsResult.value)
  if (!filesResult.ok) {
    return error(formatKubectlFileSystemError(filesResult.error))
  }

  const lines: string[] = []
  const dryRunRequested = isDryRunRequested(parsed)
  for (let i = 0; i < filesResult.value.length; i++) {
    const parseResult = parseKubernetesYamlDocuments(filesResult.value[i])
    if (!parseResult.ok) {
      return error(`error: ${parseResult.error}`)
    }
    for (let j = 0; j < parseResult.value.length; j++) {
      if (dryRunRequested) {
        const dryRunResult = buildDryRunResponse(parseResult.value[j], parsed)
        if (!dryRunResult.ok) {
          return dryRunResult
        }
        lines.push(dryRunResult.value)
        continue
      }
      const applyResult = applyResourceWithEvents(
        parseResult.value[j],
        apiServer
      )
      if (!applyResult.ok) {
        return applyResult
      }
      lines.push(applyResult.value)
    }
  }

  return success(lines.join('\n'))
}
