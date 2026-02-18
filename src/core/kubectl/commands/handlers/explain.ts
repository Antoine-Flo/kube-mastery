import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import { loadOpenAPISpecSync } from '../../../openapi/loader'
import { mapResourceToOpenAPITarget } from '../../explain/openapiResourceMapper'
import { resolveOpenAPIExplainTarget } from '../../explain/openapiResolver'
import { renderExplainOutput } from '../../explain/renderer'

const isRecursive = (flags: Record<string, string | boolean>): boolean => {
  return flags.recursive === true || flags.R === true
}

export const handleExplain = (parsed: ParsedCommand): Result<string> => {
  if (!parsed.resource) {
    return error('you must specify the type of resource to explain')
  }

  const apiVersion = parsed.flags['api-version']
  const normalizedApiVersion =
    typeof apiVersion === 'string' ? apiVersion : undefined

  const target = mapResourceToOpenAPITarget(parsed.resource, normalizedApiVersion)
  if (!target.ok) {
    return error(target.error)
  }

  const specResult = loadOpenAPISpecSync(target.value.specFile)
  if (!specResult.ok) {
    return error(specResult.error)
  }

  const resolved = resolveOpenAPIExplainTarget(
    specResult.value,
    target.value,
    parsed.explainPath || []
  )
  if (!resolved.ok) {
    return error(resolved.error)
  }

  const output = renderExplainOutput(resolved.value, isRecursive(parsed.flags))
  return success(output)
}
