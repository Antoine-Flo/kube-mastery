import { stringify as yamlStringify } from 'yaml'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { renderKubectlJsonPath } from './jsonpath/renderer'

export type OutputKind =
  | 'table'
  | 'json'
  | 'yaml'
  | 'wide'
  | 'name'
  | 'jsonpath'

export interface OutputDirective {
  kind: OutputKind
  jsonPathExpression?: string
  rawValue?: string
}

const KUBECTL_JSON_INDENT = 4

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
    return success(
      yamlStringify(payload, {
        indentSeq: false,
        aliasDuplicateObjects: false
      }).trimEnd()
    )
  }
  if (directive.kind === 'jsonpath') {
    return renderKubectlJsonPath(payload, directive.jsonPathExpression ?? '')
  }
  return error('error: structured payload requires json, yaml, or jsonpath output')
}
