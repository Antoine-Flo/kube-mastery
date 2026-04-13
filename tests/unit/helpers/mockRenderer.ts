// ═══════════════════════════════════════════════════════════════════════════
// MOCK RENDERER
// ═══════════════════════════════════════════════════════════════════════════
// Implémentation du TerminalRenderer pour les tests
// Capture toutes les écritures dans un tableau pour assertions

import type { TerminalRenderer } from '../../../src/core/terminal/renderer/TerminalRenderer'

interface MockRenderer extends TerminalRenderer {
  getOutput(): string
  clearOutput(): void
  getCallCount(): number
}

export const createMockRenderer = (): MockRenderer => {
  const output: string[] = []
  let callCount = 0

  return {
    write: (text: string) => {
      output.push(text)
      callCount++
    },

    clearLine: () => {
      output.push('[CLEAR_LINE]')
      callCount++
    },

    focus: () => {
      // No-op in mock
    },

    dispose: () => {
      // No-op in mock
    },

    getOutput: () => {
      return output.join('')
    },

    clearOutput: () => {
      output.length = 0
      callCount = 0
    },

    getCallCount: () => {
      return callCount
    }
  }
}
