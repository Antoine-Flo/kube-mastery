import { parse } from 'yaml'
import { readFileSync } from 'node:fs'
import { error, success, type Result } from '../../lib/types'

export interface DrillParityManifest {
  path: string
  content?: string
  sourcePath?: string
}

export interface DrillParityStep {
  id: string
  run: string
  expectParity: boolean
}

export interface DrillParityClusterCheck {
  id: string
  kind: string
  name: string
  namespace?: string
  path: string
  expected: string
  match?: 'equals' | 'contains'
  requireEquivalent?: boolean
}

export interface DrillParityFilesystemCheck {
  id: string
  path: string
  contains?: string
  notEmpty?: boolean
}

export interface DrillParityChecks {
  cluster: DrillParityClusterCheck[]
  filesystem: DrillParityFilesystemCheck[]
}

export interface DrillParitySpec {
  version: number
  drillId: string
  contextName?: string
  timeoutMs?: number
  resetKindBeforeRun?: boolean
  manifests: DrillParityManifest[]
  steps: DrillParityStep[]
  checks: DrillParityChecks
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

const readString = (
  obj: Record<string, unknown>,
  key: string
): string | undefined => {
  const value = obj[key]
  if (typeof value !== 'string') {
    return undefined
  }
  return value
}

const readBoolean = (
  obj: Record<string, unknown>,
  key: string
): boolean | undefined => {
  const value = obj[key]
  if (typeof value !== 'boolean') {
    return undefined
  }
  return value
}

const readNumber = (
  obj: Record<string, unknown>,
  key: string
): number | undefined => {
  const value = obj[key]
  if (typeof value !== 'number' || Number.isFinite(value) === false) {
    return undefined
  }
  return value
}

const isClusterCheckMatch = (
  value: string
): value is 'equals' | 'contains' => {
  return value === 'equals' || value === 'contains'
}

const parseManifests = (value: unknown): Result<DrillParityManifest[]> => {
  if (!Array.isArray(value) || value.length === 0) {
    return error('`manifests` must be a non-empty array')
  }
  const manifests: DrillParityManifest[] = []
  for (const entry of value) {
    if (!isObjectRecord(entry)) {
      return error('Each manifest must be an object')
    }
    const path = readString(entry, 'path')
    const content = readString(entry, 'content')
    const sourcePath = readString(entry, 'sourcePath')
    if (!path || (!content && !sourcePath)) {
      return error(
        'Each manifest requires `path` and either `content` or `sourcePath`'
      )
    }
    manifests.push({ path, content, sourcePath })
  }
  return success(manifests)
}

const parseSteps = (value: unknown): Result<DrillParityStep[]> => {
  if (!Array.isArray(value) || value.length === 0) {
    return error('`steps` must be a non-empty array')
  }
  const steps: DrillParityStep[] = []
  for (const [index, entry] of value.entries()) {
    if (!isObjectRecord(entry)) {
      return error('Each step must be an object')
    }
    const run = readString(entry, 'run')
    if (!run) {
      return error('Each step requires `run` command')
    }
    const id = readString(entry, 'id') ?? `step-${index + 1}`
    const expectParity = readBoolean(entry, 'expectParity') ?? true
    steps.push({ id, run, expectParity })
  }
  return success(steps)
}

const parseClusterChecks = (
  value: unknown
): Result<DrillParityClusterCheck[]> => {
  if (value == null) {
    return success([])
  }
  if (!Array.isArray(value)) {
    return error('`checks.cluster` must be an array')
  }
  const checks: DrillParityClusterCheck[] = []
  for (const [index, entry] of value.entries()) {
    if (!isObjectRecord(entry)) {
      return error('Each cluster check must be an object')
    }
    const kind = readString(entry, 'kind')
    const name = readString(entry, 'name')
    const path = readString(entry, 'path')
    const expected = readString(entry, 'expected')
    const id = readString(entry, 'id') ?? `cluster-check-${index + 1}`
    const namespace = readString(entry, 'namespace')
    const rawMatch = readString(entry, 'match')
    const requireEquivalent = readBoolean(entry, 'requireEquivalent')
    if (!kind || !name || !path || expected == null) {
      return error(
        'Each cluster check requires `kind`, `name`, `path`, and `expected`'
      )
    }
    let match: 'equals' | 'contains' | undefined = undefined
    if (rawMatch) {
      if (!isClusterCheckMatch(rawMatch)) {
        return error('`checks.cluster.match` must be `equals` or `contains`')
      }
      match = rawMatch
    }
    checks.push({
      id,
      kind,
      name,
      namespace,
      path,
      expected,
      match,
      requireEquivalent
    })
  }
  return success(checks)
}

const parseFilesystemChecks = (
  value: unknown
): Result<DrillParityFilesystemCheck[]> => {
  if (value == null) {
    return success([])
  }
  if (!Array.isArray(value)) {
    return error('`checks.filesystem` must be an array')
  }
  const checks: DrillParityFilesystemCheck[] = []
  for (const [index, entry] of value.entries()) {
    if (!isObjectRecord(entry)) {
      return error('Each filesystem check must be an object')
    }
    const path = readString(entry, 'path')
    const contains = readString(entry, 'contains')
    const notEmpty = readBoolean(entry, 'notEmpty')
    const id = readString(entry, 'id') ?? `filesystem-check-${index + 1}`
    if (!path) {
      return error('Each filesystem check requires `path`')
    }
    if (contains == null && notEmpty !== true) {
      return error(
        'Filesystem check needs either `contains` or `notEmpty: true`'
      )
    }
    checks.push({
      id,
      path,
      contains,
      notEmpty
    })
  }
  return success(checks)
}

const parseChecks = (value: unknown): Result<DrillParityChecks> => {
  if (value == null) {
    return success({
      cluster: [],
      filesystem: []
    })
  }
  if (!isObjectRecord(value)) {
    return error('`checks` must be an object')
  }
  const clusterResult = parseClusterChecks(value.cluster)
  if (!clusterResult.ok) {
    return clusterResult
  }
  const filesystemResult = parseFilesystemChecks(value.filesystem)
  if (!filesystemResult.ok) {
    return filesystemResult
  }
  return success({
    cluster: clusterResult.value,
    filesystem: filesystemResult.value
  })
}

export const parseDrillParitySpec = (yamlText: string): Result<DrillParitySpec> => {
  let parsed: unknown
  try {
    parsed = parse(yamlText)
  } catch {
    return error('Unable to parse test.yaml as YAML')
  }
  if (!isObjectRecord(parsed)) {
    return error('test.yaml root must be an object')
  }
  const version = readNumber(parsed, 'version')
  const drillId = readString(parsed, 'drillId')
  if (!version || !drillId) {
    return error('test.yaml requires `version` and `drillId`')
  }

  const manifestsResult = parseManifests(parsed.manifests)
  if (!manifestsResult.ok) {
    return manifestsResult
  }
  const stepsResult = parseSteps(parsed.steps)
  if (!stepsResult.ok) {
    return stepsResult
  }
  const checksResult = parseChecks(parsed.checks)
  if (!checksResult.ok) {
    return checksResult
  }
  return success({
    version,
    drillId,
    contextName: readString(parsed, 'contextName'),
    timeoutMs: readNumber(parsed, 'timeoutMs'),
    resetKindBeforeRun: readBoolean(parsed, 'resetKindBeforeRun'),
    manifests: manifestsResult.value,
    steps: stepsResult.value,
    checks: checksResult.value
  })
}

export const loadDrillParitySpec = (path: string): Result<DrillParitySpec> => {
  try {
    const fileContent = readFileSync(path, 'utf-8')
    return parseDrillParitySpec(fileContent)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return error(`Unable to read test spec at ${path}: ${message}`)
  }
}
