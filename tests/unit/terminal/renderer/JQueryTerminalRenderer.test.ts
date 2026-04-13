import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJQueryTerminalRenderer } from '../../../../src/core/terminal/renderer/JQueryTerminalRenderer'

type MockJQueryTerminal = {
  echo: (text: string, options?: { raw?: boolean; ansi?: boolean }) => void
  focus: () => void
  destroy: () => void
}

describe('JQueryTerminalRenderer', () => {
  let terminal: MockJQueryTerminal & {
    echoMock: ReturnType<typeof vi.fn>
    focusMock: ReturnType<typeof vi.fn>
    destroyMock: ReturnType<typeof vi.fn>
  }
  let renderer: ReturnType<typeof createJQueryTerminalRenderer>

  beforeEach(() => {
    const echoMock = vi.fn<
      (text: string, options?: { raw?: boolean; ansi?: boolean }) => void
    >()
    const focusMock = vi.fn<() => void>()
    const destroyMock = vi.fn<() => void>()
    terminal = {
      echo: echoMock,
      focus: focusMock,
      destroy: destroyMock,
      echoMock,
      focusMock,
      destroyMock
    }
    renderer = createJQueryTerminalRenderer(terminal)
  })

  it('writes complete lines through echo', () => {
    renderer.write('hello\r\nworld\r\n')

    expect(terminal.echoMock).toHaveBeenNthCalledWith(1, 'hello', {
      ansi: true
    })
    expect(terminal.echoMock).toHaveBeenNthCalledWith(2, 'world', {
      ansi: true
    })
  })

  it('buffers partial lines until newline arrives', () => {
    renderer.write('hello')
    expect(terminal.echoMock).not.toHaveBeenCalled()

    renderer.write('\r\n')
    expect(terminal.echoMock).toHaveBeenCalledWith('hello', { ansi: true })
  })

  it('ignores cursor visibility control sequences', () => {
    renderer.write('\x1b[?25l')
    renderer.write('\x1b[?25h')
    expect(terminal.echoMock).not.toHaveBeenCalled()
  })

  it('clearLine drops pending partial content', () => {
    renderer.write('pending')
    renderer.clearLine()
    renderer.write('\n')
    expect(terminal.echoMock).not.toHaveBeenCalled()
  })

  it('delegates focus and dispose to terminal instance', () => {
    renderer.focus()
    renderer.dispose()

    expect(terminal.focusMock).toHaveBeenCalledTimes(1)
    expect(terminal.destroyMock).toHaveBeenCalledTimes(1)
  })
})
