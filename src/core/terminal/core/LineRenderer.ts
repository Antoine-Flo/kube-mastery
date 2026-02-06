// ═══════════════════════════════════════════════════════════════════════════
// LINE RENDERER
// ═══════════════════════════════════════════════════════════════════════════
// Gère toute la logique de redraw de ligne dans le terminal
// Centralise la logique de rendu pour éviter la duplication

import type { TerminalState } from './TerminalState'
import type { TerminalRenderer } from '../renderer/TerminalRenderer'

export class LineRenderer {
  constructor(
    private state: TerminalState,
    private renderer: TerminalRenderer
  ) {}

  /**
   * Redraw la ligne depuis une position donnée jusqu'à la fin
   * Utilisé après insertion de caractère
   */
  redrawFromCursor(startPosition: number): void {
    const { currentLine, cursorPosition } = this.state
    const remaining = currentLine.slice(startPosition)
    this.renderer.clearToEnd()
    this.renderer.write(remaining)

    // Repositionner le curseur à la bonne position
    const cursorOffset = cursorPosition - startPosition
    for (let i = 0; i < remaining.length - cursorOffset; i++) {
      this.renderer.moveCursorLeft()
    }
  }

  /**
   * Redraw la ligne après un backspace
   */
  redrawAfterBackspace(): void {
    const { currentLine, cursorPosition } = this.state
    const remaining = currentLine.slice(cursorPosition)

    // Déplacer le curseur à gauche (on a supprimé un caractère)
    this.renderer.moveCursorLeft()
    // Effacer depuis le curseur jusqu'à la fin
    this.renderer.clearToEnd()
    // Réécrire le reste de la ligne
    this.renderer.write(remaining)

    // Repositionner le curseur à la bonne position
    for (let i = 0; i < remaining.length; i++) {
      this.renderer.moveCursorLeft()
    }
  }

  /**
   * Redraw la ligne après insertion d'un caractère
   */
  redrawAfterCharacterInsert(): void {
    const { currentLine, cursorPosition } = this.state
    // On redraw depuis cursorPosition - 1 car on vient d'insérer un caractère
    const remaining = currentLine.slice(cursorPosition - 1)
    this.renderer.clearToEnd()
    this.renderer.write(remaining)

    // Repositionner le curseur (on est à la fin, on doit revenir à cursorPosition)
    for (let i = 0; i < remaining.length - 1; i++) {
      this.renderer.moveCursorLeft()
    }
  }

  /**
   * Remplace toute la ligne par une nouvelle commande
   * Utilisé pour l'historique
   */
  replaceLine(newLine: string): void {
    const { currentLine } = this.state

    // Se déplacer au début de la ligne d'input
    for (let i = 0; i < currentLine.length; i++) {
      this.renderer.moveCursorLeft()
    }

    // Effacer depuis le début jusqu'à la fin de la ligne
    this.renderer.clearToEnd()

    // Écrire la nouvelle commande
    this.renderer.write(newLine)

    // Mettre à jour l'état avec la nouvelle commande, curseur à la fin
    this.state.updateCurrentLine(newLine, newLine.length)
  }
}
