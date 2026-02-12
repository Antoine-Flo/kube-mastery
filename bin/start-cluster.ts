#!/usr/bin/env node
import {
  applyYamlFiles,
  ensureCluster,
  getSeedPath,
  waitForPodsReady
} from './lib/cluster-manager'
import { CONFORMANCE_SCENARIOS } from './config/conformance-scenarios'
import type { Result } from './lib/types'

const isError = <T, E>(r: Result<T, E>): r is { ok: false; error: E } => !r.ok

const name = process.argv[2]
if (!name) {
  console.error('Usage: start-cluster <name>')
  process.exit(1)
}

const scenario = CONFORMANCE_SCENARIOS.find((s) => s.name === name)
const seedName = scenario?.seed ?? name
const waitForPods = scenario?.seedWaitForPods ?? false

console.log(`Starting: ${name} (seed: ${seedName})\n`)

const e = ensureCluster(seedName)

if (isError(e)) {
  console.error(e.error)
  process.exit(1)
}

const a = applyYamlFiles(getSeedPath(seedName))

if (isError(a)) {
  console.error(a.error)
  process.exit(1)
}

if (waitForPods) {
  console.log('Waiting for pods...')
  const w = waitForPodsReady()
  if (isError(w)) {
    console.warn(w.error)
  }
}

console.log(`\nCluster "${seedName}" up. kubectl context: kind-${seedName}`)
