import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { ExecutionResult } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import { handleMetadataChange } from './metadataHelpers'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL ANNOTATE HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Handle kubectl annotate command: add, update, or remove annotations on resources
// Uses generic metadata handler with annotation-specific configuration

/**
 * Handle kubectl annotate command
 * Supports pods, configmaps, and secrets
 * Uses event-driven architecture
 */
export const handleAnnotate = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  return handleMetadataChange(
    apiServer,
    parsed,
    {
      metadataType: 'annotations',
      commandName: 'annotate',
      changesKey: 'annotationChanges',
      actionPastTense: 'annotated'
    }
  )
}
