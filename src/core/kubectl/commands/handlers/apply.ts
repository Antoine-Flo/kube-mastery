import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import { handleApply as handleApplyEntrypoint } from './internal/apply/entrypoint'

/**
 * Public kubectl apply facade.
 * Keeps stable export while delegating implementation to internal modules.
 */
export const handleApply = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  return handleApplyEntrypoint(fileSystem, apiServer, parsed)
}
