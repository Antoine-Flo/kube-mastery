import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { ParsedCommand } from '../types'
import { handleGet as handleGetEntrypoint } from './internal/get/entrypoint'

/**
 * Public kubectl get facade.
 * Keeps a stable handler signature while delegating implementation to internal modules.
 */
export const handleGet = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  dependencies: {
    getResourceVersion?: () => string
  } = {}
): string => {
  return handleGetEntrypoint(apiServer, parsed, dependencies)
}