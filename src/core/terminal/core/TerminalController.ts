// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════
// Orchestration de la logique métier du terminal
// Utilise TerminalState pour l'état et TerminalRenderer pour l'affichage
// Aucune dépendance à xterm ou DOM - logique pure testable

import type { TerminalRenderer } from '../renderer/TerminalRenderer'
import { createTerminalState, type TerminalState } from './TerminalState'
import type { CommandCallback } from './types'

import type { ShellContextStack } from './ShellContext'
import type { AutocompleteContext } from '../autocomplete/types'
import { AutocompleteEngine } from '../autocomplete/AutocompleteEngine'
import { InputHandler } from './InputHandler'
import type { InputHandlerContext } from './InputHandlerContext'
import { LineRenderer } from './LineRenderer'

interface TerminalControllerOptions {
  state: TerminalState
  renderer: TerminalRenderer
  shellContextStack: ShellContextStack // Utilisé uniquement pour récupérer le prompt
  autocompleteEngine?: AutocompleteEngine
}

export class TerminalController {
  private state: TerminalState
  private renderer: TerminalRenderer
  private shellContextStack: ShellContextStack
  private autocompleteEngine?: AutocompleteEngine
  private commandCallback?: CommandCallback
  private inputHandler: InputHandler

  constructor(options: TerminalControllerOptions) {
    this.state = options.state
    this.renderer = options.renderer
    this.shellContextStack = options.shellContextStack
    this.autocompleteEngine = options.autocompleteEngine

    // Créer InputHandler avec le contexte
    this.inputHandler = new InputHandler(this.createInputHandlerContext())
  }

  private replaceLineWithCommand(command: string): void {
    const lineRenderer = new LineRenderer(this.state, this.renderer)
    lineRenderer.replaceLine(command)
  }

  showPrompt(): void {
    const currentPrompt = this.shellContextStack.getCurrentPrompt()
    this.renderer.write(currentPrompt)
  }

  updatePrompt(): void {
    this.shellContextStack.updateCurrentPrompt()
  }

  private createInputHandlerContext(): InputHandlerContext {
    return {
      state: this.state,
      renderer: this.renderer,
      getAutocompleteEngine: () => this.autocompleteEngine,
      getCommandCallback: () => this.commandCallback,
      createAutocompleteContext: () => this.createAutocompleteContext(),
      showPrompt: () => this.showPrompt(),
      replaceLineWithCommand: (command) => this.replaceLineWithCommand(command),
      updateLineAndRender: (newLine, textToRender) => this.updateLineAndRender(newLine, textToRender),
      hideCursor: () => this.renderer.write('\x1b[?25l'),
      showCursor: () => this.renderer.write('\x1b[?25h')
    }
  }

  private createAutocompleteContext(): AutocompleteContext {
    // Pour l'instant, on retourne un contexte minimal
    // TODO: Récupérer clusterState depuis un endroit approprié
    return {
      clusterState: {} as any, // TODO: Passer le vrai clusterState
      fileSystem: this.shellContextStack.getCurrentFileSystem()
    }
  }

  private updateLineAndRender(newLine: string, textToRender: string): void {
    this.state.updateCurrentLine(newLine, newLine.length)
    this.renderer.write(textToRender)
  }

  handleInput(data: string): void {
    this.inputHandler.handleInput(data)
  }

  cancelInput(): void {
    this.state.clearCurrentLine()
    this.state.resetHistoryNavigation()
    this.renderer.write('\r\n')
    this.showPrompt()
  }

  simulateInput(data: string): void {
    this.inputHandler.simulateInput(data)
  }

  onCommand(callback: CommandCallback): void {
    this.commandCallback = callback
  }

  write(text: string): void {
    this.renderer.write(text)
  }

  focus(): void {
    this.renderer.focus()
  }

  getRenderer(): TerminalRenderer {
    return this.renderer
  }

  dispose(): void {
    this.renderer.dispose()
  }
}

// Factory function pour simplifier l'usage (crée le state par défaut)
export const createTerminalController = (options: Omit<TerminalControllerOptions, 'state'>): TerminalController => {
  return new TerminalController({
    ...options,
    state: createTerminalState() // Crée par défaut si pas fourni
  })
}
