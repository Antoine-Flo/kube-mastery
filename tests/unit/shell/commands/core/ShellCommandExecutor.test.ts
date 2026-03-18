import { beforeEach, describe, expect, it } from 'vitest'
import { error, success } from '../../../../../src/core/shared/result'
import {
  ShellCommandExecutor,
  createShellCommandExecutor
} from '../../../../../src/core/shell/commands/core/ShellCommandExecutor'
import type { ShellCommandHandler } from '../../../../../src/core/shell/commands/core/ShellCommandHandler'

describe('ShellCommandExecutor', () => {
  let handlers: Map<string, ShellCommandHandler>
  let executor: ShellCommandExecutor

  beforeEach(() => {
    handlers = new Map()
    executor = createShellCommandExecutor(handlers)
  })

  it('should execute command with handler', () => {
    const mockHandler: ShellCommandHandler = {
      execute: () => success('test output')
    }
    handlers.set('pwd', mockHandler)

    const result = executor.execute('pwd')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('test output')
    }
  })

  it('should execute env command with handler', () => {
    const mockHandler: ShellCommandHandler = {
      execute: () => success('PATH=/bin')
    }
    handlers.set('env', mockHandler)

    const result = executor.execute('env')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('PATH=/bin')
    }
  })

  it('should pass args and flags to handler', () => {
    let receivedArgs: string[] = []
    let receivedFlags: Record<string, boolean | string> = {}

    const mockHandler: ShellCommandHandler = {
      execute: (args, flags) => {
        receivedArgs = args
        receivedFlags = flags
        return success('ok')
      }
    }
    handlers.set('ls', mockHandler)

    executor.execute('ls arg1 arg2 -l')
    expect(receivedArgs).toEqual(['arg1', 'arg2'])
    expect(receivedFlags).toEqual({ l: true })
  })

  it('should return error for unknown command', () => {
    const result = executor.execute('unknown-command')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Unknown command')
    }
  })

  it('should return error for missing handler', () => {
    // Parse valid command but no handler registered
    const result = executor.execute('pwd')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Handler not found')
    }
  })

  it('should handle parse errors gracefully', () => {
    const result = executor.execute('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeTruthy()
    }
  })

  it('should propagate handler errors', () => {
    const mockHandler: ShellCommandHandler = {
      execute: () => error('Handler error')
    }
    handlers.set('pwd', mockHandler)

    const result = executor.execute('pwd')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Handler error')
    }
  })
})
