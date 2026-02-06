// ═══════════════════════════════════════════════════════════════════════════
// XTERM RENDERER
// ═══════════════════════════════════════════════════════════════════════════
// Implémentation du TerminalRenderer utilisant xterm.js

import { Terminal as XTermTerminal } from '@xterm/xterm'
import type { TerminalRenderer } from './TerminalRenderer'

export const createXTermRenderer = (terminal: XTermTerminal): TerminalRenderer => {
  return {
    write: (text: string) => {
      terminal.write(text)
    },

    writeChar: (char: string) => {
      terminal.write(char)
    },

    clearLine: () => {
      terminal.write('\x1b[2K') // Clear entire line
    },

    clearToEnd: () => {
      terminal.write('\x1b[K') // Clear from cursor to end of line
    },

    moveCursorLeft: () => {
      terminal.write('\x1b[D') // ANSI escape code for cursor left
    },

    moveCursorRight: () => {
      terminal.write('\x1b[C') // ANSI escape code for cursor right
    },

    setCursorPosition: (position: number) => {
      // For now, we'll use relative movement
      // This could be enhanced with actual position tracking
      const currentPos = 0 // Would need to track this
      const diff = position - currentPos
      if (diff < 0) {
        for (let i = 0; i < Math.abs(diff); i++) {
          terminal.write('\x1b[D')
        }
      } else if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          terminal.write('\x1b[C')
        }
      }
    },

    focus: () => {
      terminal.focus()
    },

    dispose: () => {
      terminal.dispose()
    }
  }
}
