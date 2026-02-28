import { describe, expect, it } from 'vitest'
import {
  compareResults,
  runConformanceSuite
} from '../../../bin/lib/conformance-engine'
import type { ConformanceReporter } from '../../../bin/lib/conformance-reporter'
import type { ConformanceSuite } from '../../../bin/lib/conformance-types'
import type { KindExecutor } from '../../../bin/lib/executors/kind-executor'
import type { RunnerExecutor } from '../../../bin/lib/executors/runner-executor'
import { success } from '../../../bin/lib/types'

const createMockKindExecutor = (output: string): KindExecutor => {
  return {
    setup: () => success(undefined),
    teardown: () => success(undefined),
    executeCommand: (command) => ({
      command,
      exitCode: 0,
      stdout: output,
      stderr: '',
      combined: output
    }),
    applyYaml: (action) => ({
      command: `kubectl apply -f ${action.targetPath}`,
      exitCode: 0,
      stdout: 'applied',
      stderr: '',
      combined: 'applied'
    }),
    deleteYaml: (action) => ({
      command: `kubectl delete -f ${action.targetPath}`,
      exitCode: 0,
      stdout: 'deleted',
      stderr: '',
      combined: 'deleted'
    }),
    waitPodsReady: () => ({
      command: 'kubectl wait',
      exitCode: 0,
      stdout: 'pods ready',
      stderr: '',
      combined: 'pods ready'
    })
  }
}

const createMockRunnerExecutor = (output: string): RunnerExecutor => {
  return {
    executeCommand: (command) => ({
      command,
      exitCode: 0,
      stdout: output,
      stderr: '',
      combined: output
    }),
    applyYaml: (action) => ({
      command: `kubectl apply -f ${action.targetPath}`,
      exitCode: 0,
      stdout: 'applied',
      stderr: '',
      combined: 'applied'
    }),
    deleteYaml: (action) => ({
      command: `kubectl delete -f ${action.targetPath}`,
      exitCode: 0,
      stdout: 'deleted',
      stderr: '',
      combined: 'deleted'
    }),
    waitPodsReady: () => ({
      command: 'runner wait',
      exitCode: 0,
      stdout: 'pods ready',
      stderr: '',
      combined: 'pods ready'
    })
  }
}

const createMemoryReporter = () => {
  const diffEntries: string[] = []
  const reporter: ConformanceReporter = {
    recordKind: () => undefined,
    recordRunner: () => undefined,
    recordDiff: (entry) => {
      diffEntries.push(entry)
    },
    flush: () => undefined
  }
  return { reporter, diffEntries }
}

describe('conformance engine', () => {
  it('should compare normalized outputs', () => {
    const comparison = compareResults(
      {
        command: 'a',
        exitCode: 0,
        stdout: '2026-01-01T00:00:00Z',
        stderr: '',
        combined: '2026-01-01T00:00:00Z'
      },
      {
        command: 'a',
        exitCode: 0,
        stdout: '2027-02-01T00:00:00Z',
        stderr: '',
        combined: '2027-02-01T00:00:00Z'
      }
    )

    expect(comparison.matched).toBe(true)
  })

  it('should continue suite and record diff on mismatch', () => {
    const suite: ConformanceSuite = {
      name: 'test',
      clusterName: 'test',
      actions: [
        {
          id: 'cmd-1',
          type: 'command',
          command: 'kubectl get pods'
        }
      ]
    }
    const { reporter, diffEntries } = createMemoryReporter()
    const result = runConformanceSuite(suite, {
      kindExecutor: createMockKindExecutor('kind-output'),
      runnerExecutor: createMockRunnerExecutor('runner-output'),
      reporter
    })
    expect(result.ok).toBe(true)
    expect(diffEntries.length).toBeGreaterThan(0)
  })

  it('should record line diff for output mismatch', () => {
    const suite: ConformanceSuite = {
      name: 'normalized-fallback-suite',
      clusterName: 'test',
      actions: [
        {
          id: 'cmd-none-1',
          type: 'command',
          command: 'kubectl config get-contexts'
        }
      ]
    }
    const { reporter, diffEntries } = createMemoryReporter()
    const result = runConformanceSuite(suite, {
      kindExecutor: createMockKindExecutor('CURRENT   kind-conformance'),
      runnerExecutor: createMockRunnerExecutor(
        'CURRENT  kubernetes-admin@kubernetes'
      ),
      reporter
    })

    expect(result.ok).toBe(true)
    const joined = diffEntries.join('\n')
    expect(joined.includes('[diff]')).toBe(true)
    expect(joined.includes('[line 1]')).toBe(true)
  })
})
