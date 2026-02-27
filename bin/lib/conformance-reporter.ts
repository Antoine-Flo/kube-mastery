import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ActionExecutionRecord } from './conformance-types'

const normalizeToken = (value: string): string => {
  return value.trim().toLowerCase()
}

const sanitizeBucketName = (value: string): string => {
  const sanitized = value.replace(/[^a-z0-9-]/g, '-')
  if (sanitized.length === 0) {
    return 'misc'
  }
  return sanitized
}

const inferCommandBucketFromCommand = (command: string): string => {
  const tokens = command
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
  if (tokens.length < 2) {
    return 'misc'
  }
  if (normalizeToken(tokens[0]) !== 'kubectl') {
    return 'misc'
  }
  for (let index = 1; index < tokens.length; index++) {
    const token = normalizeToken(tokens[index])
    if (token === '--') {
      break
    }
    if (token.startsWith('-')) {
      continue
    }
    return sanitizeBucketName(token)
  }
  return 'misc'
}

const inferCommandBucketFromDiffEntry = (entry: string): string => {
  const commandLine = entry
    .split('\n')
    .find((line) => line.startsWith('[command] '))
  if (!commandLine) {
    return 'misc'
  }
  const command = commandLine.slice('[command] '.length)
  return inferCommandBucketFromCommand(command)
}

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
  const diffRecords: Array<{ entry: string; bucket: string }> = []

  const getBuckets = (): string[] => {
    const buckets = new Set<string>()
    for (const record of kindRecords) {
      buckets.add(inferCommandBucketFromCommand(record.command))
    }
    for (const record of runnerRecords) {
      buckets.add(inferCommandBucketFromCommand(record.command))
    }
    for (const record of diffRecords) {
      buckets.add(record.bucket)
    }
    return Array.from(buckets).sort((left, right) => left.localeCompare(right))
  }

  return {
    recordKind(record: ActionExecutionRecord): void {
      kindRecords.push(record)
    },
    recordRunner(record: ActionExecutionRecord): void {
      runnerRecords.push(record)
    },
    recordDiff(entry: string): void {
      diffRecords.push({
        entry,
        bucket: inferCommandBucketFromDiffEntry(entry)
      })
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
      writeFileSync(
        join(outputDir, 'diff.log'),
        diffRecords.map((record) => record.entry).join('\n'),
        'utf-8'
      )

      const buckets = getBuckets()
      for (const bucket of buckets) {
        const bucketDir = join(outputDir, bucket)
        mkdirSync(bucketDir, { recursive: true })

        const bucketKindRecords = kindRecords.filter((record) => {
          return inferCommandBucketFromCommand(record.command) === bucket
        })
        const bucketRunnerRecords = runnerRecords.filter((record) => {
          return inferCommandBucketFromCommand(record.command) === bucket
        })
        const bucketDiffRecords = diffRecords
          .filter((record) => record.bucket === bucket)
          .map((record) => record.entry)

        writeFileSync(
          join(bucketDir, 'kind.log'),
          renderBackendReport(bucketKindRecords, 'kind'),
          'utf-8'
        )
        writeFileSync(
          join(bucketDir, 'runner.log'),
          renderBackendReport(bucketRunnerRecords, 'runner'),
          'utf-8'
        )
        writeFileSync(join(bucketDir, 'diff.log'), bucketDiffRecords.join('\n'), 'utf-8')
      }
    }
  }
}
