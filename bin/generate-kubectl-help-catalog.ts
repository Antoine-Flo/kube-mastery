import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const WORKSPACE_ROOT = process.cwd()
const OUTPUT_PATH = path.join(
  WORKSPACE_ROOT,
  'src',
  'core',
  'kubectl',
  'cli',
  'descriptions',
  'generatedOfficialHelpCatalog.ts'
)

const HELP_CRAWL_BLOCKLIST = new Set<string>([
  'alpha',
  'plugin',
  '__complete',
  '__completeNoDesc'
])

const normalizeCommandKey = (tokens: readonly string[]): string => {
  if (tokens.length === 0) {
    return 'kubectl'
  }
  return `kubectl ${tokens.join(' ')}`
}

const getHelpOutput = (commandTokens: readonly string[]): string => {
  const args = [...commandTokens, '-h']
  if (commandTokens.length === 0) {
    args.splice(0, 0, '--help')
    args.pop()
  }
  const commandArgs = commandTokens.length === 0 ? ['--help'] : args
  return execFileSync('kubectl', commandArgs, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

const getCommandOutput = (commandTokens: readonly string[]): string => {
  return execFileSync('kubectl', [...commandTokens], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

const parseAvailableSubcommands = (helpText: string): string[] => {
  const lines = helpText.replace(/\r\n/g, '\n').split('\n')
  const subcommands: string[] = []
  let inCommandsSection = false

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const trimmedLine = line.trim()

    const startsCommandsSection =
      trimmedLine === 'Available Commands:' ||
      /Commands(?:\s*\(.*\))?:$/.test(trimmedLine)
    if (startsCommandsSection) {
      inCommandsSection = true
      continue
    }

    if (!inCommandsSection) {
      continue
    }

    if (trimmedLine.length === 0) {
      inCommandsSection = false
      continue
    }

    if (!line.startsWith('  ')) {
      inCommandsSection = false
      continue
    }

    const firstToken = trimmedLine.split(/\s+/)[0]
    if (firstToken.length === 0) {
      continue
    }
    if (HELP_CRAWL_BLOCKLIST.has(firstToken)) {
      continue
    }
    if (firstToken === 'help') {
      continue
    }
    subcommands.push(firstToken)
  }
  return subcommands
}

const renderCatalogFile = (catalog: Record<string, string>): string => {
  const sortedEntries = Object.entries(catalog).sort(([left], [right]) => {
    return left.localeCompare(right)
  })
  const lines: string[] = []
  lines.push(
    'export const GENERATED_OFFICIAL_KUBECTL_HELP_CATALOG: Record<string, string> = {'
  )
  for (const [key, value] of sortedEntries) {
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
  }
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

const crawlHelpCatalog = (): Record<string, string> => {
  const catalog: Record<string, string> = {}
  const queue: string[][] = [[], ['options']]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const commandTokens = queue.shift() ?? []
    const key = normalizeCommandKey(commandTokens)
    if (visited.has(key)) {
      continue
    }
    visited.add(key)

    let helpText = ''
    try {
      helpText = getHelpOutput(commandTokens)
      const isOptionsCommand =
        commandTokens.length === 1 && commandTokens[0] === 'options'
      if (isOptionsCommand && helpText.trim().length === 0) {
        helpText = getCommandOutput(commandTokens)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.warn(`Skipping ${key}: ${errorMessage}`)
      continue
    }

    catalog[key] = helpText.replace(/\r\n/g, '\n').trimEnd()
    const subcommands = parseAvailableSubcommands(helpText)
    for (const subcommand of subcommands) {
      queue.push([...commandTokens, subcommand])
    }
  }

  return catalog
}

const run = async (): Promise<void> => {
  const catalog = crawlHelpCatalog()
  const renderedCatalog = renderCatalogFile(catalog)
  await fs.writeFile(OUTPUT_PATH, renderedCatalog, 'utf-8')
  console.log(
    `Generated kubectl help catalog with ${Object.keys(catalog).length} commands`
  )
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
