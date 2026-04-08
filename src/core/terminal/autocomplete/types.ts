// ═══════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Types partagés pour le système d'autocomplete modulaire

import type { FileSystem } from '../../filesystem/FileSystem'

export interface AutocompleteResource {
  metadata: {
    name?: unknown
  }
}

export interface AutocompleteClusterState {
  getPods?: (namespace?: string) => AutocompleteResource[]
  getConfigMaps?: (namespace?: string) => AutocompleteResource[]
  getSecrets?: (namespace?: string) => AutocompleteResource[]
  getNodes?: () => AutocompleteResource[]
  getReplicaSets?: (namespace?: string) => AutocompleteResource[]
  getDaemonSets?: (namespace?: string) => AutocompleteResource[]
  getStatefulSets?: (namespace?: string) => AutocompleteResource[]
  getDeployments?: (namespace?: string) => AutocompleteResource[]
  getLeases?: (namespace?: string) => AutocompleteResource[]
  getNetworkPolicies?: (namespace?: string) => AutocompleteResource[]
}

export interface AutocompleteContext {
  clusterState: AutocompleteClusterState
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
