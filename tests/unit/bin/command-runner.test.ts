import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpawnSyncReturns } from 'child_process'
import { spawnSync } from 'child_process'
import { runShellCommandDetailed } from '../../../bin/lib/command-runner'

vi.mock('child_process', () => {
  return {
    spawnSync: vi.fn()
  }
})

describe('command-runner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns stdout and stderr in combined output', () => {
    vi.mocked(spawnSync).mockReturnValue({
      stdout: 'ok\n',
      stderr: 'warn\n',
      status: 0
    } as unknown as SpawnSyncReturns<string>)

    const result = runShellCommandDetailed('kubectl get pods')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('ok')
    expect(result.stderr).toBe('warn')
    expect(result.combined).toBe('ok\nwarn')
  })

  it('falls back to stderr when stdout is empty', () => {
    vi.mocked(spawnSync).mockReturnValue({
      stdout: '',
      stderr: 'No resources found',
      status: 1
    } as unknown as SpawnSyncReturns<string>)

    const result = runShellCommandDetailed('kubectl get pods')
    expect(result.exitCode).toBe(1)
    expect(result.combined).toBe('No resources found')
  })

  it('uses exit code 1 when process status is null', () => {
    vi.mocked(spawnSync).mockReturnValue({
      stdout: '',
      stderr: 'spawn failed',
      status: null
    } as unknown as SpawnSyncReturns<string>)

    const result = runShellCommandDetailed('kubectl version')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('spawn failed')
  })
})
