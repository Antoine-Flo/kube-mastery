#!/usr/bin/env node
import {
  applyYamlTarget,
  ensureCluster,
  getSeedPath
} from './lib/cluster-manager'
import type { Result } from './lib/types'

const isError = <T, E>(r: Result<T, E>): r is { ok: false; error: E } => !r.ok

const name = process.argv[2]
if (!name) {
  console.error('Usage: start-cluster <seed>')
  process.exit(1)
}

const seedName = name

console.log(`Starting: ${name} (seed: ${seedName})\n`)

const e = ensureCluster(seedName)

if (isError(e)) {
  console.error(e.error)
  process.exit(1)
}

const a = applyYamlTarget(getSeedPath(seedName))

if (isError(a)) {
  console.error(a.error)
  process.exit(1)
}

console.log(`\nCluster "${seedName}" up. kubectl context: kind-${seedName}`)
