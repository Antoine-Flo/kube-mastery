import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const reportPath = resolve(process.cwd(), 'coverage', 'coverage-final.json')

const parseCoverage = () => {
  try {
    return JSON.parse(readFileSync(reportPath, 'utf-8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`Unable to read ${reportPath}: ${message}`)
  }
}

const statementPercentage = (entry) => {
  const statements = entry.s ?? {}
  const ids = Object.keys(statements)
  if (ids.length === 0) {
    return 100
  }
  let covered = 0
  for (const value of Object.values(statements)) {
    if (value > 0) {
      covered += 1
    }
  }
  return (covered / ids.length) * 100
}

const isTrackedFile = (path) => {
  if (path.includes('/node_modules/')) {
    return false
  }
  if (path.includes('/tests/')) {
    return false
  }
  if (path.includes('/coverage/')) {
    return false
  }
  if (path.endsWith('.json')) {
    return false
  }
  return (
    path.includes('/src/') ||
    path.includes('/bin/') ||
    path.includes('/conformance/')
  )
}

const toRelativePath = (absolutePath) => {
  const workspace = `${process.cwd()}/`
  return absolutePath.startsWith(workspace)
    ? absolutePath.slice(workspace.length)
    : absolutePath
}

const main = () => {
  const report = parseCoverage()
  const rows = Object.entries(report)
    .filter(([path]) => isTrackedFile(path))
    .map(([path, entry]) => {
      return {
        path: toRelativePath(path),
        statements: statementPercentage(entry)
      }
    })
    .sort((left, right) => left.statements - right.statements)
    .slice(0, 20)

  console.log('Top 20 lowest statement coverage files')
  for (const row of rows) {
    console.log(`${row.statements.toFixed(2)}% ${row.path}`)
  }
}

main()
