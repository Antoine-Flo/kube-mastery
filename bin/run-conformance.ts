#!/usr/bin/env node
import {
  applyYamlFiles,
  deleteCluster,
  ensureCluster,
  getSeedPath,
  waitForPodsReady
} from './lib/cluster-manager'
import { runKubectlCommand } from './lib/command-runner'
import { normalizeOutput } from './lib/normalizer'
import { createSimulatorRunner } from './lib/simulator-runner'
import {
  CONFORMANCE_SCENARIOS,
  type ConformanceScenario
} from './config/conformance-scenarios'
import type { Result } from './lib/types'

const isError = <T, E>(r: Result<T, E>): r is { ok: false; error: E } => !r.ok

async function main() {
  let passed = 0
  let failed = 0

  for (const scenario of CONFORMANCE_SCENARIOS) {
    const result = await runScenario(scenario)
    if (result.ok) {
      passed++
    } else {
      failed++
      console.error(result.error)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`Passed: ${passed}`)
  if (failed > 0) {
    console.log(`Failed: ${failed}`)
    process.exit(1)
  }
  console.log('All conformance scenarios passed.')
}

async function runScenario(
  scenario: ConformanceScenario
): Promise<Result<void, string>> {
  const { seed, seedWaitForPods, steps } = scenario
  const seedPath = getSeedPath(seed)

  const e = ensureCluster(seed)
  if (isError(e)) {
    return { ok: false, error: `ensure cluster: ${e.error}` }
  }
  const a = applyYamlFiles(seedPath)
  if (isError(a)) {
    return { ok: false, error: `apply seed: ${a.error}` }
  }

  if (seedWaitForPods) {
    const w = waitForPodsReady()
    if (isError(w)) {
      // continue anyway
    }
  }

  let runner: ReturnType<typeof createSimulatorRunner>
  try {
    runner = createSimulatorRunner(seedPath)
  } catch (err) {
    return {
      ok: false,
      error: `simulator init: ${err instanceof Error ? err.message : err}`
    }
  }

  for (let i = 0; i < steps.length; i++) {
    for (const command of steps[i].commands) {
      const realResult = runKubectlCommand(command)
      const realOut = isError(realResult) ? realResult.error : realResult.value
      const simOut = runner.execute(command)
      const normReal = normalizeOutput(realOut)
      const normSim = normalizeOutput(simOut)

      if (normReal !== normSim) {
        deleteCluster(seed)
        return {
          ok: false,
          error: `Mismatch: ${command}\nRAW real:\n${realOut || '(empty)'}\n---\nRAW sim:\n${simOut || '(empty)'}\n--- diff ---\n${diff(normReal, normSim)}`
        }
      }
    }
  }

  const del = deleteCluster(seed)
  if (isError(del)) {
    // continue
  }
  return { ok: true, value: undefined }
}

function diff(a: string, b: string): string {
  const la = a.split('\n')
  const lb = b.split('\n')
  const out: string[] = []
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    const ra = la[i] ?? '(missing)'
    const rb = lb[i] ?? '(missing)'
    if (ra !== rb) {
      out.push(`- ${ra}`)
      out.push(`+ ${rb}`)
    }
  }
  return out.join('\n')
}

main()
