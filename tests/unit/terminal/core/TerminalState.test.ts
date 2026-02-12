import { describe, expect, it } from 'vitest'
import { createTerminalState } from '../../../../src/core/terminal/core/TerminalState'

describe('TerminalState', () => {
  describe('createTerminalState', () => {
    it('should create state with default values', () => {
      const state = createTerminalState()

      expect(state.currentLine).toBe('')
      expect(state.cursorPosition).toBe(0)
      expect(state.history).toEqual([])
      expect(state.historyIndex).toBe(-1)
      expect(state.tempCurrentLine).toBe('')
    })

    it('should create state with initial values', () => {
      const state = createTerminalState({
        currentLine: 'hello',
        cursorPosition: 3,
        history: ['cmd1', 'cmd2']
      })

      expect(state.currentLine).toBe('hello')
      expect(state.cursorPosition).toBe(3)
      expect(state.history).toEqual(['cmd1', 'cmd2'])
    })
  })

  describe('updateCurrentLine', () => {
    it('should update line and set cursor to end', () => {
      const state = createTerminalState()
      state.updateCurrentLine('hello')

      expect(state.currentLine).toBe('hello')
      expect(state.cursorPosition).toBe(5)
    })

    it('should update line and cursor position', () => {
      const state = createTerminalState()
      state.updateCurrentLine('hello', 2)

      expect(state.currentLine).toBe('hello')
      expect(state.cursorPosition).toBe(2)
    })
  })

  describe('insertCharAtCursor', () => {
    it('should insert char at cursor position', () => {
      const state = createTerminalState({
        currentLine: 'helo',
        cursorPosition: 3
      })
      state.insertCharAtCursor('l')

      expect(state.currentLine).toBe('hello')
      expect(state.cursorPosition).toBe(4)
    })

    it('should insert at start', () => {
      const state = createTerminalState({
        currentLine: 'ello',
        cursorPosition: 0
      })
      state.insertCharAtCursor('h')

      expect(state.currentLine).toBe('hello')
      expect(state.cursorPosition).toBe(1)
    })

    it('should insert at end', () => {
      const state = createTerminalState({
        currentLine: 'hell',
        cursorPosition: 4
      })
      state.insertCharAtCursor('o')

      expect(state.currentLine).toBe('hello')
      expect(state.cursorPosition).toBe(5)
    })
  })

  describe('deleteCharBeforeCursor', () => {
    it('should delete char before cursor', () => {
      const state = createTerminalState({
        currentLine: 'hello',
        cursorPosition: 3
      })
      const result = state.deleteCharBeforeCursor()

      expect(result).toBe(true)
      expect(state.currentLine).toBe('helo')
      expect(state.cursorPosition).toBe(2)
    })

    it('should not delete if cursor at start', () => {
      const state = createTerminalState({
        currentLine: 'hello',
        cursorPosition: 0
      })
      const result = state.deleteCharBeforeCursor()

      expect(result).toBe(false)
      expect(state.currentLine).toBe('hello')
      expect(state.cursorPosition).toBe(0)
    })

    it('should not delete if line is empty', () => {
      const state = createTerminalState({ currentLine: '', cursorPosition: 0 })
      const result = state.deleteCharBeforeCursor()

      expect(result).toBe(false)
      expect(state.currentLine).toBe('')
    })
  })

  describe('moveCursor', () => {
    it('should move cursor left', () => {
      const state = createTerminalState({
        currentLine: 'hello',
        cursorPosition: 3
      })
      const result = state.moveCursor('left')

      expect(result).toBe(true)
      expect(state.cursorPosition).toBe(2)
    })

    it('should move cursor right', () => {
      const state = createTerminalState({
        currentLine: 'hello',
        cursorPosition: 2
      })
      const result = state.moveCursor('right')

      expect(result).toBe(true)
      expect(state.cursorPosition).toBe(3)
    })

    it('should not move left if at start', () => {
      const state = createTerminalState({
        currentLine: 'hello',
        cursorPosition: 0
      })
      const result = state.moveCursor('left')

      expect(result).toBe(false)
      expect(state.cursorPosition).toBe(0)
    })

    it('should not move right if at end', () => {
      const state = createTerminalState({
        currentLine: 'hello',
        cursorPosition: 5
      })
      const result = state.moveCursor('right')

      expect(result).toBe(false)
      expect(state.cursorPosition).toBe(5)
    })
  })

  describe('clearCurrentLine', () => {
    it('should clear line and reset cursor', () => {
      const state = createTerminalState({
        currentLine: 'hello',
        cursorPosition: 3
      })
      state.clearCurrentLine()

      expect(state.currentLine).toBe('')
      expect(state.cursorPosition).toBe(0)
    })
  })

  describe('addToHistory', () => {
    it('should add command to history', () => {
      const state = createTerminalState()
      state.addToHistory('kubectl get pods')

      expect(state.history).toEqual(['kubectl get pods'])
    })

    it('should not add empty command', () => {
      const state = createTerminalState()
      state.addToHistory('   ')

      expect(state.history).toEqual([])
    })

    it('should limit history to 100 commands', () => {
      const state = createTerminalState()

      for (let i = 0; i < 101; i++) {
        state.addToHistory(`cmd${i}`)
      }

      expect(state.history.length).toBe(100)
      expect(state.history[0]).toBe('cmd1') // First should be removed
      expect(state.history[99]).toBe('cmd100')
    })
  })

  describe('navigateHistory', () => {
    it('should navigate up in history', () => {
      const state = createTerminalState({
        currentLine: 'current',
        history: ['cmd1', 'cmd2', 'cmd3'],
        historyIndex: -1
      })

      const result = state.navigateHistory('up')

      expect(result).toBe('cmd3')
      expect(state.historyIndex).toBe(0)
      expect(state.tempCurrentLine).toBe('current')
    })

    it('should navigate down in history', () => {
      const state = createTerminalState({
        currentLine: '',
        history: ['cmd1', 'cmd2'],
        historyIndex: 0,
        tempCurrentLine: 'temp'
      })

      const result = state.navigateHistory('down')

      expect(result).toBe('temp')
      expect(state.historyIndex).toBe(-1)
    })

    it('should return null if history is empty', () => {
      const state = createTerminalState({ history: [] })
      const result = state.navigateHistory('up')

      expect(result).toBeNull()
    })

    it('should not go beyond history bounds', () => {
      const state = createTerminalState({
        history: ['cmd1'],
        historyIndex: 0
      })

      const result = state.navigateHistory('up')

      expect(result).toBe('cmd1') // Should stay at last item
      expect(state.historyIndex).toBe(0)
    })
  })

  describe('resetHistoryNavigation', () => {
    it('should reset history navigation', () => {
      const state = createTerminalState({
        historyIndex: 2,
        tempCurrentLine: 'temp'
      })

      state.resetHistoryNavigation()

      expect(state.historyIndex).toBe(-1)
      expect(state.tempCurrentLine).toBe('')
    })
  })

  describe('resetAfterCommand', () => {
    it('should reset state after command', () => {
      const state = createTerminalState({
        currentLine: 'command',
        cursorPosition: 7,
        historyIndex: 1,
        tempCurrentLine: 'temp'
      })

      state.resetAfterCommand()

      expect(state.currentLine).toBe('')
      expect(state.cursorPosition).toBe(0)
      expect(state.historyIndex).toBe(-1)
      expect(state.tempCurrentLine).toBe('')
    })
  })

  describe('getCurrentToken', () => {
    it('should get current token from line', () => {
      const state = createTerminalState({ currentLine: 'kubectl get pods' })
      const token = state.getCurrentToken()

      expect(token).toBe('pods')
    })

    it('should return whole line if no spaces', () => {
      const state = createTerminalState({ currentLine: 'kubectl' })
      const token = state.getCurrentToken()

      expect(token).toBe('kubectl')
    })

    it('should return empty string if line ends with space', () => {
      const state = createTerminalState({ currentLine: 'kubectl get ' })
      const token = state.getCurrentToken()

      expect(token).toBe('')
    })
  })
})
