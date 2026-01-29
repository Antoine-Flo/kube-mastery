// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL OUTPUT
// ═══════════════════════════════════════════════════════════════════════════
// Abstraction propre et testable pour gérer les lignes dans le terminal.
// Encapsule toutes les opérations d'écriture avec gestion automatique
// des sauts de ligne et séquences de contrôle.

import type { TerminalRenderer } from '../renderer/TerminalRenderer'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Séquence de fin de ligne pour xterm.js (CRLF) */
const EOL = '\r\n'

/** Séquence ANSI pour masquer le curseur */
const CURSOR_HIDE = '\x1b[?25l'

/** Séquence ANSI pour afficher le curseur */
const CURSOR_SHOW = '\x1b[?25h'

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * Interface pour la gestion des sorties terminal
 * Fournit des méthodes de haut niveau pour écrire du texte
 * avec gestion automatique des sauts de ligne
 */
export interface TerminalOutput {
  /** Écrit du texte sans saut de ligne (contrôle fin) */
  write(text: string): void

  /** Écrit une ligne complète avec saut de ligne automatique */
  writeLine(text: string): void

  /** Saute une ligne (ligne vide) */
  newLine(): void

  /** Écrit plusieurs lignes avec sauts de ligne entre chaque */
  writeLines(lines: string[]): void

  /** Écrit un message d'erreur formaté avec préfixe "Error: " */
  writeError(message: string): void

  /** Écrit une sortie de commande (avec saut de ligne si non vide) */
  writeOutput(output: string): void

  /** Masque le curseur (pour éviter les flashs) */
  hideCursor(): void

  /** Affiche le curseur */
  showCursor(): void
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * Crée une instance de TerminalOutput
 * @param renderer - Le renderer de terminal sous-jacent
 * @returns Une instance de TerminalOutput
 */
export const createTerminalOutput = (renderer: TerminalRenderer): TerminalOutput => {
  return {
    write(text: string): void {
      if (text) {
        renderer.write(text)
      }
    },

    writeLine(text: string): void {
      renderer.write(text + EOL)
    },

    newLine(): void {
      renderer.write(EOL)
    },

    writeLines(lines: string[]): void {
      if (lines.length === 0) {
        return
      }
      renderer.write(lines.join(EOL) + EOL)
    },

    writeError(message: string): void {
      renderer.write(`Error: ${message}${EOL}`)
    },

    writeOutput(output: string): void {
      // Écrit la sortie seulement si non vide
      // Ajoute un saut de ligne si le texte n'en a pas déjà un à la fin
      if (!output) {
        return
      }
      // Normaliser les fins de ligne : \n -> \r\n (xterm.js a besoin de CRLF)
      const normalized = output.replace(/\r?\n/g, EOL)
      if (normalized.endsWith(EOL)) {
        renderer.write(normalized)
      } else {
        renderer.write(normalized + EOL)
      }
    },

    hideCursor(): void {
      renderer.write(CURSOR_HIDE)
    },

    showCursor(): void {
      renderer.write(CURSOR_SHOW)
    },
  }
}

// ─── Utilitaires pour les commandes ──────────────────────────────────────────

/**
 * Formate une sortie de commande pour l'affichage
 * Garantit un saut de ligne à la fin si nécessaire
 */
export const formatCommandOutput = (output: string): string => {
  if (!output) {
    return ''
  }
  if (output.endsWith('\n') || output.endsWith(EOL)) {
    return output
  }
  return output + EOL
}
