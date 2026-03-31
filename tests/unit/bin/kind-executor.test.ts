import { afterEach, describe, expect, it, vi } from 'vitest'
import * as clusterManager from '../../../bin/lib/cluster-manager'
import * as commandRunner from '../../../bin/lib/command-runner'
import { createKindExecutor } from '../../../bin/lib/executors/kind-executor'
import { error, success } from '../../../bin/lib/types'

describe('kind-executor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fails setup when ensureCluster fails', () => {
    vi.spyOn(clusterManager, 'ensureCluster').mockReturnValue(error('cluster failed'))
    const executor = createKindExecutor('demo')
    const result = executor.setup()
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('cluster failed')
  })

  it('fails setup when namespace switch fails', () => {
    vi.spyOn(clusterManager, 'ensureCluster').mockReturnValue(success(undefined))
    vi.spyOn(clusterManager, 'ensureCurrentContextNamespace').mockReturnValue(
      error('namespace failed')
    )
    const executor = createKindExecutor('demo')
    const result = executor.setup()
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('namespace failed')
  })

  it('fails setup when reset fails', () => {
    vi.spyOn(clusterManager, 'ensureCluster').mockReturnValue(success(undefined))
    vi.spyOn(clusterManager, 'ensureCurrentContextNamespace').mockReturnValue(
      success(undefined)
    )
    vi.spyOn(clusterManager, 'resetConformanceClusterState').mockReturnValue(
      error('reset failed')
    )

    const executor = createKindExecutor('demo')
    const result = executor.setup()
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('reset failed')
  })

  it('maps apply and delete errors to command execution results', () => {
    vi.spyOn(clusterManager, 'applyYamlTarget').mockReturnValue(error('apply failed'))
    vi.spyOn(clusterManager, 'deleteYamlTarget').mockReturnValue(error('delete failed'))
    const executor = createKindExecutor('demo')

    const applyResult = executor.applyYaml({
      id: 'a',
      type: 'applyYaml',
      targetPath: '/tmp/app.yaml'
    })
    expect(applyResult.exitCode).toBe(1)
    expect(applyResult.stderr).toContain('apply failed')

    const deleteResult = executor.deleteYaml({
      id: 'd',
      type: 'deleteYaml',
      targetPath: '/tmp/app.yaml',
      ignoreNotFound: true
    })
    expect(deleteResult.exitCode).toBe(1)
    expect(deleteResult.stderr).toContain('delete failed')
  })

  it('delegates executeCommand to command runner', () => {
    vi.spyOn(commandRunner, 'runShellCommandDetailed').mockReturnValue({
      command: 'kubectl get pods',
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      combined: 'ok'
    })

    const executor = createKindExecutor('demo')
    const result = executor.executeCommand('kubectl get pods')
    expect(result.exitCode).toBe(0)
    expect(result.combined).toBe('ok')
  })
})
