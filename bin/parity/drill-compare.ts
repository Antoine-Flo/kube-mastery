#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { createKindCommandRunner } from '../lib/parity/kind-command-runner'
import { createSimulationSessionManager } from '../lib/parity/simulation-session-manager'
import {
  ensureCluster,
  ensureCurrentContextNamespace,
  resetConformanceClusterState
} from '../lib/cluster-manager'
import { CONFIG } from '../../src/config'
import { compareStepResults, type DrillMismatchCategory } from './drill/comparison'
import { loadDrillParitySpec } from './drill/spec'

interface DrillCliOptions {
  drillId?: string
  specPath?: string
  contextName?: string
  timeoutMs?: number
  resetKindBeforeRun?: boolean
}

interface StepComparisonRecord {
  stepId: string
  command: string
  expectParity: boolean
  matched: boolean
  categories: DrillMismatchCategory[]
  simulation: {
    exitCode: number
    stdout: string
    stderr: string
  }
  kind: {
    exitCode: number
    stdout: string
    stderr: string
  }
  normalizedDiff: {
    simulationStdout: string
    kindStdout: string
    simulationStderr: string
    kindStderr: string
  }
}

interface CheckResultRecord {
  checkId: string
  status: 'pass' | 'fail'
  category: 'resource_state' | 'filesystem_state'
  observed: string
  expected: string
  detail: string
}

interface RootCauseHint {
  category: DrillMismatchCategory
  confidence: number
  evidence: string
  nextFix: string
}

interface DrillParityReport {
  summary: {
    drillId: string
    matchedSteps: number
    mismatchedSteps: number
    passedChecks: number
    failedChecks: number
    pass: boolean
  }
  stepComparisons: StepComparisonRecord[]
  checkResults: CheckResultRecord[]
  rootCauseHints: RootCauseHint[]
  aiContext: {
    failingCommands: string[]
    failingChecks: string[]
    topCategories: DrillMismatchCategory[]
  }
}

const getUsage = (): string => {
  return [
    'Usage: npm run parity:drill -- --drill <drill-id> [--spec <path>] [--context <kind-context>] [--timeout-ms 60000] [--no-reset-kind]',
    'Examples:',
    '  npm run parity:drill -- --drill create-pv-pvc-and-mount',
    '  npm run parity:drill -- --spec src/courses/drills/create-pv-pvc-and-mount/test.yaml'
  ].join('\n')
}

const parseCliArgs = (argv: string[]): DrillCliOptions => {
  const options: DrillCliOptions = {}
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--drill' && index + 1 < argv.length) {
      options.drillId = argv[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--drill=')) {
      options.drillId = arg.slice('--drill='.length)
      continue
    }
    if (arg === '--spec' && index + 1 < argv.length) {
      options.specPath = argv[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--spec=')) {
      options.specPath = arg.slice('--spec='.length)
      continue
    }
    if (arg === '--context' && index + 1 < argv.length) {
      options.contextName = argv[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--context=')) {
      options.contextName = arg.slice('--context='.length)
      continue
    }
    if (arg === '--timeout-ms' && index + 1 < argv.length) {
      options.timeoutMs = Number.parseInt(argv[index + 1], 10)
      index += 1
      continue
    }
    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number.parseInt(arg.slice('--timeout-ms='.length), 10)
      continue
    }
    if (arg === '--no-reset-kind') {
      options.resetKindBeforeRun = false
    }
  }
  return options
}

const useKubectlContext = (contextName: string): boolean => {
  try {
    execSync(`kubectl config use-context ${contextName}`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    })
    return true
  } catch {
    return false
  }
}

const resolveSpecPath = (options: DrillCliOptions): string | null => {
  if (options.specPath) {
    return options.specPath
  }
  if (!options.drillId) {
    return null
  }
  return join(
    process.cwd(),
    'src',
    'courses',
    'drills',
    options.drillId,
    'test.yaml'
  )
}

const materializeSpecManifests = (
  specPath: string,
  drillId: string,
  manifests: { path: string; content?: string; sourcePath?: string }[]
): {
  runDir: string
  pathMap: Map<string, string>
  cleanupRequired: boolean
} => {
  const specDirectory = dirname(specPath)
  const runDir = join(
    process.cwd(),
    '.tmp',
    'drill-parity',
    `${drillId}-manifests`
  )
  const pathMap = new Map<string, string>()
  let cleanupRequired = false

  for (const manifest of manifests) {
    if (manifest.sourcePath) {
      const resolvedSourcePath = isAbsolute(manifest.sourcePath)
        ? manifest.sourcePath
        : join(specDirectory, manifest.sourcePath)
      pathMap.set(manifest.path, resolvedSourcePath)
      continue
    }
    if (manifest.content) {
      cleanupRequired = true
      const targetPath = join(runDir, manifest.path)
      mkdirSync(dirname(targetPath), { recursive: true })
      writeFileSync(targetPath, manifest.content, 'utf-8')
      pathMap.set(manifest.path, targetPath)
    }
  }
  return {
    runDir,
    pathMap,
    cleanupRequired
  }
}

const rewriteCommandForManifestPaths = (
  command: string,
  pathMap: Map<string, string>
): string => {
  let rewritten = command
  for (const [relativePath, absolutePath] of pathMap.entries()) {
    rewritten = rewritten.replaceAll(
      `--filename=${relativePath}`,
      `--filename=${absolutePath}`
    )
    rewritten = rewritten.replaceAll(
      `--filename ${relativePath}`,
      `--filename ${absolutePath}`
    )
    rewritten = rewritten.replaceAll(`-f=${relativePath}`, `-f=${absolutePath}`)
    rewritten = rewritten.replaceAll(`-f ${relativePath}`, `-f ${absolutePath}`)
  }
  return rewritten
}

const evaluateClusterChecks = (
  checks: {
    id: string
    kind: string
    name: string
    namespace?: string
    path: string
    expected: string
    match?: 'equals' | 'contains'
    requireEquivalent?: boolean
  }[],
  runCommand: (
    command: string
  ) => { exitCode: number; stdout: string; stderr: string },
  runKindCommand: (
    command: string
  ) => { exitCode: number; stdout: string; stderr: string }
): CheckResultRecord[] => {
  const records: CheckResultRecord[] = []
  for (const check of checks) {
    const namespaceArgs =
      check.namespace && check.namespace.length > 0
        ? ` -n ${check.namespace}`
        : ''
    const jsonPathCommand = `kubectl get ${check.kind} ${check.name}${namespaceArgs} -o jsonpath='${check.path}'`
    const simulationResult = runCommand(jsonPathCommand)
    const kindResult = runKindCommand(jsonPathCommand)
    const simulationObserved = simulationResult.stdout.trim()
    const kindObserved = kindResult.stdout.trim()
    const expected = check.expected
    const matchType = check.match ?? 'equals'
    const simulationMatches =
      matchType === 'contains'
        ? simulationObserved.includes(expected)
        : simulationObserved === expected
    const kindMatches =
      matchType === 'contains'
        ? kindObserved.includes(expected)
        : kindObserved === expected
    const equivalentAcrossRuntimes = simulationObserved === kindObserved
    const passed = check.requireEquivalent
      ? simulationMatches && kindMatches && equivalentAcrossRuntimes
      : simulationMatches && kindMatches
    const detail = passed
      ? 'Cluster check passed on simulation and kind.'
      : [
          `sim="${simulationObserved}"`,
          `kind="${kindObserved}"`,
          `simExit=${simulationResult.exitCode}`,
          `kindExit=${kindResult.exitCode}`
        ].join(' ')
    records.push({
      checkId: check.id,
      status: passed ? 'pass' : 'fail',
      category: 'resource_state',
      observed: `sim=${simulationObserved};kind=${kindObserved}`,
      expected,
      detail
    })
  }
  return records
}

const evaluateFilesystemChecks = (
  specPath: string,
  pathMap: Map<string, string>,
  checks: {
    id: string
    path: string
    contains?: string
    notEmpty?: boolean
  }[]
): CheckResultRecord[] => {
  const records: CheckResultRecord[] = []
  const specDirectory = dirname(specPath)
  for (const check of checks) {
    const mappedPath = pathMap.get(check.path)
    const targetPath = mappedPath ?? join(specDirectory, check.path)
    try {
      const content = readFileSync(targetPath, 'utf-8')
      const normalized = content.trim()
      let passed = true
      if (check.notEmpty === true && normalized.length === 0) {
        passed = false
      }
      if (check.contains && !content.includes(check.contains)) {
        passed = false
      }
      records.push({
        checkId: check.id,
        status: passed ? 'pass' : 'fail',
        category: 'filesystem_state',
        observed: normalized,
        expected: check.contains ?? '[non-empty-file]',
        detail: passed
          ? `Filesystem check passed for ${check.path}`
          : `Filesystem check failed for ${check.path}`
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      records.push({
        checkId: check.id,
        status: 'fail',
        category: 'filesystem_state',
        observed: '',
        expected: check.contains ?? '[file-exists]',
        detail: `Unable to read ${check.path}: ${message}`
      })
    }
  }
  return records
}

const getNextFixForCategory = (category: DrillMismatchCategory): string => {
  if (category === 'exit_code') {
    return 'Align kubectl handler error semantics and command validation order.'
  }
  if (category === 'timing_readiness') {
    return 'Review reconcile timing and wait condition behavior for the resource.'
  }
  if (category === 'resource_state') {
    return 'Inspect controller status propagation and expected object fields.'
  }
  if (category === 'filesystem_state') {
    return 'Verify manifest materialization path and file content assumptions.'
  }
  return 'Check kubectl output formatting and normalization logic.'
}

const buildRootCauseHints = (
  stepRecords: StepComparisonRecord[],
  checkResults: CheckResultRecord[]
): RootCauseHint[] => {
  const categoryCounts = new Map<DrillMismatchCategory, number>()
  for (const step of stepRecords) {
    if (!step.expectParity || step.matched) {
      continue
    }
    for (const category of step.categories) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
    }
  }
  for (const check of checkResults) {
    if (check.status !== 'fail') {
      continue
    }
    const category = check.category as DrillMismatchCategory
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
  }

  const entries = Array.from(categoryCounts.entries()).sort((left, right) => {
    return right[1] - left[1]
  })
  const total = entries.reduce((sum, entry) => {
    return sum + entry[1]
  }, 0)
  return entries.map(([category, count]) => {
    const confidence = total > 0 ? Number((count / total).toFixed(2)) : 0
    return {
      category,
      confidence,
      evidence: `${count} mismatch(es) in category ${category}.`,
      nextFix: getNextFixForCategory(category)
    }
  })
}

const writeAiReport = (drillId: string, report: DrillParityReport): string => {
  const dirPath = join(process.cwd(), '.tmp', 'drill-parity')
  mkdirSync(dirPath, { recursive: true })
  const reportPath = join(dirPath, `${drillId}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  return reportPath
}

const main = (): void => {
  const cli = parseCliArgs(process.argv.slice(2))
  const resolvedSpecPath = resolveSpecPath(cli)
  if (!resolvedSpecPath) {
    console.error(getUsage())
    process.exit(1)
  }
  const specResult = loadDrillParitySpec(resolvedSpecPath)
  if (!specResult.ok) {
    console.error(specResult.error)
    process.exit(1)
  }
  const spec = specResult.value
  const contextName =
    cli.contextName ??
    spec.contextName ??
    `kind-${CONFIG.cluster.conformanceClusterName}`
  if (!useKubectlContext(contextName)) {
    console.error(`Unable to switch kubectl context to "${contextName}"`)
    process.exit(1)
  }

  const shouldResetKind =
    cli.resetKindBeforeRun ?? spec.resetKindBeforeRun ?? false
  if (shouldResetKind) {
    const ensureResult = ensureCluster(CONFIG.cluster.conformanceClusterName)
    if (!ensureResult.ok) {
      console.error(ensureResult.error)
      process.exit(1)
    }
    const namespaceResult = ensureCurrentContextNamespace('default')
    if (!namespaceResult.ok) {
      console.error(namespaceResult.error)
      process.exit(1)
    }
    const resetResult = resetConformanceClusterState()
    if (!resetResult.ok) {
      console.error(resetResult.error)
      process.exit(1)
    }
  }

  const simulationManager = createSimulationSessionManager()
  const simulationSession = simulationManager.createSession()
  const kindRunner = createKindCommandRunner({
    timeoutMs: cli.timeoutMs ?? spec.timeoutMs ?? 60000
  })
  const materialized = materializeSpecManifests(
    resolvedSpecPath,
    spec.drillId,
    spec.manifests
  )
  const stepRecords: StepComparisonRecord[] = []
  const stripAgeValues = spec.compare?.normalize?.stripAgeValues ?? true

  try {
    console.log(`Simulation session: ${simulationSession.id}`)
    console.log(`Spec: ${resolvedSpecPath}`)
    for (const step of spec.steps) {
      const rewrittenCommand = rewriteCommandForManifestPaths(
        step.run,
        materialized.pathMap
      )
      const simulationResult = simulationManager.runCommand(
        simulationSession.id,
        rewrittenCommand
      )
      const kindResult = kindRunner.run(rewrittenCommand)
      const comparison = compareStepResults(
        rewrittenCommand,
        simulationResult,
        kindResult,
        stripAgeValues
      )
      stepRecords.push({
        stepId: step.id,
        command: rewrittenCommand,
        expectParity: step.expectParity,
        matched: step.expectParity ? comparison.matched : true,
        categories: comparison.categories,
        simulation: {
          exitCode: simulationResult.exitCode,
          stdout: simulationResult.stdout,
          stderr: simulationResult.stderr
        },
        kind: {
          exitCode: kindResult.exitCode,
          stdout: kindResult.stdout,
          stderr: kindResult.stderr
        },
        normalizedDiff: {
          simulationStdout: comparison.normalizedSimulationStdout,
          kindStdout: comparison.normalizedKindStdout,
          simulationStderr: comparison.normalizedSimulationStderr,
          kindStderr: comparison.normalizedKindStderr
        }
      })
      console.log(
        `[${step.expectParity ? (comparison.matched ? 'ok' : 'diff') : 'skip'}] ${step.id} | sim=${simulationResult.exitCode} kind=${kindResult.exitCode}`
      )
    }

    const clusterCheckRecords = evaluateClusterChecks(
      spec.checks.cluster,
      (command) => {
        return simulationManager.runCommand(simulationSession.id, command)
      },
      (command) => {
        return kindRunner.run(command)
      }
    )
    const filesystemCheckRecords = evaluateFilesystemChecks(
      resolvedSpecPath,
      materialized.pathMap,
      spec.checks.filesystem
    )
    const checkResults = [...clusterCheckRecords, ...filesystemCheckRecords]
    const parityScopedSteps = stepRecords.filter((record) => record.expectParity)
    const matchedSteps = parityScopedSteps.filter((record) => record.matched).length
    const mismatchedSteps = parityScopedSteps.length - matchedSteps
    const passedChecks = checkResults.filter((check) => check.status === 'pass').length
    const failedChecks = checkResults.length - passedChecks
    const rootCauseHints = buildRootCauseHints(stepRecords, checkResults)
    const topCategories = rootCauseHints.map((item) => item.category)
    const report: DrillParityReport = {
      summary: {
        drillId: spec.drillId,
        matchedSteps,
        mismatchedSteps,
        passedChecks,
        failedChecks,
        pass: mismatchedSteps === 0 && failedChecks === 0
      },
      stepComparisons: stepRecords,
      checkResults,
      rootCauseHints,
      aiContext: {
        failingCommands: stepRecords
          .filter((record) => record.expectParity && !record.matched)
          .map((record) => record.command),
        failingChecks: checkResults
          .filter((check) => check.status === 'fail')
          .map((check) => check.checkId),
        topCategories
      }
    }
    const reportPath = writeAiReport(spec.drillId, report)
    console.log('==================================================')
    console.log(
      `[summary] matchedSteps=${matchedSteps} mismatchedSteps=${mismatchedSteps} failedChecks=${failedChecks}`
    )
    console.log(`[ai-report] ${reportPath}`)

    if (!report.summary.pass) {
      process.exit(1)
    }
    process.exit(0)
  } finally {
    if (materialized.cleanupRequired) {
      rmSync(materialized.runDir, { recursive: true, force: true })
    }
  }
}

main()
