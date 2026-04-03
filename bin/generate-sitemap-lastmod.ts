import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const SOURCE_ROOTS = ['src/pages', 'src/courses', 'src/blog']
const ALLOWED_EXTENSIONS = new Set(['.astro', '.md', '.ts'])
const OUTPUT_FILE = 'src/generated/sitemap-lastmod.json'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toPosixPath(value: string): string {
  return value.replaceAll('\\', '/')
}

function collectSourceFiles(rootDir: string): string[] {
  const absoluteRoot = path.resolve(process.cwd(), rootDir)
  const stack = [absoluteRoot]
  const files: string[] = []

  while (stack.length > 0) {
    const currentDir = stack.pop()
    if (!currentDir) {
      continue
    }

    const entries = readdirSync(currentDir)
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry)
      const fileStat = statSync(absolutePath)

      if (fileStat.isDirectory()) {
        stack.push(absolutePath)
        continue
      }

      const extension = path.extname(entry)
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        continue
      }

      const relativePath = toPosixPath(path.relative(process.cwd(), absolutePath))
      files.push(relativePath)
    }
  }

  files.sort((a, b) => a.localeCompare(b))
  return files
}

function getLastCommitDate(relativePath: string): string | null {
  try {
    const output = execFileSync(
      'git',
      ['log', '-1', '--format=%cs', '--', relativePath],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    ).trim()

    if (!DATE_PATTERN.test(output)) {
      return null
    }

    return output
  } catch {
    return null
  }
}

function buildLastmodIndex(): Record<string, string> {
  const sourceFiles = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(root))
  const index: Record<string, string> = {}

  for (const sourceFile of sourceFiles) {
    const commitDate = getLastCommitDate(sourceFile)
    if (!commitDate) {
      continue
    }
    index[sourceFile] = commitDate
  }

  return index
}

function writeOutput(index: Record<string, string>): void {
  const absoluteOutputPath = path.resolve(process.cwd(), OUTPUT_FILE)
  mkdirSync(path.dirname(absoluteOutputPath), { recursive: true })
  const json = `${JSON.stringify(index, null, 2)}\n`
  writeFileSync(absoluteOutputPath, json, 'utf8')
}

function main(): void {
  const index = buildLastmodIndex()
  writeOutput(index)
  console.log(`Generated ${OUTPUT_FILE} with ${Object.keys(index).length} entries.`)
}

main()
