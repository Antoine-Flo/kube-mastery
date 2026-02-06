import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTerminalOutput, formatCommandOutput } from '../../../../src/core/terminal/core/TerminalOutput'
import type { TerminalRenderer } from '../../../../src/core/terminal/renderer/TerminalRenderer'


/**
 * Vérifie si une chaîne se termine par un saut de ligne
 */
const hasTrailingNewline = (text: string): boolean => {
  return text.endsWith('\n') || text.endsWith('\r\n')
}


describe('TerminalOutput', () => {
  let mockRenderer: TerminalRenderer
  let writtenText: string

  beforeEach(() => {
    writtenText = ''
    mockRenderer = {
      write: vi.fn((text: string) => {
        writtenText += text
      }),
      writeChar: vi.fn(),
      clearLine: vi.fn(),
      clearToEnd: vi.fn(),
      moveCursorLeft: vi.fn(),
      moveCursorRight: vi.fn(),
      setCursorPosition: vi.fn(),
      focus: vi.fn(),
      dispose: vi.fn(),
    }
  })

  describe('write', () => {
    it('should write text without newline', () => {
      const output = createTerminalOutput(mockRenderer)
      output.write('hello')
      expect(writtenText).toBe('hello')
    })

    it('should not write empty text', () => {
      const output = createTerminalOutput(mockRenderer)
      output.write('')
      expect(mockRenderer.write).not.toHaveBeenCalled()
    })
  })

  describe('writeLine', () => {
    it('should write text with CRLF newline', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeLine('hello')
      expect(writtenText).toBe('hello\r\n')
    })

    it('should write empty line with newline', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeLine('')
      expect(writtenText).toBe('\r\n')
    })
  })

  describe('newLine', () => {
    it('should write CRLF newline', () => {
      const output = createTerminalOutput(mockRenderer)
      output.newLine()
      expect(writtenText).toBe('\r\n')
    })
  })

  describe('writeLines', () => {
    it('should write multiple lines with CRLF between them', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeLines(['line1', 'line2', 'line3'])
      expect(writtenText).toBe('line1\r\nline2\r\nline3\r\n')
    })

    it('should not write anything for empty array', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeLines([])
      expect(mockRenderer.write).not.toHaveBeenCalled()
    })

    it('should handle single line', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeLines(['only one'])
      expect(writtenText).toBe('only one\r\n')
    })
  })

  describe('writeError', () => {
    it('should write error with "Error: " prefix and newline', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeError('something went wrong')
      expect(writtenText).toBe('Error: something went wrong\r\n')
    })
  })

  describe('writeOutput', () => {
    it('should not write empty output', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeOutput('')
      expect(mockRenderer.write).not.toHaveBeenCalled()
    })

    it('should add newline if output does not end with newline', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeOutput('hello')
      expect(writtenText).toBe('hello\r\n')
    })

    it('should normalize LF to CRLF for xterm.js', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeOutput('hello\n')
      expect(writtenText).toBe('hello\r\n')
    })

    it('should not add newline if output ends with CRLF', () => {
      const output = createTerminalOutput(mockRenderer)
      output.writeOutput('hello\r\n')
      expect(writtenText).toBe('hello\r\n')
    })
  })

  describe('hideCursor', () => {
    it('should write ANSI hide cursor sequence', () => {
      const output = createTerminalOutput(mockRenderer)
      output.hideCursor()
      expect(writtenText).toBe('\x1b[?25l')
    })
  })

  describe('showCursor', () => {
    it('should write ANSI show cursor sequence', () => {
      const output = createTerminalOutput(mockRenderer)
      output.showCursor()
      expect(writtenText).toBe('\x1b[?25h')
    })
  })
})

describe('formatCommandOutput', () => {
  it('should return empty string for empty input', () => {
    expect(formatCommandOutput('')).toBe('')
  })

  it('should add CRLF if text does not end with newline', () => {
    expect(formatCommandOutput('hello')).toBe('hello\r\n')
  })

  it('should not add newline if text ends with LF', () => {
    expect(formatCommandOutput('hello\n')).toBe('hello\n')
  })

  it('should not add newline if text ends with CRLF', () => {
    expect(formatCommandOutput('hello\r\n')).toBe('hello\r\n')
  })
})

describe('hasTrailingNewline', () => {
  it('should return false for empty string', () => {
    expect(hasTrailingNewline('')).toBe(false)
  })

  it('should return false for text without newline', () => {
    expect(hasTrailingNewline('hello')).toBe(false)
  })

  it('should return true for text ending with LF', () => {
    expect(hasTrailingNewline('hello\n')).toBe(true)
  })

  it('should return true for text ending with CRLF', () => {
    expect(hasTrailingNewline('hello\r\n')).toBe(true)
  })
})
