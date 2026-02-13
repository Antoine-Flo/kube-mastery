#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { runConformanceSuite } from './lib/conformance-engine'
import type { ConformanceSuite } from './lib/conformance-types'

const GENERATED_SUITE_PATH = join(
  process.cwd(),
  'bin',
  'config',
  'generated',
  'exhaustive-suite.json'
)

const loadGeneratedSuite = (): ConformanceSuite => {
  if (!existsSync(GENERATED_SUITE_PATH)) {
    throw new Error(
      `Generated suite not found at ${GENERATED_SUITE_PATH}. Run the generator first.`
    )
  }
  const raw = readFileSync(GENERATED_SUITE_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as ConformanceSuite
  if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.actions)) {
    throw new Error(`Invalid generated suite format in ${GENERATED_SUITE_PATH}`)
  }
  return parsed
}

async function main() {
  const suite = loadGeneratedSuite()
  const result = runConformanceSuite(suite)

  console.log('\n' + '='.repeat(50))
  if (!result.ok) {
    console.log('Passed: 0')
    console.log('Failed: 1')
    console.error(`[${suite.name}] ${result.error}`)
    process.exit(1)
  }
  console.log('Passed: 1')
  console.log('All conformance scenarios passed.')
}

main()
