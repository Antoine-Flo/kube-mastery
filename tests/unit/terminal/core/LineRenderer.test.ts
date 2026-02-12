import { beforeEach, describe, expect, it } from 'vitest'
import { LineRenderer } from '../../../../src/core/terminal/core/LineRenderer'
import {
  createTerminalState,
  TerminalState
} from '../../../../src/core/terminal/core/TerminalState'
import { createMockRenderer } from '../../helpers/mockRenderer'

describe('LineRenderer', () => {
  let state: TerminalState
  let renderer: ReturnType<typeof createMockRenderer>
  let lineRenderer: LineRenderer

  beforeEach(() => {
    state = createTerminalState()
    renderer = createMockRenderer()
    lineRenderer = new LineRenderer(state, renderer)
  })

  describe('redrawFromCursor', () => {
    it('should redraw from start position to end', () => {
      state.updateCurrentLine('hello world')
      state.cursorPosition = 11

      lineRenderer.redrawFromCursor(6) // From 'world'

      expect(renderer.getOutput()).toContain('world')
      expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
    })

    it('should clear to end before writing', () => {
      state.updateCurrentLine('test')
      state.cursorPosition = 4

      lineRenderer.redrawFromCursor(0)

      const output = renderer.getOutput()
      const clearIndex = output.indexOf('[CLEAR_TO_END]')
      const writeIndex = output.indexOf('test')
      expect(clearIndex).toBeLessThan(writeIndex)
    })

    it('should reposition cursor correctly', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 3 // After 'hel'

      lineRenderer.redrawFromCursor(2) // From 'llo'

      // Should move cursor left to position it correctly
      expect(renderer.getOutput()).toContain('[CURSOR_LEFT]')
    })

    it('should handle cursorOffset correctly', () => {
      state.updateCurrentLine('hello world')
      state.cursorPosition = 8 // After 'hello w'

      lineRenderer.redrawFromCursor(6) // From 'world'
      // cursorOffset = 8 - 6 = 2
      // remaining.length = 5 ('world')
      // Should move left: 5 - 2 = 3 times

      const output = renderer.getOutput()
      const leftMoves = (output.match(/\[CURSOR_LEFT\]/g) || []).length
      expect(leftMoves).toBeGreaterThan(0)
    })

    it('should handle empty remaining text', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 5

      lineRenderer.redrawFromCursor(5)

      expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
    })

    it('should handle startPosition at beginning', () => {
      state.updateCurrentLine('test')
      state.cursorPosition = 4

      lineRenderer.redrawFromCursor(0)

      expect(renderer.getOutput()).toContain('test')
    })
  })

  describe('redrawAfterBackspace', () => {
    it('should move cursor left', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 3

      lineRenderer.redrawAfterBackspace()

      expect(renderer.getOutput()).toContain('[CURSOR_LEFT]')
    })

    it('should clear to end', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 3

      lineRenderer.redrawAfterBackspace()

      expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
    })

    it('should rewrite remaining text', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 3 // After 'hel'

      lineRenderer.redrawAfterBackspace()

      // After backspace, we deleted 'l', so remaining is 'lo' (from cursor position 2)
      // But the state hasn't been updated yet, so remaining = currentLine.slice(3) = 'lo'
      expect(renderer.getOutput()).toContain('lo')
    })

    it('should reposition cursor after rewriting', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 3

      lineRenderer.redrawAfterBackspace()

      const output = renderer.getOutput()
      // Should have multiple cursor left moves to reposition
      const leftMoves = (output.match(/\[CURSOR_LEFT\]/g) || []).length
      expect(leftMoves).toBeGreaterThan(1) // At least one for initial move, one for repositioning
    })

    it('should handle backspace at end of line', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 5

      lineRenderer.redrawAfterBackspace()

      // Should still perform the operations even if at end
      expect(renderer.getOutput()).toContain('[CURSOR_LEFT]')
      expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
    })

    it('should handle backspace with empty remaining text', () => {
      state.updateCurrentLine('h')
      state.cursorPosition = 1

      lineRenderer.redrawAfterBackspace()

      // Should still move cursor and clear
      expect(renderer.getOutput()).toContain('[CURSOR_LEFT]')
      expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
    })

    it('should reposition cursor correctly for remaining.length', () => {
      state.updateCurrentLine('hello world')
      state.cursorPosition = 6 // After 'hello '

      lineRenderer.redrawAfterBackspace()

      // remaining = 'world' (5 chars)
      // Should move left 5 times to reposition
      const output = renderer.getOutput()
      const leftMoves = (output.match(/\[CURSOR_LEFT\]/g) || []).length
      // At least 1 for initial move + 5 for repositioning
      expect(leftMoves).toBeGreaterThanOrEqual(5)
    })
  })

  describe('redrawAfterCharacterInsert', () => {
    it('should redraw from cursorPosition - 1', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 3 // After 'hel', just inserted 'l'

      lineRenderer.redrawAfterCharacterInsert()

      // Should redraw from position 2 ('llo')
      expect(renderer.getOutput()).toContain('llo')
    })

    it('should clear to end before writing', () => {
      state.updateCurrentLine('test')
      state.cursorPosition = 2

      lineRenderer.redrawAfterCharacterInsert()

      const output = renderer.getOutput()
      const clearIndex = output.indexOf('[CLEAR_TO_END]')
      const writeIndex = output.indexOf('st') // remaining from cursorPosition - 1
      expect(clearIndex).toBeLessThan(writeIndex)
    })

    it('should reposition cursor correctly', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 3

      lineRenderer.redrawAfterCharacterInsert()

      // remaining = 'llo' (3 chars), should move left 2 times (remaining.length - 1)
      const output = renderer.getOutput()
      const leftMoves = (output.match(/\[CURSOR_LEFT\]/g) || []).length
      expect(leftMoves).toBe(2)
    })

    it('should handle cursor at beginning', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 1 // Just inserted first char

      lineRenderer.redrawAfterCharacterInsert()

      // Should redraw from position 0
      expect(renderer.getOutput()).toContain('hello')
    })

    it('should handle cursor at end', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 5

      lineRenderer.redrawAfterCharacterInsert()

      // remaining = 'o' (1 char), should not move left (1 - 1 = 0)
      const output = renderer.getOutput()
      const leftMoves = (output.match(/\[CURSOR_LEFT\]/g) || []).length
      expect(leftMoves).toBe(0)
    })

    it('should handle single character line', () => {
      state.updateCurrentLine('a')
      state.cursorPosition = 1

      lineRenderer.redrawAfterCharacterInsert()

      // remaining = 'a' (1 char), should not move left
      const output = renderer.getOutput()
      const leftMoves = (output.match(/\[CURSOR_LEFT\]/g) || []).length
      expect(leftMoves).toBe(0)
    })

    it('should calculate remaining correctly', () => {
      state.updateCurrentLine('hello world')
      state.cursorPosition = 6 // After 'hello ', just inserted 'w'

      lineRenderer.redrawAfterCharacterInsert()

      // Should redraw 'world' (from position 5)
      expect(renderer.getOutput()).toContain('world')
    })
  })

  describe('replaceLine', () => {
    it('should move cursor to beginning', () => {
      state.updateCurrentLine('old line')
      state.cursorPosition = 8

      lineRenderer.replaceLine('new line')

      // Should move cursor left to beginning
      expect(renderer.getOutput()).toContain('[CURSOR_LEFT]')
    })

    it('should clear to end', () => {
      state.updateCurrentLine('old line')

      lineRenderer.replaceLine('new line')

      expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
    })

    it('should write new line', () => {
      state.updateCurrentLine('old')

      lineRenderer.replaceLine('new')

      expect(renderer.getOutput()).toContain('new')
    })

    it('should update state with new line and cursor at end', () => {
      state.updateCurrentLine('old')
      state.cursorPosition = 2

      lineRenderer.replaceLine('new line')

      expect(state.currentLine).toBe('new line')
      expect(state.cursorPosition).toBe(8)
    })

    it('should handle empty new line', () => {
      state.updateCurrentLine('old')

      lineRenderer.replaceLine('')

      expect(state.currentLine).toBe('')
      expect(state.cursorPosition).toBe(0)
    })

    it('should handle replacing with longer line', () => {
      state.updateCurrentLine('short')

      lineRenderer.replaceLine('much longer line')

      expect(state.currentLine).toBe('much longer line')
      expect(state.cursorPosition).toBe(16) // 'much longer line' has 16 characters
    })

    it('should handle replacing with shorter line', () => {
      state.updateCurrentLine('very long line')

      lineRenderer.replaceLine('short')

      expect(state.currentLine).toBe('short')
      expect(state.cursorPosition).toBe(5)
    })
  })

  describe('edge cases / error scenarios', () => {
    describe('redrawFromCursor() edge cases', () => {
      it('should handle startPosition > cursorPosition', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 2

        // startPosition > cursorPosition creates negative cursorOffset
        lineRenderer.redrawFromCursor(5)

        // Should still execute (may produce unexpected results, but shouldn't crash)
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })

      it('should handle startPosition < 0', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 3

        // Negative startPosition
        lineRenderer.redrawFromCursor(-1)

        // Should handle gracefully
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })

      it('should handle startPosition > line.length', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 3

        lineRenderer.redrawFromCursor(10)

        // Should handle gracefully
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })

      it('should handle startPosition === cursorPosition', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 3

        lineRenderer.redrawFromCursor(3)

        // cursorOffset = 0, remaining.length = 2, should move left 2 times
        const output = renderer.getOutput()
        const leftMoves = (output.match(/\[CURSOR_LEFT\]/g) || []).length
        expect(leftMoves).toBe(2)
      })

      it('should handle negative cursorOffset (invalid case)', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 2

        // startPosition = 5 > cursorPosition = 2, so cursorOffset is negative
        lineRenderer.redrawFromCursor(5)

        // Should handle gracefully
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })
    })

    describe('redrawAfterBackspace() edge cases', () => {
      it('should handle cursorPosition = 0', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 0

        lineRenderer.redrawAfterBackspace()

        // Should still perform operations (move left, clear, write)
        expect(renderer.getOutput()).toContain('[CURSOR_LEFT]')
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })

      it('should handle empty line', () => {
        state.updateCurrentLine('')
        state.cursorPosition = 0

        lineRenderer.redrawAfterBackspace()

        // Should still perform operations
        expect(renderer.getOutput()).toContain('[CURSOR_LEFT]')
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })

      it('should handle cursorPosition > line.length (invalid state)', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 10 // Invalid: > line.length

        lineRenderer.redrawAfterBackspace()

        // Should handle gracefully
        expect(renderer.getOutput()).toContain('[CURSOR_LEFT]')
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })

      it('should handle remaining empty (cursor at end)', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 5

        lineRenderer.redrawAfterBackspace()

        // remaining = '' (empty), should still move left and clear
        expect(renderer.getOutput()).toContain('[CURSOR_LEFT]')
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })
    })

    describe('redrawAfterCharacterInsert() edge cases', () => {
      it('should handle cursorPosition = 0 (insertion at beginning)', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 0

        // This is an invalid state (can't insert at position 0 if line is not empty)
        // But test that it handles gracefully
        lineRenderer.redrawAfterCharacterInsert()

        // remaining = currentLine.slice(-1) = 'o'
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })

      it('should handle cursorPosition = 1 (insertion at beginning, line non-empty)', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 1

        lineRenderer.redrawAfterCharacterInsert()

        // remaining = currentLine.slice(0) = 'hello'
        expect(renderer.getOutput()).toContain('hello')
      })

      it('should handle cursorPosition > line.length (invalid state)', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 10 // Invalid

        lineRenderer.redrawAfterCharacterInsert()

        // Should handle gracefully
        expect(renderer.getOutput()).toContain('[CLEAR_TO_END]')
      })

      it('should handle remaining.length = 0 (insertion at end)', () => {
        state.updateCurrentLine('hello')
        state.cursorPosition = 5

        lineRenderer.redrawAfterCharacterInsert()

        // remaining = currentLine.slice(4) = 'o'
        // Should not move left (1 - 1 = 0)
        const output = renderer.getOutput()
        const leftMoves = (output.match(/\[CURSOR_LEFT\]/g) || []).length
        expect(leftMoves).toBe(0)
      })
    })

    describe('replaceLine() edge cases', () => {
      it('should handle very long line (>1000 chars)', () => {
        const longLine = 'a'.repeat(2000)
        state.updateCurrentLine('short')

        lineRenderer.replaceLine(longLine)

        expect(state.currentLine).toBe(longLine)
        expect(state.cursorPosition).toBe(2000)
      })

      it('should handle line with special characters', () => {
        const specialLine = 'test-123_test.456@789'
        state.updateCurrentLine('old')

        lineRenderer.replaceLine(specialLine)

        expect(state.currentLine).toBe(specialLine)
        expect(renderer.getOutput()).toContain(specialLine)
      })

      it('should handle line with Unicode characters', () => {
        const unicodeLine = 'café naïve résumé'
        state.updateCurrentLine('old')

        lineRenderer.replaceLine(unicodeLine)

        expect(state.currentLine).toBe(unicodeLine)
        expect(renderer.getOutput()).toContain(unicodeLine)
      })

      it('should handle line with emojis', () => {
        const emojiLine = 'hello 🚀 world 🌍'
        state.updateCurrentLine('old')

        lineRenderer.replaceLine(emojiLine)

        expect(state.currentLine).toBe(emojiLine)
        expect(renderer.getOutput()).toContain(emojiLine)
      })

      it('should handle newLine === currentLine (identical replacement)', () => {
        state.updateCurrentLine('test')
        state.cursorPosition = 2

        lineRenderer.replaceLine('test')

        // Should still update cursor position to end
        expect(state.currentLine).toBe('test')
        expect(state.cursorPosition).toBe(4)
      })
    })
  })
})
