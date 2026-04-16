import { describe, expect, it } from 'vitest'
import { resolveCtrlCAction } from '../../../src/core/terminal/TerminalManager'

describe('resolveCtrlCAction', () => {
  it('returns copy-selection when text is selected', () => {
    const action = resolveCtrlCAction({
      selectedText: 'selected',
      currentCommand: 'kubectl get pods',
      interruptHandled: false
    })
    expect(action).toBe('copy-selection')
  })

  it('returns interrupt when stream interruption is handled', () => {
    const action = resolveCtrlCAction({
      selectedText: '',
      currentCommand: '',
      interruptHandled: true
    })
    expect(action).toBe('interrupt')
  })

  it('returns cancel-command when a command is currently typed', () => {
    const action = resolveCtrlCAction({
      selectedText: '',
      currentCommand: 'kubectl get pods -w',
      interruptHandled: false
    })
    expect(action).toBe('cancel-command')
  })

  it('returns noop when no selection, no stream and no command', () => {
    const action = resolveCtrlCAction({
      selectedText: '',
      currentCommand: '   ',
      interruptHandled: false
    })
    expect(action).toBe('noop')
  })
})
