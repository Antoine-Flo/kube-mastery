import { describe, expect, it } from 'vitest'
import {
  checkExpectation,
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
      },
      'normalized'
    )

    expect(comparison.matched).toBe(true)
  })

  it('should validate expectations', () => {
    const ok = checkExpectation(
      {
        command: 'kubectl create',
        exitCode: 1,
        stdout: '',
        stderr: 'error: invalid',
        combined: 'error: invalid'
      },
      { exitCode: 1, stderrContains: ['error'] }
    )
    expect(ok.ok).toBe(true)
  })

  it('should fail suite on mismatch', () => {
    const suite: ConformanceSuite = {
      name: 'test',
      clusterName: 'test',
      actions: [
        {
          id: 'cmd-1',
          type: 'command',
          command: 'kubectl get pods',
          compareMode: 'raw'
        }
      ],
      stopOnMismatch: true
    }
    const { reporter, diffEntries } = createMemoryReporter()
    const result = runConformanceSuite(suite, {
      kindExecutor: createMockKindExecutor('kind-output'),
      runnerExecutor: createMockRunnerExecutor('runner-output'),
      reporter
    })
    expect(result.ok).toBe(false)
    expect(diffEntries.length).toBeGreaterThan(0)
  })
})
