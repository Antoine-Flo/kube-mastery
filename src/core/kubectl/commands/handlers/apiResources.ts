import type { ParsedCommand } from '../types'
import type { Result } from '../../../shared/result'
import { handleAPIResources as handleAPIResourcesEntrypoint } from './internal/apiResources/entrypoint'

/**
 * Public kubectl api-resources facade.
 * Keeps stable export while delegating implementation to internal modules.
 */
export const handleAPIResources = (parsed: ParsedCommand): Result<string> => {
  return handleAPIResourcesEntrypoint(parsed)
}
