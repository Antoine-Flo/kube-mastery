// ═══════════════════════════════════════════════════════════════════════════
// INPUT HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Gère toute la logique de traitement des inputs du terminal
// Découplé du TerminalController pour une meilleure séparation des responsabilités

import type { TabCompletionCallbacks } from '../autocomplete/types'
import type { InputHandlerContext } from './InputHandlerContext'
import { LineRenderer } from './LineRenderer'

export class InputHandler {
  private lineRenderer: LineRenderer

  constructor(private context: InputHandlerContext) {
    this.lineRenderer = new LineRenderer(context.state, context.renderer)
  }

  /**
   * Traite un input et exécute l'action appropriée
   */
  handleInput(data: string): void {
    if (this.context.isInputLocked?.()) {
      return
    }
    const charCode = data.charCodeAt(0)

    // Handle arrow keys
    if (this.handleArrowKeys(data)) {
      return
    }

    // Tab (autocomplete)
    if (charCode === 9) {
      this.handleTab()
      return
    }

    // Enter
    if (charCode === 13) {
      this.handleEnter()
      return
    }

    // Backspace
    if (charCode === 127) {
      this.handleBackspace()
      return
    }

    // Ctrl+V (paste)
    if (charCode === 22) {
      this.handlePaste()
      return
    }

    // Ignore other control characters
    if (charCode < 32) {
      return
    }

    // Insert character at cursor position
    this.handleCharacterInput(data)
  }

  /**
   * Simule un input (pour les tests ou programmation)
   */
  simulateInput(data: string): void {
    // Process each character separately for multi-char strings
    if (data.length > 1 && !data.startsWith('\x1b')) {
      for (const char of data) {
        this.handleInput(char)
      }
    } else {
      this.handleInput(data)
    }
  }

  private handleArrowKeys(data: string): boolean {
    const { state, renderer } = this.context

    if (data === '\x1b[A') {
      // Arrow up - history up
      const historyCommand = state.navigateHistory('up')
      if (historyCommand !== null) {
        this.context.replaceLineWithCommand(historyCommand)
      }
      return true
    }

    if (data === '\x1b[B') {
      // Arrow down - history down
      const historyCommand = state.navigateHistory('down')
      if (historyCommand !== null) {
        this.context.replaceLineWithCommand(historyCommand)
      }
      return true
    }

    if (data === '\x1b[C') {
      // Arrow right
      if (state.moveCursor('right')) {
        renderer.moveCursorRight()
      }
      return true
    }

    if (data === '\x1b[D') {
      // Arrow left
      if (state.moveCursor('left')) {
        renderer.moveCursorLeft()
      }
      return true
    }

    return false
  }

  private handleTab(): void {
    const autocompleteEngine = this.context.getAutocompleteEngine()
    const { state, renderer } = this.context
    if (!autocompleteEngine) {
      return
    }

    const autocompleteContext = this.context.createAutocompleteContext()

    autocompleteEngine.handleTabPress(state.currentLine, autocompleteContext, {
      write: (text) => renderer.write(text),
      showPrompt: () => this.context.showPrompt(),
      updateLineAndRender: (newLine, textToRender) => this.context.updateLineAndRender(newLine, textToRender),
      getCurrentToken: () => state.getCurrentToken(),
      getCurrentLine: () => state.currentLine,
      updateCurrentLine: (line, cursorPos) => state.updateCurrentLine(line, cursorPos)
    })
  }

  private handleEnter(): void {
    const { state, renderer } = this.context
    const commandCallback = this.context.getCommandCallback()

    // Masquer le curseur pour éviter le flash visuel
    this.context.hideCursor()

    renderer.write('\r\n')

    const command = state.currentLine.trim()
    if (command) {
      // Toujours ajouter à l'historique, même sans callback
      state.addToHistory(command)
      // Appeler le callback si fourni
      if (commandCallback) {
        commandCallback(command)
      }
    }

    state.resetAfterCommand()
    if (!this.context.isInputLocked?.()) {
      this.context.showPrompt()
      // Réafficher le curseur après le prompt
      this.context.showCursor()
    }
  }

  private handleBackspace(): void {
    const { state } = this.context

    if (!state.deleteCharBeforeCursor()) {
      return
    }

    this.lineRenderer.redrawAfterBackspace()
  }

  private handlePaste(): void {
    navigator.clipboard.readText().then((text) => {
      for (const char of text) {
        if (char.charCodeAt(0) >= 32) {
          this.handleInput(char)
        }
      }
    })
  }

  private handleCharacterInput(data: string): void {
    const { state } = this.context

    // Reset history navigation when typing
    if (state.historyIndex !== -1) {
      state.resetHistoryNavigation()
    }

    // Insert character at cursor position
    state.insertCharAtCursor(data)

    // Redraw from cursor position
    this.lineRenderer.redrawAfterCharacterInsert()
  }
}
