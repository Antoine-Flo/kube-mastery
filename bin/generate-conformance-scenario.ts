#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import {
  generateLifecycleSuite,
  type LifecycleSuiteTemplate
} from './lib/scenario-generator'
import { createCommandCatalogSegments } from './config/conformance/command-catalog'
import {
  filterSegmentsByCommand,
  listCommandsFromSegments,
  type KubectlCommandName
} from './lib/command-segmentation'

const EXHAUSTIVE_OUTPUT_PATH = 'bin/config/generated/exhaustive-suite.json'
const BY_COMMAND_OUTPUT_DIR = 'bin/config/generated/by-command'
const DEFAULT_TEMPLATE: Omit<LifecycleSuiteTemplate, 'segments' | 'name'> = {
  clusterName: 'conformance'
}

export const buildExhaustiveSuite = () => {
  const segments = createCommandCatalogSegments()
  return generateLifecycleSuite({
    ...DEFAULT_TEMPLATE,
    name: 'exhaustive-single-cluster-suite',
    segments
  })
}

export const buildCommandSuite = (commandName: KubectlCommandName) => {
  const segments = createCommandCatalogSegments()
  const commandSegments = filterSegmentsByCommand(segments, commandName)
  if (commandSegments.length === 0) {
    return undefined
  }

  return generateLifecycleSuite({
    ...DEFAULT_TEMPLATE,
    name: `${commandName}-command-suite`,
    segments: commandSegments
  })
}

export const listSupportedCommandSuites = (): KubectlCommandName[] => {
  const segments = createCommandCatalogSegments()
  return listCommandsFromSegments(segments)
}

const writeJsonFile = (relativePath: string, payload: unknown): string => {
  const outputPath = join(process.cwd(), relativePath)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
  return outputPath
}

const main = (): void => {
  const exhaustiveSuite = buildExhaustiveSuite()
  const exhaustivePath = writeJsonFile(EXHAUSTIVE_OUTPUT_PATH, exhaustiveSuite)
  console.log(`Generated suite at ${exhaustivePath}`)

  const commandNames = listSupportedCommandSuites()
  const generatedCommands: string[] = []
  for (const commandName of commandNames) {
    const suite = buildCommandSuite(commandName)
    if (suite === undefined) {
      continue
    }
    const relativePath = `${BY_COMMAND_OUTPUT_DIR}/${commandName}.json`
    const writtenPath = writeJsonFile(relativePath, suite)
    generatedCommands.push(`${commandName}: ${writtenPath}`)
  }

  console.log('Generated command suites:')
  for (const line of generatedCommands) {
    console.log(`- ${line}`)
  }
}

const entryFile = process.argv[1]
if (entryFile != null) {
  const entryHref = pathToFileURL(entryFile).href
  if (import.meta.url === entryHref) {
    main()
  }
}
