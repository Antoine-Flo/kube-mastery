import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const summaryPath = resolve(process.cwd(), 'coverage', 'coverage-summary.json')
const finalPath = resolve(process.cwd(), 'coverage', 'coverage-final.json')

const DIRECTORY_THRESHOLDS = [
  { key: 'src/core/kubectl', minStatements: 82.5 },
  { key: 'src/core/terminal', minStatements: 66 },
  { key: 'src/core/control-plane', minStatements: 84 }
]

const readJsonFile = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch (error) {
    return null
  }
}

const listMatchingSummaryEntries = (summary, keyPrefix) => {
  return Object.entries(summary).filter(([entryKey]) => {
    return (
      entryKey.includes(`/${keyPrefix}/`) || entryKey.endsWith(`/${keyPrefix}`)
    )
  })
}

const averageStatementsFromSummary = (entries) => {
  let totalCovered = 0
  let total = 0
  for (const [, metrics] of entries) {
    const statementMetrics = metrics.statements
    totalCovered += statementMetrics.covered
    total += statementMetrics.total
  }
  if (total === 0) {
    return 100
  }
  return (totalCovered / total) * 100
}

const averageStatementsFromFinal = (report, keyPrefix) => {
  const entries = Object.entries(report).filter(([path]) => {
    return path.includes(`/${keyPrefix}/`) || path.endsWith(`/${keyPrefix}`)
  })
  let covered = 0
  let total = 0
  for (const [, metrics] of entries) {
    const statements = metrics.s ?? {}
    const ids = Object.keys(statements)
    total += ids.length
    for (const value of Object.values(statements)) {
      if (value > 0) {
        covered += 1
      }
    }
  }
  if (total === 0) {
    return 100
  }
  return (covered / total) * 100
}

const main = () => {
  const summary = readJsonFile(summaryPath)
  const finalReport = summary == null ? readJsonFile(finalPath) : null
  if (summary == null && finalReport == null) {
    throw new Error(
      `Unable to read coverage summary at ${summaryPath} or coverage report at ${finalPath}`
    )
  }
  const failures = []

  for (const threshold of DIRECTORY_THRESHOLDS) {
    const percentage =
      summary != null
        ? averageStatementsFromSummary(
            listMatchingSummaryEntries(summary, threshold.key)
          )
        : averageStatementsFromFinal(finalReport, threshold.key)
    if (percentage < threshold.minStatements) {
      failures.push(
        `${threshold.key}: ${percentage.toFixed(2)}% < ${threshold.minStatements}%`
      )
    }
  }

  if (failures.length > 0) {
    console.error('Coverage guard failed')
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('Coverage guard passed')
}

main()
