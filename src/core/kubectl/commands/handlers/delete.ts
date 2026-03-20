import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import { handleDelete as handleDeleteEntrypoint } from './internal/delete/entrypoint'

/**
 * Public kubectl delete facade.
 * Keeps stable export while delegating implementation to internal modules.
 */
export const handleDelete = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  fileSystem?: FileSystem
): ExecutionResult => {
  return handleDeleteEntrypoint(apiServer, parsed, fileSystem)
}
