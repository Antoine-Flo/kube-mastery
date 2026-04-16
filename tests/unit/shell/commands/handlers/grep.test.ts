import { describe, expect, it } from 'vitest'
import { success } from '../../../../../src/core/shared/result'
import { createGrepHandler } from '../../../../../src/core/shell/commands/handlers/fileops/grep'
import { createMockFileSystem } from '../../../helpers/mockFileSystem'

describe('grep handler', () => {
  it('filters matching lines from stdin', () => {
    const handler = createGrepHandler(createMockFileSystem())
    const result = handler.execute(
      ['Ready'],
      {},
      {
        stdin: 'pod-a Ready\npod-b Pending\npod-c Ready'
      }
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('pod-a Ready\npod-c Ready\n')
    }
  })

  it('supports case-insensitive matching', () => {
    const handler = createGrepHandler(createMockFileSystem())
    const result = handler.execute(
      ['ready'],
      { i: true },
      {
        stdin: 'pod-a Ready\npod-b Pending'
      }
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('pod-a Ready\n')
    }
  })

  it('supports line numbers from stdin', () => {
    const handler = createGrepHandler(createMockFileSystem())
    const result = handler.execute(
      ['Ready'],
      { n: true },
      {
        stdin: 'pod-a Pending\npod-b Ready\npod-c Ready'
      }
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('2:pod-b Ready\n3:pod-c Ready\n')
    }
  })

  it('filters lines from a file', () => {
    const fileSystem = createMockFileSystem({
      readFile: (filePath: string) => {
        if (filePath === '/tmp/pods.txt') {
          return success('pod-a Running\npod-b CrashLoopBackOff\npod-c Running')
        }
        return success('')
      }
    })
    const handler = createGrepHandler(fileSystem)
    const result = handler.execute(['Running', '/tmp/pods.txt'], {})

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('pod-a Running\npod-c Running\n')
    }
  })

  it('prefixes file names for multiple files', () => {
    const fileSystem = createMockFileSystem({
      readFile: (filePath: string) => {
        if (filePath === '/tmp/a.txt') {
          return success('Ready\nPending')
        }
        if (filePath === '/tmp/b.txt') {
          return success('Ready\nUnknown')
        }
        return success('')
      }
    })
    const handler = createGrepHandler(fileSystem)
    const result = handler.execute(['Ready', '/tmp/a.txt', '/tmp/b.txt'], {})

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('/tmp/a.txt:Ready\n/tmp/b.txt:Ready\n')
    }
  })

  it('returns error when no pattern is provided', () => {
    const handler = createGrepHandler(createMockFileSystem())
    const result = handler.execute([], {})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('missing search pattern')
    }
  })

  it('returns error when no file and no stdin are provided', () => {
    const handler = createGrepHandler(createMockFileSystem())
    const result = handler.execute(['Ready'], {})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('no input source')
    }
  })
})
