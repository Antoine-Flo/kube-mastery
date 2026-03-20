import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { ExecutionResult } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import { handleMetadataChange } from '../metadataHelpers'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL LABEL HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Handle kubectl label command: add, update, or remove labels on resources
// Uses generic metadata handler with label-specific configuration

/**
 * Handle kubectl label command
 * Supports pods, configmaps, and secrets
 * Uses event-driven architecture
 */
export const handleLabel = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  return handleMetadataChange(apiServer, parsed, {
    metadataType: 'labels',
    commandName: 'label',
    changesKey: 'labelChanges',
    actionPastTense: 'labeled'
  })
}
