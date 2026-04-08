import { stringify as yamlStringify } from 'yaml'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { formatTable } from '../../../shared/formatter'
import { renderKubectlJsonPath } from './jsonpath/renderer'
import type { TabColumnAlign } from './statefulTabWriter'
import { createStatefulTabWriter } from './statefulTabWriter'

export type OutputKind =
  | 'table'
  | 'json'
  | 'yaml'
  | 'wide'
  | 'name'
  | 'jsonpath'
  | 'custom-columns'

export interface OutputDirective {
  kind: OutputKind
  jsonPathExpression?: string
  customColumnsSpec?: string
  rawValue?: string
}

const KUBECTL_JSON_INDENT = 4

export interface KubectlTableRenderOptions {
  align?: TabColumnAlign[]
  spacing?: number
  uppercase?: boolean
  noHeaders?: boolean
  minColumnWidthsByHeader?: Record<string, number>
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

const reorderMetadataForKubectlYaml = (
  metadata: Record<string, unknown>
): Record<string, unknown> => {
  const orderedMetadata: Record<string, unknown> = {}
  if (metadata.creationTimestamp != null) {
    orderedMetadata.creationTimestamp = metadata.creationTimestamp
  }
  if (metadata.name != null) {
    orderedMetadata.name = metadata.name
  }
  if (metadata.namespace != null) {
    orderedMetadata.namespace = metadata.namespace
  }
  if (metadata.resourceVersion != null) {
    orderedMetadata.resourceVersion = metadata.resourceVersion
  }
  if (metadata.uid != null) {
    orderedMetadata.uid = metadata.uid
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (orderedMetadata[key] != null) {
      continue
    }
    orderedMetadata[key] = value
  }
  return orderedMetadata
}

const reorderConfigMapForKubectlYaml = (payload: unknown): unknown => {
  if (!isRecord(payload)) {
    return payload
  }
  const isConfigMap =
    payload.apiVersion === 'v1' &&
    payload.kind === 'ConfigMap' &&
    payload.metadata != null
  if (!isConfigMap) {
    return payload
  }
  const orderedPayload: Record<string, unknown> = {}
  orderedPayload.apiVersion = payload.apiVersion
  if (payload.data != null) {
    orderedPayload.data = payload.data
  }
  if (payload.binaryData != null) {
    orderedPayload.binaryData = payload.binaryData
  }
  orderedPayload.kind = payload.kind
  if (isRecord(payload.metadata)) {
    orderedPayload.metadata = reorderMetadataForKubectlYaml(payload.metadata)
  } else {
    orderedPayload.metadata = payload.metadata
  }
  for (const [key, value] of Object.entries(payload)) {
    if (orderedPayload[key] != null) {
      continue
    }
    orderedPayload[key] = value
  }
  return orderedPayload
}

const reorderSecretForKubectlYaml = (payload: unknown): unknown => {
  if (!isRecord(payload)) {
    return payload
  }
  const isSecret =
    payload.apiVersion === 'v1' &&
    payload.kind === 'Secret' &&
    payload.metadata != null
  if (!isSecret) {
    return payload
  }
  const orderedPayload: Record<string, unknown> = {}
  orderedPayload.apiVersion = payload.apiVersion
  if (payload.data != null) {
    orderedPayload.data = payload.data
  }
  orderedPayload.kind = payload.kind
  if (isRecord(payload.metadata)) {
    orderedPayload.metadata = reorderMetadataForKubectlYaml(payload.metadata)
  } else {
    orderedPayload.metadata = payload.metadata
  }
  if (payload.type != null) {
    orderedPayload.type = payload.type
  }
  for (const [key, value] of Object.entries(payload)) {
    if (orderedPayload[key] != null) {
      continue
    }
    orderedPayload[key] = value
  }
  return orderedPayload
}

/**
 * Aligns NetworkPolicy YAML key order with kubectl get -o yaml (spec keys and port entries).
 */
const reorderNetworkPolicyPortEntry = (portEntry: unknown): unknown => {
  if (!isRecord(portEntry)) {
    return portEntry
  }
  const ordered: Record<string, unknown> = {}
  if (portEntry.port !== undefined) {
    ordered.port = portEntry.port
  }
  if (portEntry.protocol !== undefined) {
    ordered.protocol = portEntry.protocol
  }
  if (portEntry.endPort !== undefined) {
    ordered.endPort = portEntry.endPort
  }
  for (const [key, value] of Object.entries(portEntry)) {
    if (ordered[key] !== undefined) {
      continue
    }
    ordered[key] = value
  }
  return ordered
}

const reorderNetworkPolicyRulePorts = (
  rule: Record<string, unknown>
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...rule }
  if (Array.isArray(next.ports)) {
    next.ports = next.ports.map(reorderNetworkPolicyPortEntry)
  }
  return next
}

const reorderNetworkPolicyForKubectlYaml = (payload: unknown): unknown => {
  if (!isRecord(payload)) {
    return payload
  }
  const isNetworkPolicy =
    payload.apiVersion === 'networking.k8s.io/v1' &&
    payload.kind === 'NetworkPolicy' &&
    payload.metadata != null
  if (!isNetworkPolicy) {
    return payload
  }
  const spec = payload.spec
  if (!isRecord(spec)) {
    return payload
  }
  const specKeyOrder = [
    'egress',
    'ingress',
    'podSelector',
    'policyTypes'
  ] as const
  const orderedSpec: Record<string, unknown> = {}
  for (const key of specKeyOrder) {
    if (spec[key] === undefined) {
      continue
    }
    let value: unknown = spec[key]
    if (key === 'ingress' && Array.isArray(value)) {
      value = value.map((rule) => {
        if (!isRecord(rule)) {
          return rule
        }
        return reorderNetworkPolicyRulePorts(rule)
      })
    }
    if (key === 'egress' && Array.isArray(value)) {
      value = value.map((rule) => {
        if (!isRecord(rule)) {
          return rule
        }
        return reorderNetworkPolicyRulePorts(rule)
      })
    }
    orderedSpec[key] = value
  }
  for (const [key, value] of Object.entries(spec)) {
    if (orderedSpec[key] !== undefined) {
      continue
    }
    orderedSpec[key] = value
  }

  const orderedPayload: Record<string, unknown> = {}
  orderedPayload.apiVersion = payload.apiVersion
  orderedPayload.kind = payload.kind
  if (isRecord(payload.metadata)) {
    orderedPayload.metadata = reorderMetadataForKubectlYaml(payload.metadata)
  } else {
    orderedPayload.metadata = payload.metadata
  }
  orderedPayload.spec = orderedSpec
  for (const [key, value] of Object.entries(payload)) {
    if (orderedPayload[key] !== undefined) {
      continue
    }
    orderedPayload[key] = value
  }
  return orderedPayload
}

const stripMatchingQuotes = (raw: string): string => {
  const trimmed = raw.trim()
  if (trimmed.length < 2) {
    return trimmed
  }

  const startsWithDoubleQuote = trimmed.startsWith('"')
  const endsWithDoubleQuote = trimmed.endsWith('"')
  if (startsWithDoubleQuote && endsWithDoubleQuote) {
    return trimmed.slice(1, -1).trim()
  }

  const startsWithSingleQuote = trimmed.startsWith("'")
  const endsWithSingleQuote = trimmed.endsWith("'")
  if (startsWithSingleQuote && endsWithSingleQuote) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

const normalizeOutputValue = (rawValue: string): string => {
  return stripMatchingQuotes(rawValue).trim().toLowerCase()
}

const quoteCreationTimestampScalars = (yamlPayload: string): string => {
  return yamlPayload.replace(
    /^(\s*creationTimestamp:\s*)([0-9T:.-]+Z)$/gm,
    '$1"$2"'
  )
}

const parseOutputFromRawValue = (rawValue: string): OutputDirective => {
  const normalizedValue = normalizeOutputValue(rawValue)
  if (normalizedValue.startsWith('jsonpath=')) {
    const rawExpression = rawValue.slice(rawValue.indexOf('=') + 1).trim()
    const expression = stripMatchingQuotes(rawExpression)
    return {
      kind: 'jsonpath',
      jsonPathExpression: expression,
      rawValue
    }
  }

  if (normalizedValue === 'jsonpath') {
    return {
      kind: 'jsonpath',
      jsonPathExpression: '',
      rawValue
    }
  }

  if (normalizedValue === 'json') {
    return { kind: 'json', rawValue }
  }
  if (normalizedValue === 'yaml') {
    return { kind: 'yaml', rawValue }
  }
  if (normalizedValue === 'wide') {
    return { kind: 'wide', rawValue }
  }
  if (normalizedValue === 'name') {
    return { kind: 'name', rawValue }
  }
  if (normalizedValue === 'table') {
    return { kind: 'table', rawValue }
  }

  if (normalizedValue.startsWith('custom-columns=')) {
    const rawSpec = rawValue.slice(rawValue.indexOf('=') + 1).trim()
    const spec = stripMatchingQuotes(rawSpec)
    return {
      kind: 'custom-columns',
      customColumnsSpec: spec,
      rawValue
    }
  }

  if (normalizedValue === 'custom-columns') {
    return {
      kind: 'custom-columns',
      customColumnsSpec: '',
      rawValue
    }
  }

  return {
    kind: 'table',
    rawValue
  }
}

export const resolveOutputDirective = (
  flags: Record<string, string | boolean>,
  parsedOutput: string | undefined
): OutputDirective => {
  const explicitOutput = flags.output ?? flags['o']
  if (typeof explicitOutput === 'string') {
    return parseOutputFromRawValue(explicitOutput)
  }

  if (parsedOutput === 'json') {
    return { kind: 'json' }
  }
  if (parsedOutput === 'yaml') {
    return { kind: 'yaml' }
  }
  if (parsedOutput === 'wide') {
    return { kind: 'wide' }
  }
  if (parsedOutput === 'name') {
    return { kind: 'name' }
  }
  return { kind: 'table' }
}

export const validateOutputDirective = (
  directive: OutputDirective,
  allowed: OutputKind[],
  errorMessage: string
): Result<OutputDirective> => {
  if (!allowed.includes(directive.kind)) {
    return error(errorMessage)
  }
  if (
    directive.kind === 'jsonpath' &&
    (directive.jsonPathExpression == null ||
      directive.jsonPathExpression.trim().length === 0)
  ) {
    return error('error: jsonpath output requires an expression')
  }
  if (directive.kind === 'custom-columns') {
    const spec = directive.customColumnsSpec ?? ''
    if (spec.trim().length === 0) {
      return error(
        'error: custom-columns format specified but no custom columns given'
      )
    }
    const parts = spec.split(',')
    for (const part of parts) {
      const trimmedPart = part.trim()
      const colonIndex = trimmedPart.indexOf(':')
      if (colonIndex === -1) {
        return error(
          `error: unexpected custom-columns spec: ${trimmedPart}, expected <header>:<json-path-expr>`
        )
      }
      const pathExpr = trimmedPart.slice(colonIndex + 1).trim()
      if (pathExpr.length === 0) {
        return error(
          `error: unexpected custom-columns spec: ${trimmedPart}, expected <header>:<json-path-expr>`
        )
      }
    }
  }
  if (
    directive.rawValue != null &&
    directive.kind === 'table' &&
    normalizeOutputValue(directive.rawValue) !== 'table'
  ) {
    return error(errorMessage)
  }
  return success(directive)
}

export const renderStructuredPayload = (
  payload: unknown,
  directive: OutputDirective
): Result<string> => {
  if (directive.kind === 'json') {
    return success(JSON.stringify(payload, null, KUBECTL_JSON_INDENT))
  }
  if (directive.kind === 'yaml') {
    const normalizedYamlPayload = reorderSecretForKubectlYaml(
      reorderConfigMapForKubectlYaml(reorderNetworkPolicyForKubectlYaml(payload))
    )
    const yamlOutput = yamlStringify(normalizedYamlPayload, {
      indentSeq: false,
      aliasDuplicateObjects: false
    }).trimEnd()
    return success(quoteCreationTimestampScalars(yamlOutput))
  }
  if (directive.kind === 'jsonpath') {
    return renderKubectlJsonPath(payload, directive.jsonPathExpression ?? '')
  }
  return error(
    'error: structured payload requires json, yaml, or jsonpath output'
  )
}

export const formatKubectlTable = (
  headers: string[],
  rows: string[][],
  options: KubectlTableRenderOptions = {}
): string => {
  const uppercase = options.uppercase ?? true
  const spacing = options.spacing ?? 3
  const normalizedHeaders = uppercase
    ? headers.map((header) => header.toUpperCase())
    : headers
  if (options.minColumnWidthsByHeader != null) {
    const writer = createStatefulTabWriter({
      align: options.align,
      spacing,
      minColumnWidthsByHeader: options.minColumnWidthsByHeader
    })
    const formattedLines = writer.ingestHeaderAndRows(normalizedHeaders, rows)
    writer.reset()
    if (options.noHeaders === true) {
      return formattedLines.slice(1).join('\n')
    }
    return formattedLines.join('\n')
  }

  const formatted = formatTable(normalizedHeaders, rows, {
    align: options.align,
    spacing,
    uppercase: false
  })
  if (options.noHeaders === true) {
    return formatted.split('\n').slice(1).join('\n')
  }
  return formatted
}
