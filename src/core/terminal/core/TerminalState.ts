// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL STATE
// ═══════════════════════════════════════════════════════════════════════════
// Encapsulation de l'état du terminal (ligne courante, curseur, historique)
// Classe pour encapsuler l'état mutable et ses méthodes

const MAX_HISTORY = 100

export interface TerminalStateData {
  currentLine: string
  cursorPosition: number
  history: string[]
  historyIndex: number
  tempCurrentLine: string
}

export class TerminalState {
  public currentLine: string
  public cursorPosition: number
  public history: string[]
  public historyIndex: number
  public tempCurrentLine: string

  constructor(initialState?: Partial<TerminalStateData>) {
    this.currentLine = initialState?.currentLine || ''
    this.cursorPosition = initialState?.cursorPosition || 0
    this.history = initialState?.history || []
    this.historyIndex = initialState?.historyIndex || -1
    this.tempCurrentLine = initialState?.tempCurrentLine || ''
  }

  updateCurrentLine(line: string, cursorPos?: number): void {
    this.currentLine = line
    if (cursorPos !== undefined) {
      this.cursorPosition = cursorPos
    } else {
      this.cursorPosition = line.length
    }
  }

  insertCharAtCursor(char: string): void {
    this.currentLine =
      this.currentLine.slice(0, this.cursorPosition) +
      char +
      this.currentLine.slice(this.cursorPosition)
    this.cursorPosition++
  }

  deleteCharBeforeCursor(): boolean {
    if (this.currentLine.length === 0 || this.cursorPosition === 0) {
      return false
    }

    this.currentLine =
      this.currentLine.slice(0, this.cursorPosition - 1) +
      this.currentLine.slice(this.cursorPosition)
    this.cursorPosition--
    return true
  }

  moveCursor(direction: 'left' | 'right'): boolean {
    if (direction === 'left' && this.cursorPosition > 0) {
      this.cursorPosition--
      return true
    }

    if (
      direction === 'right' &&
      this.cursorPosition < this.currentLine.length
    ) {
      this.cursorPosition++
      return true
    }

    return false
  }

  clearCurrentLine(): void {
    this.currentLine = ''
    this.cursorPosition = 0
  }

  addToHistory(command: string): void {
    if (!command.trim()) {
      return
    }

    this.history.push(command)
    if (this.history.length > MAX_HISTORY) {
      this.history.shift()
    }
  }

  navigateHistory(direction: 'up' | 'down'): string | null {
    if (this.history.length === 0) {
      return null
    }

    // Save current line when first entering history
    if (this.historyIndex === -1 && direction === 'up') {
      this.tempCurrentLine = this.currentLine
    }

    // Calculate new index
    if (direction === 'up') {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++
      }
    } else {
      if (this.historyIndex > -1) {
        this.historyIndex--
      }
    }

    // Return command from history or temp line
    if (this.historyIndex === -1) {
      return this.tempCurrentLine
    } else {
      const historyPosition = this.history.length - 1 - this.historyIndex
      return this.history[historyPosition]
    }
  }

  resetHistoryNavigation(): void {
    this.historyIndex = -1
    this.tempCurrentLine = ''
  }

  resetAfterCommand(): void {
    this.currentLine = ''
    this.cursorPosition = 0
    this.historyIndex = -1
    this.tempCurrentLine = ''
  }

  getCurrentToken(): string {
    if (this.currentLine.endsWith(' ')) {
      return ''
    }
    const lastSpace = this.currentLine.lastIndexOf(' ')
    if (lastSpace === -1) {
      return this.currentLine
    }
    return this.currentLine.slice(lastSpace + 1)
  }
}

// Factory function pour compatibilité et simplicité d'utilisation
export const createTerminalState = (
  initialState?: Partial<TerminalStateData>
): TerminalState => {
  return new TerminalState(initialState)
}
