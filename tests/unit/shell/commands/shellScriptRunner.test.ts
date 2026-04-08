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
      expect(result.commands).toEqual([
        'mkdir -p /tmp/data',
        'touch /tmp/data/ready'
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
})
