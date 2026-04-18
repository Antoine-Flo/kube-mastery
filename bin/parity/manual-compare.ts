#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { createKindCommandRunner } from '../lib/parity/kind-command-runner'
import { createSimulationSessionManager } from '../lib/parity/simulation-session-manager'
import {
  ensureCluster,
  ensureCurrentContextNamespace,
  resetConformanceClusterState
} from '../lib/cluster-manager'
import {
  getParityUsageText,
  parseCliArgs,
  printParityCommandBanner,
  printParityHeader,
  printResultPayload
} from './cli/surface'
import { CONFIG } from '../../src/config'

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

const main = (): void => {
  const options = parseCliArgs(process.argv.slice(2), CONFIG.cluster)
  if (options.commands.length === 0) {
    console.error(getParityUsageText())
    process.exit(1)
  }

  const simulationManager = createSimulationSessionManager()
  const session = simulationManager.createSession()
  if (!useKubectlContext(options.contextName)) {
    console.error(
      `Unable to switch kubectl context to "${options.contextName}"`
    )
    process.exit(1)
  }
  if (options.resetKindBeforeRun) {
    const ensureClusterResult = ensureCluster(
      CONFIG.cluster.conformanceClusterName
    )
    if (!ensureClusterResult.ok) {
      console.error(ensureClusterResult.error)
      process.exit(1)
    }
    const ensureNamespaceResult = ensureCurrentContextNamespace('default')
    if (!ensureNamespaceResult.ok) {
      console.error(ensureNamespaceResult.error)
      process.exit(1)
    }
    const resetResult = resetConformanceClusterState()
    if (!resetResult.ok) {
      console.error(resetResult.error)
      process.exit(1)
    }
  }
  const kindRunner = createKindCommandRunner({
    timeoutMs: options.timeoutMs,
    trimOutput: false
  })

  printParityHeader(session.id, options.contextName, options.verbose)

  let comparedCount = 0
  let mismatchCount = 0

  for (const command of options.commands) {
    printParityCommandBanner(command)

    const simulationResult = simulationManager.runCommand(session.id, command)
    const kindResult = kindRunner.run(command)
    comparedCount += 1
    const simulationComparable = simulationResult.stdout
    const kindComparable = kindResult.stdout
    const sameExitCode = simulationResult.exitCode === kindResult.exitCode
    const sameStdout = simulationComparable === kindComparable
    const sameStderr = simulationResult.stderr === kindResult.stderr
    const matched = sameExitCode && sameStdout && sameStderr
    if (!matched) {
      mismatchCount += 1
    }
    console.log(
      `[${matched ? 'ok' : 'diff'}] sim=${simulationResult.exitCode} kind=${kindResult.exitCode}`
    )

    if (options.verbose || !matched) {
      printResultPayload('simulation', simulationResult)
      printResultPayload('kind', kindResult)
    }
  }

  console.log('\n==================================================')
  console.log(`[done] compared=${comparedCount} mismatches=${mismatchCount}`)
}

main()
