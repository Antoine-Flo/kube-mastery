import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import { createConfigMap } from '../../../../../cluster/ressources/ConfigMap'
import type { ExecutionResult } from '../../../../../shared/result'
import { error } from '../../../../../shared/result'
import { createResourceWithEvents } from '../../../resourceHelpers'
import type { ParsedCommand } from '../../../types'
import type { ErrorResult } from './types'

export const isExecutionErrorResult = (
  value: unknown
): value is ErrorResult => {
  if (value == null || typeof value !== 'object') {
    return false
  }
  if (!('ok' in value)) {
    return false
  }
  return (value as { ok?: unknown }).ok === false
}

const parseConfigMapDataFromLiterals = (
  literals: string[]
): Record<string, string> | (ExecutionResult & { ok: false }) => {
  const data: Record<string, string> = {}
  for (const literal of literals) {
    const separatorIndex = literal.indexOf('=')
    if (separatorIndex <= 0) {
      return {
        ok: false,
        error: `error: invalid --from-literal value: ${literal}, expected key=value`
      }
    }
    const key = literal.slice(0, separatorIndex).trim()
    const value = literal.slice(separatorIndex + 1)
    if (key.length === 0) {
      return {
        ok: false,
        error: `error: invalid --from-literal value: ${literal}, expected key=value`
      }
    }
    data[key] = value
  }
  return data
}

const getCreateConfigMapLiterals = (parsed: ParsedCommand): string[] => {
  if (
    Array.isArray(parsed.createFromLiterals) &&
    parsed.createFromLiterals.length > 0
  ) {
    return parsed.createFromLiterals
  }
  const fromLiteral = parsed.flags['from-literal']
  if (typeof fromLiteral === 'string' && fromLiteral.length > 0) {
    return [fromLiteral]
  }
  return []
}

export const buildCreateConfigMapDryRunManifest = (
  parsed: ParsedCommand & { name: string }
): Record<string, unknown> | ExecutionResult => {
  const literals = getCreateConfigMapLiterals(parsed)
  if (literals.length === 0) {
    return error(
      'error: create configmap requires at least one --from-literal=key=value'
    )
  }
  const data = parseConfigMapDataFromLiterals(literals)
  if (isExecutionErrorResult(data)) {
    return data
  }
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: parsed.name,
      ...(parsed.namespace != null && parsed.namespace !== 'default'
        ? { namespace: parsed.namespace }
        : {})
    },
    data
  }
}

export const isCreateConfigMapImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & { name: string } => {
  if (parsed.resource !== 'configmaps') {
    return false
  }
  if (typeof parsed.name !== 'string') {
    return false
  }
  return parsed.name.length > 0
}

export const createConfigMapFromFlags = (
  parsed: ParsedCommand & { name: string },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const literals = getCreateConfigMapLiterals(parsed)
  if (literals.length === 0) {
    return error(
      'error: create configmap requires at least one --from-literal=key=value'
    )
  }
  const data = parseConfigMapDataFromLiterals(literals)
  if (isExecutionErrorResult(data)) {
    return data
  }
  const configMap = createConfigMap({
    name: parsed.name,
    namespace: parsed.namespace ?? 'default',
    data
  })
  return createResourceWithEvents(configMap, apiServer)
}
