// ═══════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Types partagés pour le système d'autocomplete modulaire

import type { FileSystem } from '../core/ShellContext'

// Types temporaires jusqu'à migration complète
type ClusterState = any // TODO: Migrer depuis cluster/ClusterState

export interface AutocompleteContext {
  clusterState: ClusterState
  fileSystem: FileSystem
}

export interface CompletionResult {
  text: string
  suffix: string // ' ' for commands/files, '/' for directories
}

/**
 * Callbacks pour l'interaction Tab dans le terminal
 * Permet à AutocompleteEngine d'effectuer des actions sans dépendre directement de TerminalController
 */
export interface TabCompletionCallbacks {
  write(text: string): void
  showPrompt(): void
  updateLineAndRender(newLine: string, textToRender: string): void
  getCurrentToken(): string
  getCurrentLine(): string
  updateCurrentLine(line: string, cursorPos: number): void
}
