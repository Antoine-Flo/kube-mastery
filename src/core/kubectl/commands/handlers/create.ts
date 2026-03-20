import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import {
  buildDryRunResponse as buildDryRunResponseEntrypoint,
  handleCreate as handleCreateEntrypoint
} from './internal/create/entrypoint'

/**
 * Public kubectl create facade.
 * Keeps stable exports while delegating implementation to internal modules.
 */
export const buildDryRunResponse = (
  resource: any,
  parsed: ParsedCommand
): ExecutionResult => {
  return buildDryRunResponseEntrypoint(resource, parsed)
}

export const handleCreate = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  return handleCreateEntrypoint(fileSystem, apiServer, parsed)
}
