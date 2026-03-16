#!/usr/bin/env node
import { pathToFileURL } from 'url'
import { CONFIG } from '../src/config'
import {
  buildSuiteFromScenario,
  buildSuiteFromSingleCommand,
  runConformanceSuite,
  type ConformanceProgressEvent,
  type ConformanceProgressListener
} from './engine'
import { DEFAULT_SCENARIO_KEY, conformanceTests } from './tests'
import type { ConformanceScenario } from './types'

interface CliOptions {
  scenario?: string
  cmd?: string
  list: boolean
  quiet: boolean
}

export const parseCliArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = { list: false, quiet: false }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--list') {
      options.list = true
      continue
    }
    if (arg === '--quiet') {
      options.quiet = true
      continue
    }
    if (arg.startsWith('--scenario=')) {
      options.scenario = arg.slice('--scenario='.length)
      continue
    }
    if (arg === '--scenario' && index + 1 < argv.length) {
      options.scenario = argv[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--cmd=')) {
      options.cmd = arg.slice('--cmd='.length)
      continue
    }
    if (arg === '--cmd' && index + 1 < argv.length) {
      options.cmd = argv[index + 1]
      index += 1
      continue
    }
  }

  return options
}

const renderActionLabel = (event: ConformanceProgressEvent): string => {
  if (event.action.type === 'command') {
    return event.action.command
  }
  if (event.action.type === 'applyYaml') {
    return `kubectl apply -f ${event.action.targetPath}`
  }
  if (event.action.type === 'deleteYaml') {
    return `kubectl delete -f ${event.action.targetPath}`
  }
  return ''
}

const createConsoleProgressListener = (): ConformanceProgressListener => {
  return {
    onActionStart: (event) => {
      console.log(renderActionLabel(event))
    }
  }
}

export const listScenarioKeys = (): string[] => {
  return Object.keys(conformanceTests).sort((left, right) => {
    return left.localeCompare(right)
  })
}

export const resolveScenario = (options: CliOptions): {
  name: string
  scenario: ConformanceScenario
} => {
  if (options.cmd != null && options.cmd.length > 0) {
    return {
      name: 'adhoc',
      scenario: { cmds: [options.cmd] }
    }
  }

  const selectedScenario = options.scenario ?? DEFAULT_SCENARIO_KEY
  const scenario = conformanceTests[selectedScenario]
  if (scenario == null) {
    const available = listScenarioKeys().join(', ')
    throw new Error(
      `Unknown scenario "${selectedScenario}". Available scenarios: ${available}`
    )
  }

  return {
    name: selectedScenario,
    scenario
  }
}

export const resolveScenarioKeysToRun = (options: CliOptions): string[] => {
  if (options.cmd != null && options.cmd.length > 0) {
    return ['adhoc']
  }
  if (options.scenario != null && options.scenario.length > 0) {
    return [options.scenario]
  }
  return listScenarioKeys()
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  if (options.list) {
    const scenarios = listScenarioKeys()
    if (scenarios.length === 0) {
      console.log('No scenarios registered.')
      return
    }
    console.log('Available scenarios:')
    for (const scenario of scenarios) {
      console.log(`- ${scenario}`)
    }
    return
  }

  const scenarioKeys = resolveScenarioKeysToRun(options)
  let passed = 0
  let failed = 0

  for (const scenarioKey of scenarioKeys) {
    const resolved =
      scenarioKey === 'adhoc'
        ? resolveScenario(options)
        : resolveScenario({
            ...options,
            scenario: scenarioKey
          })
    const builtSuite =
      options.cmd != null && options.cmd.length > 0
        ? buildSuiteFromSingleCommand(
            options.cmd,
            resolved.name,
            CONFIG.cluster.conformanceClusterName
          )
        : buildSuiteFromScenario({
            name: resolved.name,
            clusterName: CONFIG.cluster.conformanceClusterName,
            scenario: resolved.scenario
          })
    const result = runConformanceSuite(builtSuite.suite, {
      ...(options.quiet
        ? {}
        : { progressListener: createConsoleProgressListener() })
    })

    if (result.ok) {
      passed += 1
      continue
    }

    failed += 1
    console.error(`[${builtSuite.suite.name}] ${result.error}`)
  }

  console.log('\n' + '='.repeat(50))
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  if (failed > 0) {
    process.exit(1)
  }
  console.log('All conformance scenarios passed.')
}

const entryFile = process.argv[1]
if (entryFile != null) {
  const entryHref = pathToFileURL(entryFile).href
  if (import.meta.url === entryHref) {
    main()
  }
}
