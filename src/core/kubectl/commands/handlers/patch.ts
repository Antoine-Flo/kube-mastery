import type { KindToResource, ResourceKind } from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand, Resource } from '../types'
import {
  RESOURCE_KIND_BY_RESOURCE,
  toKindReference,
  toPluralKindReference
} from './resourceHelpers'
import { validateImmutableFieldsForEdit } from './immutableFieldValidation'

const PATCHABLE_RESOURCES: Resource[] = [
  'deployments',
  'daemonsets',
  'statefulsets'
]

type JsonRecord = Record<string, unknown>

const isJsonRecord = (value: unknown): value is JsonRecord => {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const mergePatchValue = (target: unknown, patch: unknown): unknown => {
  if (!isJsonRecord(patch)) {
    return cloneValue(patch)
  }

  const targetRecord: JsonRecord = isJsonRecord(target) ? cloneValue(target) : {}
  const merged: JsonRecord = { ...targetRecord }
  for (const [key, patchValue] of Object.entries(patch)) {
    if (patchValue === null) {
      delete merged[key]
      continue
    }
    merged[key] = mergePatchValue(merged[key], patchValue)
  }
  return merged
}

const toPatchKind = (
  resource: Resource | undefined
): { kind: ResourceKind; resource: Resource } | ExecutionResult => {
  if (resource == null) {
    return error('error: you must specify a resource type')
  }
  if (!PATCHABLE_RESOURCES.includes(resource)) {
    return error(`error: patch is not supported on resource type "${resource}"`)
  }
  const kind = RESOURCE_KIND_BY_RESOURCE[resource]
  if (kind == null) {
    return error(`error: patch is not supported on resource type "${resource}"`)
  }
  return {
    kind,
    resource
  }
}

const toPatchPayload = (parsed: ParsedCommand): string | ExecutionResult => {
  const fromParsed = parsed.patchPayload
  if (typeof fromParsed === 'string' && fromParsed.length > 0) {
    return stripWrappingQuotes(fromParsed)
  }
  const fromFlags = parsed.flags['patch']
  if (typeof fromFlags === 'string' && fromFlags.length > 0) {
    return stripWrappingQuotes(fromFlags)
  }
  return error('error: required flag(s) "patch" not set')
}

const stripWrappingQuotes = (value: string): string => {
  if (value.length < 2) {
    return value
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }
  return value
}

const parsePatchPayload = (payload: string): JsonRecord | ExecutionResult => {
  try {
    const parsed = JSON.parse(payload) as unknown
    if (!isJsonRecord(parsed)) {
      return error('error: invalid JSON patch: patch must be a JSON object')
    }
    return parsed
  } catch (parseError) {
    const message =
      parseError instanceof Error ? parseError.message : 'invalid JSON payload'
    return error(`error: invalid JSON patch: ${message}`)
  }
}

const validatePatchType = (parsed: ParsedCommand): ExecutionResult | undefined => {
  const patchType = parsed.flags['type']
  if (patchType !== undefined && patchType !== 'merge') {
    return error('error: --type must be "merge"')
  }
  return undefined
}

export const handlePatch = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const typeValidation = validatePatchType(parsed)
  if (typeValidation != null) {
    return typeValidation
  }

  if (parsed.name == null || parsed.name.length === 0) {
    return error('patch requires a resource name')
  }

  const kindResult = toPatchKind(parsed.resource)
  if ('ok' in kindResult) {
    return kindResult
  }

  const payloadResult = toPatchPayload(parsed)
  if (typeof payloadResult !== 'string') {
    return payloadResult
  }

  const patchResult = parsePatchPayload(payloadResult)
  if ('ok' in patchResult) {
    return patchResult
  }

  const namespace = parsed.namespace ?? 'default'
  const existingResult = apiServer.findResource(
    kindResult.kind,
    parsed.name,
    namespace
  )
  if (!existingResult.ok) {
    return error(
      `Error from server (NotFound): ${toPluralKindReference(kindResult.kind)} "${parsed.name}" not found`
    )
  }

  const patchedResource = mergePatchValue(existingResult.value, patchResult)
  const immutableError = validateImmutableFieldsForEdit(
    kindResult.kind,
    existingResult.value as JsonRecord,
    patchedResource as JsonRecord
  )
  if (immutableError != null) {
    return error(immutableError)
  }

  const updateResult = apiServer.updateResource(
    kindResult.kind,
    parsed.name,
    patchedResource as KindToResource<typeof kindResult.kind>,
    namespace
  )
  if (!updateResult.ok) {
    return error(updateResult.error)
  }

  return success(`${toKindReference(kindResult.kind)}/${parsed.name} patched`)
}
