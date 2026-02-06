// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL RENDERER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════
// Interface abstraite pour le rendu du terminal
// Permet de découpler la logique métier de l'implémentation (xterm, mock, etc.)

export interface TerminalRenderer {
  write(text: string): void
  writeChar(char: string): void
  clearLine(): void
  clearToEnd(): void
  moveCursorLeft(): void
  moveCursorRight(): void
  setCursorPosition(position: number): void
  focus(): void
  dispose(): void
}
