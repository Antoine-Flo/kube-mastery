// ═══════════════════════════════════════════════════════════════════════════
// INPUT HANDLER CONTEXT
// ═══════════════════════════════════════════════════════════════════════════
// Contexte unique pour InputHandler qui regroupe toutes les dépendances
// Remplace les multiples callbacks par un objet de contexte simple

import type { TerminalState } from './TerminalState'
import type { TerminalRenderer } from '../renderer/TerminalRenderer'
import type { AutocompleteEngine } from '../autocomplete/AutocompleteEngine'
import type { AutocompleteContext } from '../autocomplete/types'
import type { CommandCallback } from './types'

export interface InputHandlerContext {
    state: TerminalState
    renderer: TerminalRenderer
    getAutocompleteEngine: () => AutocompleteEngine | undefined
    getCommandCallback: () => CommandCallback | undefined
    createAutocompleteContext: () => AutocompleteContext
    showPrompt: () => void
    replaceLineWithCommand: (command: string) => void
    updateLineAndRender: (newLine: string, textToRender: string) => void
    /** Masque le curseur pour éviter les flashs visuels */
    hideCursor: () => void
    /** Affiche le curseur */
    showCursor: () => void
}
