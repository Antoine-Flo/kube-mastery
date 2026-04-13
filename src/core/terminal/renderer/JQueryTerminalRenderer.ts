import type { TerminalRenderer } from './TerminalRenderer'

type JQueryTerminalLike = {
  echo: (text: string, options?: { raw?: boolean; ansi?: boolean }) => void
  focus: () => void
  destroy: () => void
}

const CURSOR_VISIBILITY_REGEX = /\x1b\[\?25[hl]/g

const stripUnsupportedControlSequences = (text: string): string => {
  return text.replace(CURSOR_VISIBILITY_REGEX, '')
}

export const createJQueryTerminalRenderer = (
  terminal: JQueryTerminalLike
): TerminalRenderer => {
  let pendingLine = ''

  const flushCompleteLines = (chunk: string): void => {
    const normalizedChunk = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const segments = normalizedChunk.split('\n')
    const finalSegment = segments.pop()

    for (const segment of segments) {
      if (segment.length === 0) {
        continue
      }
      terminal.echo(segment, { ansi: true })
    }

    pendingLine = finalSegment ?? ''
  }

  return {
    write: (text: string): void => {
      if (text.length === 0) {
        return
      }

      const withoutCursorControl = stripUnsupportedControlSequences(text)
      if (withoutCursorControl.length === 0) {
        return
      }
      flushCompleteLines(pendingLine + withoutCursorControl)
    },

    clearLine: (): void => {
      pendingLine = ''
    },

    focus: (): void => {
      terminal.focus()
    },

    dispose: (): void => {
      terminal.destroy()
    }
  }
}
