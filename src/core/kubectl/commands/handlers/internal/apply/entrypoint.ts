import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import type { FileSystem } from '../../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../../shared/result'
import { error, success } from '../../../../../shared/result'
import { parseKubernetesYaml } from '../../../../yamlParser'
import {
  NO_OBJECTS_PASSED_TO_APPLY,
  resolveManifestFilePathsFromFilenameFlag
} from '../../../manifestFilePathsFromFlag'
import { applyResourceWithEvents } from '../../../resourceHelpers'
import type { ParsedCommand } from '../../../types'

const getFilenameFromFlags = (parsed: ParsedCommand): string | undefined => {
  const filename = parsed.flags.f || parsed.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return filename
}

export const handleApply = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const filename = getFilenameFromFlags(parsed)
  if (!filename) {
    return error('error: must specify one of -f or --filename')
  }

  const pathsResult = resolveManifestFilePathsFromFilenameFlag(
    fileSystem,
    filename,
    NO_OBJECTS_PASSED_TO_APPLY
  )
  if (!pathsResult.ok) {
    return pathsResult
  }

  const filesResult = fileSystem.readFiles(pathsResult.value)
  if (!filesResult.ok) {
    return error(`error: ${filesResult.error}`)
  }

  const lines: string[] = []
  for (let i = 0; i < filesResult.value.length; i++) {
    const parseResult = parseKubernetesYaml(filesResult.value[i])
    if (!parseResult.ok) {
      return error(`error: ${parseResult.error}`)
    }
    const applyResult = applyResourceWithEvents(parseResult.value, apiServer)
    if (!applyResult.ok) {
      return applyResult
    }
    lines.push(applyResult.value)
  }

  return success(lines.join('\n'))
}
