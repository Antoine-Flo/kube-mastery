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

  it('should split reports by scenario key bucket', () => {
    const outputDir = mkdtempSync(
      join(tmpdir(), 'conformance-reporter-bucket-')
    )
    tempDirs.push(outputDir)

    const reporter = createConformanceReporter(outputDir)
    reporter.recordKind({
      suiteName: 'scenario-alpha',
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
      suiteName: 'scenario-alpha',
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
      suiteName: 'scenario-beta',
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
      suiteName: 'scenario-beta',
      actionId: 'describe-step',
      actionType: 'command',
      backend: 'runner',
      command: 'kubectl describe pod demo',
      exitCode: 0,
      stdout: 'describe-output',
      stderr: '',
      normalized: 'describe-output'
    })
    reporter.recordDiff(
      '[suite] scenario-alpha\n[command] kubectl get pods\n[mismatch]'
    )
    reporter.recordDiff(
      '[suite] scenario-beta\n[command] kubectl describe pod demo\n[mismatch]'
    )
    reporter.flush()

    const alphaKindLog = readFileSync(
      join(outputDir, 'scenario-alpha', 'kind.log'),
      'utf-8'
    )
    const alphaRunnerLog = readFileSync(
      join(outputDir, 'scenario-alpha', 'runner.log'),
      'utf-8'
    )
    const alphaDiffLog = readFileSync(
      join(outputDir, 'scenario-alpha', 'diff.log'),
      'utf-8'
    )
    const betaKindLog = readFileSync(
      join(outputDir, 'scenario-beta', 'kind.log'),
      'utf-8'
    )
    const betaDiffLog = readFileSync(
      join(outputDir, 'scenario-beta', 'diff.log'),
      'utf-8'
    )

    expect(alphaKindLog).toContain('kubectl get pods')
    expect(alphaKindLog).not.toContain('kubectl describe pod demo')
    expect(alphaRunnerLog).toContain('kubectl get pods')
    expect(alphaDiffLog).toContain('kubectl get pods')

    expect(betaKindLog).toContain('kubectl describe pod demo')
    expect(betaKindLog).not.toContain('kubectl get pods')
    expect(betaDiffLog).toContain('kubectl describe pod demo')
  })

  it('should bucket logs under sanitized scenario key', () => {
    const outputDir = mkdtempSync(
      join(tmpdir(), 'conformance-reporter-scenario-')
    )
    tempDirs.push(outputDir)

    const reporter = createConformanceReporter(outputDir)
    reporter.recordKind({
      suiteName: 'Scenario Config',
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
      suiteName: 'Scenario Config',
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

    const scenarioKindLog = readFileSync(
      join(outputDir, 'scenario-config', 'kind.log'),
      'utf-8'
    )
    const scenarioRunnerLog = readFileSync(
      join(outputDir, 'scenario-config', 'runner.log'),
      'utf-8'
    )

    expect(scenarioKindLog).toContain('kubectl config current-context')
    expect(scenarioRunnerLog).toContain('kubectl config current-context')
  })
})
