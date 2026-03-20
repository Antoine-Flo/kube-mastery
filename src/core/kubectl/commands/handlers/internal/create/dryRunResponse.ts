import type { ExecutionResult } from '../../../../../shared/result'
import { error } from '../../../../../shared/result'
import { validateMetadataNameForResource } from '../../../metadataNameValidation'
import {
  renderStructuredPayload,
  resolveOutputDirective,
  validateOutputDirective
} from '../../../output/outputHelpers'
import type { ParsedCommand } from '../../../types'

export const isDryRunClient = (parsed: ParsedCommand): boolean => {
  return parsed.flags['dry-run'] === 'client'
}

export const isSupportedDryRunValue = (value: unknown): boolean => {
  if (value === undefined) {
    return true
  }
  if (value === 'none' || value === 'server' || value === 'client') {
    return true
  }
  return false
}

const sanitizeForDryRunOutput = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForDryRunOutput(item))
      .filter((item) => item !== undefined)
  }
  if (value == null || typeof value !== 'object') {
    if (value === null) {
      return undefined
    }
    return value
  }
  const entries = Object.entries(value as Record<string, unknown>)
  const sanitizedEntries = entries
    .filter(([key]) => key !== '_simulator')
    .map(([key, item]) => [key, sanitizeForDryRunOutput(item)] as const)
    .filter(([, item]) => item !== undefined)
  return Object.fromEntries(sanitizedEntries)
}

const buildDryRunCreatedMessage = (resource: any): string => {
  const kindRaw = resource?.kind
  const nameRaw = resource?.metadata?.name
  if (typeof kindRaw !== 'string' || typeof nameRaw !== 'string') {
    return 'resource created (dry run)'
  }
  const kind = kindRaw.toLowerCase()
  return `${kind}/${nameRaw} created (dry run)`
}

export const buildDryRunResponse = (
  resource: any,
  parsed: ParsedCommand
): ExecutionResult => {
  const metadataNameValidation = validateMetadataNameForResource(resource)
  if (metadataNameValidation != null) {
    return metadataNameValidation
  }

  const outputDirectiveResult = validateOutputDirective(
    resolveOutputDirective(parsed.flags, parsed.output),
    ['table', 'yaml', 'json', 'jsonpath'],
    "--output must be one of: json|yaml|jsonpath"
  )
  if (!outputDirectiveResult.ok) {
    return error(outputDirectiveResult.error)
  }
  const outputDirective = outputDirectiveResult.value
  const sanitized = sanitizeForDryRunOutput(resource)

  if (
    outputDirective.kind === 'yaml' ||
    outputDirective.kind === 'json' ||
    outputDirective.kind === 'jsonpath'
  ) {
    const renderResult = renderStructuredPayload(sanitized, outputDirective)
    if (!renderResult.ok) {
      return error(renderResult.error)
    }
    return {
      ok: true,
      value: renderResult.value
    }
  }

  return {
    ok: true,
    value: buildDryRunCreatedMessage(resource)
  }
}
