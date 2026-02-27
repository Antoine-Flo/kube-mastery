import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, describe, expect, it } from 'vitest'
import { createConformanceReporter } from '../../../bin/lib/conformance-reporter'

describe('conformance reporter', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('should write kind, runner, and diff logs', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'conformance-reporter-'))
    tempDirs.push(outputDir)

    const reporter = createConformanceReporter(outputDir)
    reporter.recordKind({
      suiteName: 'suite',
      actionId: 'step-1',
      actionType: 'command',
      backend: 'kind',
      command: 'kubectl get pods',
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      normalized: 'ok'
    })
    reporter.recordRunner({
      suiteName: 'suite',
      actionId: 'step-1',
      actionType: 'command',
      backend: 'runner',
      command: 'kubectl get pods',
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      normalized: 'ok'
    })
    reporter.recordDiff('mismatch-example')
    reporter.flush()

    const kindLog = readFileSync(join(outputDir, 'kind.log'), 'utf-8')
    const runnerLog = readFileSync(join(outputDir, 'runner.log'), 'utf-8')
    const diffLog = readFileSync(join(outputDir, 'diff.log'), 'utf-8')

    expect(kindLog).toContain('[backend] kind')
    expect(runnerLog).toContain('[backend] runner')
    expect(kindLog.match(/\[backend\] kind/g)?.length).toBe(1)
    expect(runnerLog.match(/\[backend\] runner/g)?.length).toBe(1)
    expect(kindLog.match(/\[suite\] suite/g)?.length).toBe(1)
    expect(runnerLog.match(/\[suite\] suite/g)?.length).toBe(1)
    expect(diffLog).toContain('mismatch-example')
  })

  it('should split reports by inferred command bucket', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'conformance-reporter-bucket-'))
    tempDirs.push(outputDir)

    const reporter = createConformanceReporter(outputDir)
    reporter.recordKind({
      suiteName: 'suite',
      actionId: 'pod-step',
      actionType: 'command',
      backend: 'kind',
      command: 'kubectl get pods',
      exitCode: 0,
      stdout: 'pod-output',
      stderr: '',
      normalized: 'pod-output'
    })
    reporter.recordRunner({
      suiteName: 'suite',
      actionId: 'pod-step',
      actionType: 'command',
      backend: 'runner',
      command: 'kubectl get pods',
      exitCode: 0,
      stdout: 'pod-output',
      stderr: '',
      normalized: 'pod-output'
    })
    reporter.recordKind({
      suiteName: 'suite',
      actionId: 'describe-step',
      actionType: 'command',
      backend: 'kind',
      command: 'kubectl describe pod demo',
      exitCode: 0,
      stdout: 'describe-output',
      stderr: '',
      normalized: 'describe-output'
    })
    reporter.recordRunner({
      suiteName: 'suite',
      actionId: 'describe-step',
      actionType: 'command',
      backend: 'runner',
      command: 'kubectl describe pod demo',
      exitCode: 0,
      stdout: 'describe-output',
      stderr: '',
      normalized: 'describe-output'
    })
    reporter.recordDiff('[command] kubectl get pods\n[mismatch]')
    reporter.recordDiff('[command] kubectl describe pod demo\n[mismatch]')
    reporter.flush()

    const getKindLog = readFileSync(join(outputDir, 'get', 'kind.log'), 'utf-8')
    const getRunnerLog = readFileSync(
      join(outputDir, 'get', 'runner.log'),
      'utf-8'
    )
    const getDiffLog = readFileSync(join(outputDir, 'get', 'diff.log'), 'utf-8')
    const describeKindLog = readFileSync(
      join(outputDir, 'describe', 'kind.log'),
      'utf-8'
    )
    const describeDiffLog = readFileSync(
      join(outputDir, 'describe', 'diff.log'),
      'utf-8'
    )

    expect(getKindLog).toContain('kubectl get pods')
    expect(getKindLog).not.toContain('kubectl describe pod demo')
    expect(getRunnerLog).toContain('kubectl get pods')
    expect(getDiffLog).toContain('kubectl get pods')

    expect(describeKindLog).toContain('kubectl describe pod demo')
    expect(describeKindLog).not.toContain('kubectl get pods')
    expect(describeDiffLog).toContain('kubectl describe pod demo')
  })

  it('should bucket kubectl config commands under config', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'conformance-reporter-config-'))
    tempDirs.push(outputDir)

    const reporter = createConformanceReporter(outputDir)
    reporter.recordKind({
      suiteName: 'suite',
      actionId: 'config-step',
      actionType: 'command',
      backend: 'kind',
      command: 'kubectl config current-context',
      exitCode: 0,
      stdout: 'kubernetes-admin@kubernetes',
      stderr: '',
      normalized: 'kubernetes-admin@kubernetes'
    })
    reporter.recordRunner({
      suiteName: 'suite',
      actionId: 'config-step',
      actionType: 'command',
      backend: 'runner',
      command: 'kubectl config current-context',
      exitCode: 0,
      stdout: 'kubernetes-admin@kubernetes',
      stderr: '',
      normalized: 'kubernetes-admin@kubernetes'
    })
    reporter.flush()

    const configKindLog = readFileSync(join(outputDir, 'config', 'kind.log'), 'utf-8')
    const configRunnerLog = readFileSync(
      join(outputDir, 'config', 'runner.log'),
      'utf-8'
    )

    expect(configKindLog).toContain('kubectl config current-context')
    expect(configRunnerLog).toContain('kubectl config current-context')
  })
})
