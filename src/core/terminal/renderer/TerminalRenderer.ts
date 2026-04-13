// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL RENDERER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════
// Interface abstraite pour le rendu du terminal
// Permet de découpler la logique métier de l'implémentation terminal.

export interface TerminalRenderer {
  write(text: string): void
  clearLine(): void
  focus(): void
  dispose(): void
}
