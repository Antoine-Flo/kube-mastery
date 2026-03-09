import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type CliOptions = {
  apply: boolean
  messagesDir: string
  sourceDirs: string[]
}

const DEFAULT_MESSAGES_DIR = 'messages'
const DEFAULT_SOURCE_DIRS = ['src']
const DEFAULT_EXTENSIONS = new Set([
  '.astro',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs'
])
const SKIP_DIRS = new Set([
  '.git',
  '.cursor',
  '.astro',
  'dist',
  'node_modules',
  'coverage',
  'refs'
])

function printHelp(): void {
  console.log(`Usage: tsx bin/clean-unused-translations.ts [options]

Options:
  --apply                    Remove unused keys from messages files
  --messages-dir <path>      Folder containing locale JSON files (default: messages)
  --source-dir <path>        Source folder to scan (repeatable, default: src)
  --help                     Show this help

Examples:
  tsx bin/clean-unused-translations.ts
  tsx bin/clean-unused-translations.ts --apply
  tsx bin/clean-unused-translations.ts --source-dir src --source-dir tests`)
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    messagesDir: DEFAULT_MESSAGES_DIR,
    sourceDirs: []
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--apply') {
      options.apply = true
      continue
    }

    if (arg === '--messages-dir') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --messages-dir')
      }
      options.messagesDir = value
      index += 1
      continue
    }

    if (arg === '--source-dir') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --source-dir')
      }
      options.sourceDirs.push(value)
      index += 1
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  if (options.sourceDirs.length === 0) {
    options.sourceDirs = [...DEFAULT_SOURCE_DIRS]
  }

  return options
}

async function listMessageFiles(messagesDir: string): Promise<string[]> {
  const absoluteDir = path.resolve(messagesDir)
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(absoluteDir, entry.name))
    .sort((left, right) => left.localeCompare(right))
}

async function collectSourceFiles(sourceDirs: string[]): Promise<string[]> {
  const files: string[] = []

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue
        }
        await walk(absolutePath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const extension = path.extname(entry.name)
      if (DEFAULT_EXTENSIONS.has(extension)) {
        files.push(absolutePath)
      }
    }
  }

  for (const sourceDir of sourceDirs) {
    const absolutePath = path.resolve(sourceDir)
    await walk(absolutePath)
  }

  return files
}

function extractStringLiterals(content: string): string[] {
  const literals: string[] = []
  const regex = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g

  for (const match of content.matchAll(regex)) {
    const quote = match[1]
    const rawValue = match[2] ?? ''
    if (quote === '`' && rawValue.includes('${')) {
      continue
    }
    if (rawValue.length === 0) {
      continue
    }
    literals.push(rawValue)
  }

  return literals
}

function normalizeMessageObject(
  data: unknown,
  filePath: string
): Record<string, string> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Invalid message file format: ${filePath}`)
  }

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') {
      continue
    }
    result[key] = value
  }
  return result
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const messageFiles = await listMessageFiles(options.messagesDir)

  if (messageFiles.length === 0) {
    throw new Error(`No JSON message files found in ${options.messagesDir}`)
  }

  const messagesByFile = new Map<string, Record<string, string>>()
  const allKeys = new Set<string>()

  for (const filePath of messageFiles) {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    const messageObject = normalizeMessageObject(parsed, filePath)
    messagesByFile.set(filePath, messageObject)

    for (const key of Object.keys(messageObject)) {
      if (key === '$schema') {
        continue
      }
      allKeys.add(key)
    }
  }

  const sourceFiles = await collectSourceFiles(options.sourceDirs)
  const usedKeys = new Set<string>()

  for (const filePath of sourceFiles) {
    const content = await readFile(filePath, 'utf8')
    const literals = extractStringLiterals(content)
    for (const literal of literals) {
      if (allKeys.has(literal)) {
        usedKeys.add(literal)
      }
    }
  }

  let totalUnused = 0

  for (const [filePath, messageObject] of messagesByFile.entries()) {
    const keys = Object.keys(messageObject).filter((key) => key !== '$schema')
    const unusedKeys = keys.filter((key) => !usedKeys.has(key))
    totalUnused += unusedKeys.length

    const relativeFile = path.relative(process.cwd(), filePath)
    console.log(`\n${relativeFile}`)
    console.log(`- total keys: ${keys.length}`)
    console.log(`- unused keys: ${unusedKeys.length}`)

    if (unusedKeys.length > 0) {
      for (const key of unusedKeys) {
        console.log(`  - ${key}`)
      }
    }

    if (options.apply) {
      const cleanedEntries = Object.entries(messageObject).filter(([key]) => {
        if (key === '$schema') {
          return true
        }
        return usedKeys.has(key)
      })
      const cleanedObject = Object.fromEntries(cleanedEntries)
      await writeFile(
        filePath,
        `${JSON.stringify(cleanedObject, null, 2)}\n`,
        'utf8'
      )
    }
  }

  console.log('\nSummary')
  console.log(`- scanned source files: ${sourceFiles.length}`)
  console.log(`- total translation keys: ${allKeys.size}`)
  console.log(`- used translation keys: ${usedKeys.size}`)
  console.log(`- unused translation keys: ${totalUnused}`)

  if (!options.apply && totalUnused > 0) {
    process.exitCode = 1
  }
}

run().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message)
  } else {
    console.error('Unknown error while cleaning translations.')
  }
  process.exit(1)
})
