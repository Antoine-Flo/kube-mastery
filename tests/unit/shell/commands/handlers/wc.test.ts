import { describe, expect, it } from 'vitest'
import { success } from '../../../../../src/core/shared/result'
import { createWcHandler } from '../../../../../src/core/shell/commands/handlers/fileops/wc'
import { createMockFileSystem } from '../../../helpers/mockFileSystem'

describe('wc handler', () => {
  it('counts lines from stdin with -l', () => {
    const handler = createWcHandler(createMockFileSystem())
    const result = handler.execute(
      [],
      { l: true },
      {
        stdin: 'pod-a\npod-b\n'
      }
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('2')
    }
  })

  it('counts lines from stdin without flags', () => {
    const handler = createWcHandler(createMockFileSystem())
    const result = handler.execute(
      [],
      {},
      {
        stdin: 'one\ntwo\nthree\n'
      }
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('3')
    }
  })

  it('counts lines in a single file', () => {
    const fileSystem = createMockFileSystem({
      readFile: (filePath: string) => {
        if (filePath === '/tmp/data.txt') {
          return success('a\nb\n')
        }
        return success('')
      }
    })
    const handler = createWcHandler(fileSystem)
    const result = handler.execute(['/tmp/data.txt'], { l: true })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('2 /tmp/data.txt')
    }
  })

  it('counts lines in multiple files', () => {
    const fileSystem = createMockFileSystem({
      readFile: (filePath: string) => {
        if (filePath === '/tmp/a.txt') {
          return success('x\n')
        }
        if (filePath === '/tmp/b.txt') {
          return success('y\nz\n')
        }
        return success('')
      }
    })
    const handler = createWcHandler(fileSystem)
    const result = handler.execute(['/tmp/a.txt', '/tmp/b.txt'], { l: true })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('1 /tmp/a.txt\n2 /tmp/b.txt')
    }
  })

  it('returns error for unsupported flags', () => {
    const handler = createWcHandler(createMockFileSystem())
    const result = handler.execute([], { c: true }, { stdin: 'abc' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('only line count is supported')
    }
  })

  it('returns error when no file and no stdin are provided', () => {
    const handler = createWcHandler(createMockFileSystem())
    const result = handler.execute([], { l: true })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('no input source')
    }
  })
})
