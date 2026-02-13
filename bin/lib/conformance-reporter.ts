import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ActionExecutionRecord } from './conformance-types'

const formatRecord = (record: ActionExecutionRecord): string => {
  return [
    `[action] ${record.actionId} (${record.actionType})`,
    `[command] ${record.command}`,
    `[exitCode] ${record.exitCode}`,
    '[stdout]',
    record.stdout || '(empty)',
    '[stderr]',
    record.stderr || '(empty)',
    '[normalized]',
    record.normalized || '(empty)',
    '---'
  ].join('\n')
}

const renderBackendReport = (
  records: ActionExecutionRecord[],
  backend: 'kind' | 'runner'
): string => {
  if (records.length === 0) {
    return ''
  }
  const suiteName = records[0].suiteName
  const body = records.map((record) => formatRecord(record)).join('\n')
  return [`[suite] ${suiteName}`, `[backend] ${backend}`, '---', body].join('\n')
}

export interface ConformanceReporter {
  recordKind: (record: ActionExecutionRecord) => void
  recordRunner: (record: ActionExecutionRecord) => void
  recordDiff: (entry: string) => void
  flush: () => void
}

export const createConformanceReporter = (
  outputDir = join(process.cwd(), 'artifacts', 'conformance')
): ConformanceReporter => {
  const kindRecords: ActionExecutionRecord[] = []
  const runnerRecords: ActionExecutionRecord[] = []
  const diffRecords: string[] = []

  return {
    recordKind(record: ActionExecutionRecord): void {
      kindRecords.push(record)
    },
    recordRunner(record: ActionExecutionRecord): void {
      runnerRecords.push(record)
    },
    recordDiff(entry: string): void {
      diffRecords.push(entry)
    },
    flush(): void {
      mkdirSync(outputDir, { recursive: true })
      writeFileSync(
        join(outputDir, 'kind.log'),
        renderBackendReport(kindRecords, 'kind'),
        'utf-8'
      )
      writeFileSync(
        join(outputDir, 'runner.log'),
        renderBackendReport(runnerRecords, 'runner'),
        'utf-8'
      )
      writeFileSync(join(outputDir, 'diff.log'), diffRecords.join('\n'), 'utf-8')
    }
  }
}
