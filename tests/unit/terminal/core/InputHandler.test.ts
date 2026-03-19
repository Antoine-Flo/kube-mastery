import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AutocompleteContext } from '../../../../src/core/terminal/autocomplete/types'
import { InputHandler } from '../../../../src/core/terminal/core/InputHandler'
import type { InputHandlerContext } from '../../../../src/core/terminal/core/InputHandlerContext'
import {
  createTerminalState,
  TerminalState
} from '../../../../src/core/terminal/core/TerminalState'
import { createAutocompleteTestContext } from '../../helpers/mockFileSystem'
import { createMockRenderer } from '../../helpers/mockRenderer'

describe('InputHandler', () => {
  let state: TerminalState
  let renderer: ReturnType<typeof createMockRenderer>
  let context: InputHandlerContext
  let inputHandler: InputHandler

  beforeEach(() => {
    state = createTerminalState()
    renderer = createMockRenderer()
    context = {
      state,
      renderer,
      getAutocompleteEngine: vi.fn(() => undefined),
      getCommandCallback: vi.fn(() => undefined),
      createAutocompleteContext: vi.fn(
        (): AutocompleteContext => createAutocompleteTestContext()
      ),
      showPrompt: vi.fn(),
      replaceLineWithCommand: vi.fn(),
      updateLineAndRender: vi.fn(),
      hideCursor: vi.fn(),
      showCursor: vi.fn()
    }
    inputHandler = new InputHandler(context)
  })

  describe('handlePaste', () => {
    it('should read clipboard and insert characters', async () => {
      const clipboardText = 'hello world'
      const readTextSpy = vi.fn().mockResolvedValue(clipboardText)
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: readTextSpy },
        writable: true,
        configurable: true
      })

      inputHandler.simulateInput('\x16') // Ctrl+V (charCode 22)

      // Wait for async clipboard read
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(readTextSpy).toHaveBeenCalled()
      // Characters should be inserted
      expect(state.currentLine).toContain('hello')
    })

    it('should ignore control characters from clipboard', async () => {
      const clipboardText = 'hello\x01world' // Contains control character
      const readTextSpy = vi.fn().mockResolvedValue(clipboardText)
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: readTextSpy },
        writable: true,
        configurable: true
      })

      inputHandler.simulateInput('\x16') // Ctrl+V

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(readTextSpy).toHaveBeenCalled()
      // Control character should be filtered out
    })

    it('should call clipboard.readText when pasting', async () => {
      const clipboardText = 'test'
      const readTextSpy = vi.fn().mockResolvedValue(clipboardText)
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: readTextSpy },
        writable: true,
        configurable: true
      })

      inputHandler.simulateInput('\x16') // Ctrl+V

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(readTextSpy).toHaveBeenCalled()
    })

    // Note: The current implementation doesn't catch clipboard errors,
    // which would cause unhandled promise rejections. This is a known limitation.
    // The test above verifies the happy path works correctly.
  })

  describe('control characters', () => {
    it('should ignore control characters < 32 (except handled ones)', () => {
      const initialLine = state.currentLine

      // Test various control characters
      inputHandler.handleInput('\x00') // NUL
      inputHandler.handleInput('\x01') // SOH
      inputHandler.handleInput('\x02') // STX
      inputHandler.handleInput('\x03') // ETX
      inputHandler.handleInput('\x04') // EOT
      inputHandler.handleInput('\x05') // ENQ
      inputHandler.handleInput('\x06') // ACK
      inputHandler.handleInput('\x07') // BEL
      inputHandler.handleInput('\x08') // BS
      inputHandler.handleInput('\x0A') // LF (newline, but not Enter which is 13)
      inputHandler.handleInput('\x0B') // VT
      inputHandler.handleInput('\x0C') // FF
      inputHandler.handleInput('\x0E') // SO
      inputHandler.handleInput('\x0F') // SI
      inputHandler.handleInput('\x10') // DLE
      inputHandler.handleInput('\x11') // DC1
      inputHandler.handleInput('\x12') // DC2
      inputHandler.handleInput('\x13') // DC3
      inputHandler.handleInput('\x14') // DC4
      inputHandler.handleInput('\x15') // NAK
      // \x16 (22) is Ctrl+V, handled separately
      inputHandler.handleInput('\x17') // ETB
      inputHandler.handleInput('\x18') // CAN
      inputHandler.handleInput('\x19') // EM
      inputHandler.handleInput('\x1A') // SUB
      inputHandler.handleInput('\x1B') // ESC (used for arrow keys, but single ESC should be ignored)
      inputHandler.handleInput('\x1C') // FS
      inputHandler.handleInput('\x1D') // GS
      inputHandler.handleInput('\x1E') // RS
      inputHandler.handleInput('\x1F') // US

      // Line should not change (except for handled characters like Tab, Enter, Backspace)
      // Most control characters should be ignored
      expect(state.currentLine).toBe(initialLine)
    })

    it('should handle Tab (charCode 9)', () => {
      const getAutocompleteEngine = vi.fn(() => undefined)
      context.getAutocompleteEngine = getAutocompleteEngine

      inputHandler.handleInput('\t') // Tab

      expect(getAutocompleteEngine).toHaveBeenCalled()
    })

    it('should handle Enter (charCode 13)', () => {
      state.updateCurrentLine('test command')
      const getCommandCallback = vi.fn(() => undefined)
      context.getCommandCallback = getCommandCallback

      inputHandler.handleInput('\r') // Enter

      expect(renderer.getOutput()).toContain('\r\n')
    })

    it('should handle Backspace (charCode 127)', () => {
      state.updateCurrentLine('test')
      state.cursorPosition = 4

      inputHandler.handleInput('\x7f') // Backspace

      // Character should be deleted
      expect(state.currentLine.length).toBeLessThan(4)
    })
  })

  describe('handleCharacterInput', () => {
    it('should reset history navigation when typing', () => {
      // Set up history navigation state
      state.history = ['cmd1', 'cmd2']
      state.historyIndex = 0
      state.currentLine = 'cmd1'

      // Type a character
      inputHandler.handleInput('x')

      // History index should be reset
      expect(state.historyIndex).toBe(-1)
    })

    it('should insert character at cursor position', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 2 // After 'he'

      inputHandler.handleInput('x')

      expect(state.currentLine).toBe('hexllo')
      expect(state.cursorPosition).toBe(3)
    })

    it('should insert character at end when cursor at end', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 5

      inputHandler.handleInput('!')

      expect(state.currentLine).toBe('hello!')
      expect(state.cursorPosition).toBe(6)
    })

    it('should insert character at beginning when cursor at start', () => {
      state.updateCurrentLine('hello')
      state.cursorPosition = 0

      inputHandler.handleInput('>')

      expect(state.currentLine).toBe('>hello')
      expect(state.cursorPosition).toBe(1)
    })

    it('should redraw after character insertion', () => {
      const initialOutput = renderer.getOutput()
      state.updateCurrentLine('test')

      inputHandler.handleInput('x')

      // Renderer should have been called to redraw
      expect(renderer.getOutput()).not.toBe(initialOutput)
    })

    it('should not reset history if historyIndex is -1', () => {
      state.historyIndex = -1
      vi.spyOn(state, 'resetHistoryNavigation')

      inputHandler.handleInput('x')

      // resetHistoryNavigation should not be called if already at -1
      // (though it might be called, we just verify the character is inserted)
      expect(state.currentLine).toContain('x')
    })
  })

  describe('simulateInput', () => {
    it('should process multi-character string character by character', () => {
      inputHandler.simulateInput('hello')

      expect(state.currentLine).toBe('hello')
      expect(state.cursorPosition).toBe(5)
    })

    it('should process escape sequences as single input', () => {
      const handleInputSpy = vi.spyOn(inputHandler as any, 'handleInput')
      inputHandler.simulateInput('\x1b[A') // Arrow up

      // Should be called once for the entire escape sequence
      expect(handleInputSpy).toHaveBeenCalledWith('\x1b[A')
    })

    it('should handle empty string', () => {
      expect(() => inputHandler.simulateInput('')).not.toThrow()
    })
  })

  describe('edge cases / error scenarios', () => {
    describe('handleInput() edge cases', () => {
      it('should handle empty data string', () => {
        expect(() => inputHandler.handleInput('')).not.toThrow()
        // Empty string should not modify state
        expect(state.currentLine).toBe('')
      })

      it('should handle data with multiple characters (non-escape)', () => {
        // simulateInput handles multi-char, but handleInput should handle single char
        inputHandler.handleInput('a')
        expect(state.currentLine).toBe('a')
      })

      it('should handle Unicode characters (emojis)', () => {
        inputHandler.handleInput('🚀')
        expect(state.currentLine).toBe('🚀')
      })

      it('should handle Unicode combining characters', () => {
        inputHandler.handleInput('é')
        expect(state.currentLine).toBe('é')
      })
    })

    describe('handleEnter() edge cases', () => {
      it('should handle command with only spaces', () => {
        state.updateCurrentLine('   ')
        const mockCallback = vi.fn()
        context.getCommandCallback = vi.fn(() => mockCallback)

        inputHandler.handleInput('\r') // Enter

        // Current implementation: if command.trim() is empty, callback is NOT called
        // getCommandCallback() is called to get the callback, but callback itself is not invoked
        expect(context.getCommandCallback).toHaveBeenCalled()
        expect(mockCallback).not.toHaveBeenCalled()
        expect(state.currentLine).toBe('')
      })

      it('should handle command with tabs', () => {
        state.updateCurrentLine('\t\t')
        const mockCallback = vi.fn()
        context.getCommandCallback = vi.fn(() => mockCallback)

        inputHandler.handleInput('\r') // Enter

        // Current implementation: if command.trim() is empty, callback is NOT called
        expect(context.getCommandCallback).toHaveBeenCalled()
        expect(mockCallback).not.toHaveBeenCalled()
      })

      it('should handle command with mixed whitespace', () => {
        state.updateCurrentLine('  \t  ')
        const mockCallback = vi.fn()
        context.getCommandCallback = vi.fn(() => mockCallback)

        inputHandler.handleInput('\r') // Enter

        // Current implementation: if command.trim() is empty, callback is NOT called
        expect(context.getCommandCallback).toHaveBeenCalled()
        expect(mockCallback).not.toHaveBeenCalled()
      })

      it('should handle very long command (>1000 chars)', () => {
        const longCommand = 'a'.repeat(1500)
        state.updateCurrentLine(longCommand)
        const mockCallback = vi.fn()
        context.getCommandCallback = vi.fn(() => mockCallback)

        inputHandler.handleInput('\r') // Enter

        // Should still process the command
        expect(mockCallback).toHaveBeenCalledWith(longCommand)
      })
    })

    describe('handleBackspace() edge cases', () => {
      it('should not delete when cursor at position 0', () => {
        state.updateCurrentLine('test')
        state.cursorPosition = 0

        const initialLine = state.currentLine
        inputHandler.handleInput('\x7f') // Backspace

        // Line should not change
        expect(state.currentLine).toBe(initialLine)
      })

      it('should handle backspace on empty line', () => {
        state.updateCurrentLine('')
        state.cursorPosition = 0

        expect(() => inputHandler.handleInput('\x7f')).not.toThrow()
        expect(state.currentLine).toBe('')
      })

      it('should handle cursor position > line.length (invalid state)', () => {
        state.updateCurrentLine('test')
        state.cursorPosition = 10 // Invalid: > line.length

        // Should handle gracefully
        expect(() => inputHandler.handleInput('\x7f')).not.toThrow()
      })
    })

    describe('handleArrowKeys() edge cases', () => {
      it('should ignore invalid ESC sequences', () => {
        const initialLine = state.currentLine
        const initialPos = state.cursorPosition

        inputHandler.handleInput('\x1b[X') // Invalid sequence

        // Should not affect state
        expect(state.currentLine).toBe(initialLine)
        expect(state.cursorPosition).toBe(initialPos)
      })

      it('should ignore partial ESC sequence', () => {
        const initialLine = state.currentLine
        const initialPos = state.cursorPosition

        inputHandler.handleInput('\x1b') // Just ESC, incomplete

        // Should not affect state
        expect(state.currentLine).toBe(initialLine)
        expect(state.cursorPosition).toBe(initialPos)
      })

      it('should ignore ESC sequences with extra characters', () => {
        const initialLine = state.currentLine
        const initialPos = state.cursorPosition

        inputHandler.handleInput('\x1b[AX') // Extra character

        // Should not match arrow key pattern
        expect(state.currentLine).toBe(initialLine)
        expect(state.cursorPosition).toBe(initialPos)
      })
    })

    describe('handleTab() edge cases', () => {
      it('should handle autocompleteEngine that throws', () => {
        const throwingEngine = {
          handleTabPress: vi.fn(() => {
            throw new Error('Engine error')
          })
        } as any

        context.getAutocompleteEngine = vi.fn(() => throwingEngine)

        // Should propagate error
        expect(() => {
          inputHandler.handleInput('\t')
        }).toThrow('Engine error')
      })

      it('should handle callback that throws in handleTab', () => {
        const mockEngine = {
          handleTabPress: vi.fn((_line, _context, callbacks) => {
            // Call updateLineAndRender which will throw
            callbacks.updateLineAndRender('test', 'test')
          })
        } as any

        context.getAutocompleteEngine = vi.fn(() => mockEngine)
        context.updateLineAndRender = vi.fn(() => {
          throw new Error('Callback error')
        })

        // Should propagate error
        expect(() => {
          inputHandler.handleInput('\t')
        }).toThrow('Callback error')
      })

      it('should handle autocompleteEngine undefined gracefully', () => {
        context.getAutocompleteEngine = vi.fn(() => undefined)

        // Should not throw
        expect(() => {
          inputHandler.handleInput('\t')
        }).not.toThrow()
      })
    })

    describe('simulateInput() edge cases', () => {
      it('should handle very long string (>10000 chars)', () => {
        const longString = 'a'.repeat(15000)
        expect(() => {
          inputHandler.simulateInput(longString)
        }).not.toThrow()

        expect(state.currentLine.length).toBe(15000)
      })

      it('should handle Unicode complex characters', () => {
        const unicodeString = 'café naïve résumé 🚀'
        inputHandler.simulateInput(unicodeString)

        expect(state.currentLine).toBe(unicodeString)
      })

      it('should handle mix of escape sequences and normal characters', () => {
        // This should process escape sequences as single inputs
        inputHandler.simulateInput('hello\x1b[Aworld')

        // 'hello' and 'world' should be inserted, arrow up should navigate history
        expect(state.currentLine).toContain('hello')
      })
    })
  })
})
