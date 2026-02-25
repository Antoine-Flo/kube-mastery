#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { runConformanceSuite } from './lib/conformance-engine'
import type { ConformanceSuite } from './lib/conformance-types'
import type {
  ConformanceProgressEvent,
  ConformanceProgressListener
} from './lib/conformance-engine'

const GENERATED_SUITE_PATH = join(
  process.cwd(),
  'bin',
  'config',
  'generated',
  'exhaustive-suite.json'
)
const GENERATED_COMMAND_SUITES_DIR = join(
  process.cwd(),
  'bin',
  'config',
  'generated',
  'by-command'
)

interface CliOptions {
  suitePath?: string
  command?: string
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

    if (arg.startsWith('--suite-path=')) {
      options.suitePath = arg.slice('--suite-path='.length)
      continue
    }
    if (arg === '--suite-path' && index + 1 < argv.length) {
      options.suitePath = argv[index + 1]
      index += 1
      continue
    }

    if (arg.startsWith('--command=')) {
      options.command = arg.slice('--command='.length)
      continue
    }
    if (arg === '--command' && index + 1 < argv.length) {
      options.command = argv[index + 1]
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
  if (event.action.namespace != null && event.action.namespace.length > 0) {
    return `kubectl wait --for=condition=Ready pod --all -n ${event.action.namespace}`
  }
  return 'kubectl wait --for=condition=Ready pod --all --all-namespaces'
}

const createConsoleProgressListener = (): ConformanceProgressListener => {
  return {
    onActionStart: (event) => {
      console.log(renderActionLabel(event))
    }
  }
}

export const listAvailableCommandSuites = (): string[] => {
  if (!existsSync(GENERATED_COMMAND_SUITES_DIR)) {
    return []
  }

  return readdirSync(GENERATED_COMMAND_SUITES_DIR)
    .filter((entry) => {
      return entry.endsWith('.json')
    })
    .map((entry) => {
      return entry.slice(0, -'.json'.length)
    })
    .sort((left, right) => {
      return left.localeCompare(right)
    })
}

export const resolveSuitePath = (options: CliOptions): string => {
  if (options.suitePath != null && options.suitePath.length > 0) {
    if (options.suitePath.startsWith('/')) {
      return options.suitePath
    }
    return join(process.cwd(), options.suitePath)
  }

  if (options.command != null && options.command.length > 0) {
    return join(GENERATED_COMMAND_SUITES_DIR, `${options.command}.json`)
  }

  return GENERATED_SUITE_PATH
}

export const loadGeneratedSuite = (suitePath: string): ConformanceSuite => {
  if (!existsSync(suitePath)) {
    throw new Error(
      `Generated suite not found at ${suitePath}. Run the generator first.`
    )
  }
  const raw = readFileSync(suitePath, 'utf-8')
  const parsed = JSON.parse(raw) as ConformanceSuite
  if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.actions)) {
    throw new Error(`Invalid generated suite format in ${suitePath}`)
  }
  return parsed
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))

  if (options.list) {
    const commands = listAvailableCommandSuites()
    if (commands.length === 0) {
      console.log(
        'No command suites found. Run "tsx bin/generate-conformance-scenario.ts" first.'
      )
      return
    }
    console.log('Available command suites:')
    for (const command of commands) {
      console.log(`- ${command}`)
    }
    return
  }

  const resolvedSuitePath = resolveSuitePath(options)
  const suite = loadGeneratedSuite(resolvedSuitePath)
  const result = runConformanceSuite(suite, {
    ...(options.quiet ? {} : { progressListener: createConsoleProgressListener() })
  })

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

const entryFile = process.argv[1]
if (entryFile != null) {
  const entryHref = pathToFileURL(entryFile).href
  if (import.meta.url === entryHref) {
    main()
  }
}
