import { beforeEach, describe, expect, it } from 'vitest'
import { createMockRenderer } from '../../helpers/mockRenderer'

describe('MockRenderer', () => {
  let renderer: ReturnType<typeof createMockRenderer>

  beforeEach(() => {
    renderer = createMockRenderer()
  })

  describe('write', () => {
    it('should capture written text', () => {
      renderer.write('Hello')
      renderer.write(' World')

      expect(renderer.getOutput()).toBe('Hello World')
      expect(renderer.getCallCount()).toBe(2)
    })

    it('should handle empty strings', () => {
      renderer.write('')

      expect(renderer.getOutput()).toBe('')
      expect(renderer.getCallCount()).toBe(1)
    })
  })

  describe('writeChar', () => {
    it('should capture single character', () => {
      renderer.writeChar('A')
      renderer.writeChar('B')

      expect(renderer.getOutput()).toBe('AB')
    })
  })

  describe('clearLine', () => {
    it('should add clear line marker', () => {
      renderer.write('Hello')
      renderer.clearLine()

      expect(renderer.getOutput()).toBe('Hello[CLEAR_LINE]')
    })
  })

  describe('clearToEnd', () => {
    it('should add clear to end marker', () => {
      renderer.write('Hello')
      renderer.clearToEnd()

      expect(renderer.getOutput()).toBe('Hello[CLEAR_TO_END]')
    })
  })

  describe('moveCursorLeft', () => {
    it('should add cursor left marker', () => {
      renderer.moveCursorLeft()

      expect(renderer.getOutput()).toBe('[CURSOR_LEFT]')
    })
  })

  describe('moveCursorRight', () => {
    it('should add cursor right marker', () => {
      renderer.moveCursorRight()

      expect(renderer.getOutput()).toBe('[CURSOR_RIGHT]')
    })
  })

  describe('setCursorPosition', () => {
    it('should add set cursor marker with position', () => {
      renderer.setCursorPosition(5)

      expect(renderer.getOutput()).toBe('[SET_CURSOR:5]')
    })
  })

  describe('clearOutput', () => {
    it('should clear all captured output', () => {
      renderer.write('Hello')
      renderer.write(' World')

      expect(renderer.getOutput()).toBe('Hello World')
      expect(renderer.getCallCount()).toBe(2)

      renderer.clearOutput()

      expect(renderer.getOutput()).toBe('')
      expect(renderer.getCallCount()).toBe(0)
    })
  })

  describe('focus and dispose', () => {
    it('should not throw on focus', () => {
      expect(() => renderer.focus()).not.toThrow()
    })

    it('should not throw on dispose', () => {
      expect(() => renderer.dispose()).not.toThrow()
    })
  })

  describe('call count tracking', () => {
    it('should track all method calls', () => {
      renderer.write('A')
      renderer.writeChar('B')
      renderer.clearLine()
      renderer.moveCursorLeft()
      renderer.moveCursorRight()
      renderer.setCursorPosition(3)

      expect(renderer.getCallCount()).toBe(6)
    })
  })
})
