import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type CliOptions = {
  apply: boolean
  cssDir: string
  sourceDirs: string[]
}

type CssFileReport = {
  filePath: string
  definedClasses: Set<string>
  unusedClasses: string[]
  removedRuleCount: number
}

type SourceClassReport = {
  filePath: string
  undefinedClasses: string[]
}

type AstroStyleBlock = {
  cssStart: number
  cssEnd: number
  cssContent: string
}

const DEFAULT_CSS_DIR = 'src/styles'
const DEFAULT_SOURCE_DIRS = ['src']
const SOURCE_EXTENSIONS = new Set([
  '.astro',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.md',
  '.mdx'
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
const KNOWN_EXTERNAL_CLASS_PATTERNS = [/^xterm-/, /^cm-/, /^astro-/, /^language-/]
const IGNORED_CSS_CLASS_LITERALS = new Set(['css', 'js', 'ts', 'map'])

function printHelp(): void {
  console.log(`Usage: tsx bin/clean-unused-css.ts [options]

Options:
  --apply                  Remove safely removable unused CSS rules and empty class attributes
  --css-dir <path>         Folder containing CSS files (default: src/styles)
  --source-dir <path>      Source folder to scan (repeatable, default: src)
  --help                   Show this help

Examples:
  tsx bin/clean-unused-css.ts
  tsx bin/clean-unused-css.ts --apply
  tsx bin/clean-unused-css.ts --source-dir src --source-dir tests`)
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    cssDir: DEFAULT_CSS_DIR,
    sourceDirs: []
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--apply') {
      options.apply = true
      continue
    }

    if (arg === '--css-dir') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('Missing value for --css-dir')
      }
      options.cssDir = value
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

async function collectFilesByExtension(
  rootDir: string,
  acceptedExtensions: Set<string>
): Promise<string[]> {
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
      if (acceptedExtensions.has(extension)) {
        files.push(absolutePath)
      }
    }
  }

  await walk(path.resolve(rootDir))
  return files.sort((left, right) => left.localeCompare(right))
}

async function collectSourceFiles(sourceDirs: string[]): Promise<string[]> {
  const files: string[] = []
  for (const sourceDir of sourceDirs) {
    const scoped = await collectFilesByExtension(sourceDir, SOURCE_EXTENSIONS)
    files.push(...scoped)
  }
  return [...new Set(files)].sort((left, right) => left.localeCompare(right))
}

function extractDefinedClasses(cssContent: string): Set<string> {
  const classes = new Set<string>()
  const classRegex = /(^|[^a-zA-Z0-9_-])\.([_a-zA-Z]+[_a-zA-Z0-9-]*)(?=[^a-zA-Z0-9_-]|$)/g

  for (const match of cssContent.matchAll(classRegex)) {
    const className = match[2]
    if (!className) {
      continue
    }
    if (IGNORED_CSS_CLASS_LITERALS.has(className)) {
      continue
    }
    classes.add(className)
  }

  return classes
}

function extractStringLiterals(content: string): string[] {
  const literals: string[] = []
  const regex = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g

  for (const match of content.matchAll(regex)) {
    const rawValue = match[2] ?? ''
    if (rawValue.length === 0) {
      continue
    }
    literals.push(rawValue)
  }

  return literals
}

function tokenizePotentialClasses(literal: string): string[] {
  const normalized = literal.replace(/\$\{[\s\S]*?\}/g, ' ')
  const parts = normalized.split(/[^a-zA-Z0-9_-]+/g)
  return parts.filter((part) => {
    if (part.length === 0) {
      return false
    }
    return /^[a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?$/.test(part)
  })
}

function extractClassReferences(content: string): Set<string> {
  const found = new Set<string>()
  const attributeRegex = /\bclass(?::list|Name)?\s*=\s*(\{[\s\S]*?\}|(["'`])([\s\S]*?)\2)/g

  for (const match of content.matchAll(attributeRegex)) {
    const fullValue = match[1] ?? ''
    const quotedValue = match[3]

    if (quotedValue !== undefined) {
      const tokens = tokenizePotentialClasses(quotedValue)
      for (const token of tokens) {
        found.add(token)
      }
      continue
    }

    const literals = extractStringLiterals(fullValue)
    for (const literal of literals) {
      const tokens = tokenizePotentialClasses(literal)
      for (const token of tokens) {
        found.add(token)
      }
    }
  }

  const classListRegex = /classList\.(?:add|remove|toggle|contains)\(([\s\S]*?)\)/g
  for (const match of content.matchAll(classListRegex)) {
    const args = match[1] ?? ''
    const literals = extractStringLiterals(args)
    for (const literal of literals) {
      const tokens = tokenizePotentialClasses(literal)
      for (const token of tokens) {
        found.add(token)
      }
    }
  }

  return found
}

function isKnownExternalClassName(className: string): boolean {
  return KNOWN_EXTERNAL_CLASS_PATTERNS.some((pattern) => pattern.test(className))
}

function removeSafelyRemovableRules(
  cssContent: string,
  unusedClassSet: Set<string>
): { content: string; removedRuleCount: number } {
  let removedRuleCount = 0
  const simpleRuleRegex =
    /(^|\n)([ \t]*)(\.[_a-zA-Z]+[_a-zA-Z0-9-]*(?:\s*,\s*\.[_a-zA-Z]+[_a-zA-Z0-9-]*)*)\s*\{[^{}]*\}/g

  const nextContent = cssContent.replace(
    simpleRuleRegex,
    (fullMatch: string, lineStart: string, indentation: string, selectorGroup: string) => {
      const selectors = selectorGroup.split(',').map((selector) => selector.trim())
      if (selectors.length === 0) {
        return fullMatch
      }

      const selectorClasses = selectors
        .map((selector) => {
          const match = selector.match(/^\.([_a-zA-Z]+[_a-zA-Z0-9-]*)$/)
          return match?.[1] ?? null
        })
        .filter((name): name is string => name !== null)

      if (selectorClasses.length !== selectors.length) {
        return fullMatch
      }

      const allUnused = selectorClasses.every((className) => unusedClassSet.has(className))
      if (!allUnused) {
        return fullMatch
      }

      removedRuleCount += 1
      return lineStart.length > 0 ? lineStart : ''
    }
  )

  const cleaned = nextContent.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n')

  return { content: cleaned, removedRuleCount }
}

function removeEmptyClassAttributes(content: string): {
  content: string
  removedAttributeCount: number
} {
  let removedAttributeCount = 0
  let nextContent = content

  const patterns = [
    /\s(?:class|className)\s*=\s*(?:"\s*"|'\s*')/g,
    /\s(?:class|className)\s*=\s*\{\s*(?:"\s*"|'\s*'|`\s*`)\s*\}/g
  ]

  for (const pattern of patterns) {
    nextContent = nextContent.replace(pattern, () => {
      removedAttributeCount += 1
      return ''
    })
  }

  return {
    content: nextContent,
    removedAttributeCount
  }
}

function extractAstroStyleBlocks(content: string): AstroStyleBlock[] {
  const blocks: AstroStyleBlock[] = []
  const styleRegex = /<style\b[^>]*>[\s\S]*?<\/style>/gi

  for (const match of content.matchAll(styleRegex)) {
    const fullMatch = match[0]
    const matchStart = match.index
    if (matchStart === undefined) {
      continue
    }

    const openTagEndOffset = fullMatch.indexOf('>')
    if (openTagEndOffset < 0) {
      continue
    }

    const closeTagOffset = fullMatch.toLowerCase().lastIndexOf('</style>')
    if (closeTagOffset < 0 || closeTagOffset < openTagEndOffset + 1) {
      continue
    }

    const cssStart = matchStart + openTagEndOffset + 1
    const cssEnd = matchStart + closeTagOffset
    blocks.push({
      cssStart,
      cssEnd,
      cssContent: content.slice(cssStart, cssEnd)
    })
  }

  return blocks
}

async function collectAstroInlineCssDefinitions(
  sourceFiles: string[]
): Promise<Map<string, Set<string>>> {
  const definitionsByAstroFile = new Map<string, Set<string>>()

  for (const filePath of sourceFiles) {
    if (!filePath.endsWith('.astro')) {
      continue
    }

    const content = await readFile(filePath, 'utf8')
    const blocks = extractAstroStyleBlocks(content)
    if (blocks.length === 0) {
      continue
    }

    const classSet = new Set<string>()
    for (const block of blocks) {
      const classes = extractDefinedClasses(block.cssContent)
      for (const className of classes) {
        classSet.add(className)
      }
    }

    if (classSet.size > 0) {
      definitionsByAstroFile.set(filePath, classSet)
    }
  }

  return definitionsByAstroFile
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const cssFiles = await collectFilesByExtension(options.cssDir, new Set(['.css']))
  if (cssFiles.length === 0) {
    throw new Error(`No CSS files found in ${options.cssDir}`)
  }

  const sourceFiles = await collectSourceFiles(options.sourceDirs)
  const definitionsByFile = new Map<string, Set<string>>()
  const astroInlineDefinitionsByFile = await collectAstroInlineCssDefinitions(sourceFiles)
  const allDefinedClasses = new Set<string>()

  for (const filePath of cssFiles) {
    const content = await readFile(filePath, 'utf8')
    const classes = extractDefinedClasses(content)
    definitionsByFile.set(filePath, classes)
    for (const className of classes) {
      allDefinedClasses.add(className)
    }
  }

  for (const [filePath, classes] of astroInlineDefinitionsByFile.entries()) {
    definitionsByFile.set(filePath, classes)
    for (const className of classes) {
      allDefinedClasses.add(className)
    }
  }

  const usedClasses = new Set<string>()
  const undefinedClassesByFile = new Map<string, Set<string>>()
  for (const filePath of sourceFiles) {
    const content = await readFile(filePath, 'utf8')
    const classReferences = extractClassReferences(content)
    for (const className of classReferences) {
      if (allDefinedClasses.has(className)) {
        usedClasses.add(className)
        continue
      }
      if (isKnownExternalClassName(className)) {
        continue
      }
      if (!undefinedClassesByFile.has(filePath)) {
        undefinedClassesByFile.set(filePath, new Set<string>())
      }
      undefinedClassesByFile.get(filePath)?.add(className)
    }
  }

  const reports: CssFileReport[] = []
  let totalDefined = 0
  let totalUnused = 0
  let totalRemovedRules = 0
  let totalUndefinedClassRefs = 0
  let totalRemovedEmptyClassAttributes = 0

  const reportFiles = [...cssFiles, ...astroInlineDefinitionsByFile.keys()].sort((a, b) =>
    a.localeCompare(b)
  )

  for (const filePath of reportFiles) {
    const defined = definitionsByFile.get(filePath) ?? new Set<string>()
    const unused = [...defined].filter((name) => !usedClasses.has(name)).sort()
    totalDefined += defined.size
    totalUnused += unused.length

    let removedRuleCount = 0
    if (options.apply && unused.length > 0) {
      if (filePath.endsWith('.css')) {
        const rawContent = await readFile(filePath, 'utf8')
        const result = removeSafelyRemovableRules(rawContent, new Set(unused))
        removedRuleCount = result.removedRuleCount
        if (removedRuleCount > 0 && result.content !== rawContent) {
          await writeFile(filePath, result.content, 'utf8')
        }
      } else if (filePath.endsWith('.astro')) {
        const rawContent = await readFile(filePath, 'utf8')
        const blocks = extractAstroStyleBlocks(rawContent)
        if (blocks.length > 0) {
          let cursor = 0
          let nextContent = ''
          for (const block of blocks) {
            nextContent += rawContent.slice(cursor, block.cssStart)
            const result = removeSafelyRemovableRules(block.cssContent, new Set(unused))
            removedRuleCount += result.removedRuleCount
            nextContent += result.content
            cursor = block.cssEnd
          }
          nextContent += rawContent.slice(cursor)
          if (removedRuleCount > 0 && nextContent !== rawContent) {
            await writeFile(filePath, nextContent, 'utf8')
          }
        }
      }
    }

    totalRemovedRules += removedRuleCount
    reports.push({
      filePath,
      definedClasses: defined,
      unusedClasses: unused,
      removedRuleCount
    })
  }

  for (const report of reports) {
    const relativeFile = path.relative(process.cwd(), report.filePath)
    console.log(`\n${relativeFile}`)
    console.log(`- total classes: ${report.definedClasses.size}`)
    console.log(`- unused classes: ${report.unusedClasses.length}`)
    if (options.apply) {
      console.log(`- removed rules: ${report.removedRuleCount}`)
    }
    if (report.unusedClasses.length > 0) {
      for (const className of report.unusedClasses) {
        console.log(`  - ${className}`)
      }
    }
  }

  const sourceReports: SourceClassReport[] = [...undefinedClassesByFile.entries()]
    .map(([filePath, classSet]) => {
      const undefinedClasses = [...classSet].sort((left, right) => left.localeCompare(right))
      totalUndefinedClassRefs += undefinedClasses.length
      return { filePath, undefinedClasses }
    })
    .sort((left, right) => left.filePath.localeCompare(right.filePath))

  if (sourceReports.length > 0) {
    console.log('\nClass references without CSS definition')
    for (const report of sourceReports) {
      const relativeFile = path.relative(process.cwd(), report.filePath)
      console.log(`\n${relativeFile}`)
      console.log(`- undefined class references: ${report.undefinedClasses.length}`)
      for (const className of report.undefinedClasses) {
        console.log(`  - ${className}`)
      }
    }
  }

  if (options.apply) {
    for (const filePath of sourceFiles) {
      if (!filePath.endsWith('.astro')) {
        continue
      }

      const rawContent = await readFile(filePath, 'utf8')
      const result = removeEmptyClassAttributes(rawContent)
      totalRemovedEmptyClassAttributes += result.removedAttributeCount
      if (result.removedAttributeCount > 0 && result.content !== rawContent) {
        await writeFile(filePath, result.content, 'utf8')
      }
    }
  }

  console.log('\nSummary')
  console.log(`- scanned CSS files: ${cssFiles.length}`)
  console.log(`- scanned Astro inline style files: ${astroInlineDefinitionsByFile.size}`)
  console.log(`- scanned source files: ${sourceFiles.length}`)
  console.log(`- total CSS classes: ${totalDefined}`)
  console.log(`- used classes: ${usedClasses.size}`)
  console.log(`- unused classes: ${totalUnused}`)
  console.log(`- undefined class references in source: ${totalUndefinedClassRefs}`)
  if (options.apply) {
    console.log(`- removed rules: ${totalRemovedRules}`)
    console.log(`- removed empty class attributes: ${totalRemovedEmptyClassAttributes}`)
    console.log(
      '- apply mode removes only simple class rules, complex selectors are reported but kept'
    )
  }

  if (!options.apply && totalUnused > 0) {
    process.exitCode = 1
  }
}

run().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message)
  } else {
    console.error('Unknown error while cleaning CSS classes.')
  }
  process.exit(1)
})
