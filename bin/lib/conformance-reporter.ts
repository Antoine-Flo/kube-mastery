import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ActionExecutionRecord } from './conformance-types'

const RESOURCE_ALIAS_MAP: Record<string, string> = {
  pods: 'pods',
  pod: 'pods',
  po: 'pods',
  deployments: 'deployments',
  deployment: 'deployments',
  deploy: 'deployments',
  services: 'services',
  service: 'services',
  svc: 'services',
  namespaces: 'namespaces',
  namespace: 'namespaces',
  ns: 'namespaces',
  configmaps: 'configmaps',
  configmap: 'configmaps',
  cm: 'configmaps',
  secrets: 'secrets',
  secret: 'secrets',
  nodes: 'nodes',
  node: 'nodes',
  no: 'nodes',
  replicasets: 'replicasets',
  replicaset: 'replicasets',
  rs: 'replicasets',
  all: 'all'
}

const FLAGS_REQUIRING_VALUES = new Set([
  'n',
  'namespace',
  'o',
  'output',
  'l',
  'selector',
  'tail',
  'c',
  'container',
  'namespaces',
  'output-directory',
  'replicas',
  'image',
  'port',
  'raw',
  'api-version',
  'f',
  'filename'
])

const normalizeToken = (value: string): string => {
  return value.trim().toLowerCase()
}

const inferBucketFromResourceToken = (resourceToken: string): string => {
  const normalizedToken = normalizeToken(resourceToken)
  const explainToken = normalizedToken.split('.')[0]
  return RESOURCE_ALIAS_MAP[explainToken] || 'misc'
}

const findFirstPositionalAfterAction = (
  tokens: string[],
  actionIndex = 2
): string | undefined => {
  for (let index = actionIndex; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === '--') {
      break
    }
    if (!token.startsWith('-')) {
      return token
    }

    const flagName = token.replace(/^-+/, '').split('=')[0]
    const hasInlineValue = token.includes('=')
    if (FLAGS_REQUIRING_VALUES.has(flagName) && !hasInlineValue) {
      index += 1
    }
  }
  return undefined
}

const inferResourceBucketFromCommand = (command: string): string => {
  const tokens = command
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
  if (tokens.length < 2 || tokens[0] !== 'kubectl') {
    return 'misc'
  }

  const action = normalizeToken(tokens[1])
  if (action === 'logs' || action === 'exec') {
    return 'pods'
  }

  if (action === 'explain') {
    const resourceToken = findFirstPositionalAfterAction(tokens)
    if (resourceToken) {
      return inferBucketFromResourceToken(resourceToken)
    }
    return 'misc'
  }

  if (action === 'get') {
    const hasRaw = tokens.some((token) => token.startsWith('--raw'))
    if (hasRaw) {
      return 'discovery'
    }
  }

  const resourceToken = findFirstPositionalAfterAction(tokens)
  if (!resourceToken) {
    return 'misc'
  }
  return inferBucketFromResourceToken(resourceToken)
}

const inferResourceBucketFromDiffEntry = (entry: string): string => {
  const commandLine = entry
    .split('\n')
    .find((line) => line.startsWith('[command] '))
  if (!commandLine) {
    return 'misc'
  }
  const command = commandLine.slice('[command] '.length)
  return inferResourceBucketFromCommand(command)
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
      buckets.add(inferResourceBucketFromCommand(record.command))
    }
    for (const record of runnerRecords) {
      buckets.add(inferResourceBucketFromCommand(record.command))
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
        bucket: inferResourceBucketFromDiffEntry(entry)
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
          return inferResourceBucketFromCommand(record.command) === bucket
        })
        const bucketRunnerRecords = runnerRecords.filter((record) => {
          return inferResourceBucketFromCommand(record.command) === bucket
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
