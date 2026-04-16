import { describe, expect, it } from 'vitest'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import { createShellExecutor } from '../../../../src/core/shell/commands'
import {
  executeSequentialShellScript,
  parseSequentialShellScript
} from '../../../../src/core/shell/commands/shellScriptRunner'

describe('shellScriptRunner', () => {
  it('parses && command chaining in a single line', () => {
    const result = parseSequentialShellScript(
      'mkdir -p /tmp/data && touch /tmp/data/ready'
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.steps).toEqual([
        { kind: 'single', command: 'mkdir -p /tmp/data' },
        { kind: 'single', command: 'touch /tmp/data/ready' }
      ])
    }
  })

  it('rejects unsupported shell syntax', () => {
    const result = parseSequentialShellScript('touch a || touch b')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('unsupported shell syntax')
    }
  })

  it('parses pipeline command chaining in a single line', () => {
    const result = parseSequentialShellScript('echo ready | cat')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.steps).toEqual([
        {
          kind: 'pipeline',
          commands: ['echo ready', 'cat']
        }
      ])
    }
  })

  it('keeps pipe character inside quotes', () => {
    const result = parseSequentialShellScript(`echo "a | b"`)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.steps).toEqual([
        { kind: 'single', command: `echo "a | b"` }
      ])
    }
  })

  it('rejects invalid pipeline with empty right side', () => {
    const result = parseSequentialShellScript('echo hello |')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('invalid pipeline')
    }
  })

  it('executes chained commands through the shared shell executor', () => {
    const fileSystem = createFileSystem()
    const executor = createShellExecutor(fileSystem)

    const result = executeSequentialShellScript(
      executor,
      'mkdir -p /tmp/data && echo value > /tmp/data/setting'
    )
    expect(result.ok).toBe(true)
    const readResult = fileSystem.readFile('/tmp/data/setting')
    expect(readResult.ok).toBe(true)
    if (readResult.ok) {
      expect(readResult.value).toBe('value')
    }
  })

  it('executes pipeline commands through the shared shell executor', () => {
    const fileSystem = createFileSystem()
    const executor = createShellExecutor(fileSystem)

    const result = executeSequentialShellScript(executor, 'echo value | cat')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('value')
    }
  })
})
